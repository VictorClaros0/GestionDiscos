using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using SocketsProof.Models;

namespace SocketsProof.Controllers
{
    [Route("api/commands")]
    [ApiController]
    public class CommandController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<CommandController> _logger;

        public CommandController(AppDbContext context, ILogger<CommandController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/commands?nodeId=X — Get command history, optionally filtered by node.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetCommands([FromQuery] Guid? nodeId)
        {
            var query = _context.Commands
                .Include(c => c.Ack)
                .AsQueryable();

            if (nodeId.HasValue)
                query = query.Where(c => c.NodeId == nodeId.Value);

            var commands = await query
                .OrderByDescending(c => c.SentAt)
                .Take(100)
                .Select(c => new
                {
                    c.Id,
                    c.NodeId,
                    c.CommandText,
                    c.SentAt,
                    Status = c.Status.ToString(),
                    AckedAt = c.Ack != null ? c.Ack.AckedAt : (DateTime?)null,
                    AckResponse = c.Ack != null ? c.Ack.Response : null
                })
                .ToListAsync();

            return Ok(commands);
        }

        /// <summary>
        /// POST /api/commands — Send a command to a node via TCP.
        /// Body: { "nodeId": "guid", "commandText": "string" }
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<object>> SendCommand([FromBody] SendCommandRequest request)
        {
            if (request == null || request.NodeId == Guid.Empty || string.IsNullOrWhiteSpace(request.CommandText))
                return BadRequest(new { error = "nodeId y commandText son requeridos." });

            var node = await _context.Clients.FindAsync(request.NodeId);
            if (node == null)
                return NotFound(new { error = $"Nodo {request.NodeId} no encontrado." });

            // Create command record
            var command = new Command
            {
                Id = Guid.NewGuid(),
                NodeId = request.NodeId,
                CommandText = request.CommandText,
                SentAt = DateTime.UtcNow,
                Status = CommandStatus.Sent
            };

            _context.Commands.Add(command);
            await _context.SaveChangesAsync();

            // Send via TCP
            var socketMessage = new SocketMessage
            {
                Type = "COMMAND",
                Payload = JsonSerializer.SerializeToElement(new CommandPayload
                {
                    CommandId = command.Id.ToString(),
                    CommandText = command.CommandText
                })
            };

            bool sent = await SocketService.SendToNode(request.NodeId, socketMessage);

            if (!sent)
            {
                _logger.LogWarning("No se pudo enviar comando {Id} al nodo {NodeId} (desconectado).", command.Id, request.NodeId);
            }

            return Ok(new
            {
                command.Id,
                command.NodeId,
                command.CommandText,
                command.SentAt,
                Status = command.Status.ToString(),
                tcpSent = sent
            });
        }
    }

    public class SendCommandRequest
    {
        public Guid NodeId { get; set; }
        public string CommandText { get; set; } = string.Empty;
    }
}
