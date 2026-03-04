using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using SocketsProof.Models;

namespace SocketsProof.Controllers
{
    [Route("api/config")]
    [ApiController]
    public class ConfigController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<ConfigController> _logger;

        public ConfigController(AppDbContext context, ILogger<ConfigController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// POST /api/config/interval — Change a node's reporting interval.
        /// Body: { "nodeId": "guid", "intervalSeconds": 10 }
        /// </summary>
        [HttpPost("interval")]
        public async Task<ActionResult<object>> ChangeInterval([FromBody] ChangeIntervalRequest request)
        {
            if (request == null || request.NodeId == Guid.Empty || request.IntervalSeconds < 1)
                return BadRequest(new { error = "nodeId y intervalSeconds (>= 1) son requeridos." });

            var node = await _context.Clients.FindAsync(request.NodeId);
            if (node == null)
                return NotFound(new { error = $"Nodo {request.NodeId} no encontrado." });

            // Send CONFIG_UPDATE via TCP
            var socketMessage = new SocketMessage
            {
                Type = "CONFIG_UPDATE",
                Payload = JsonSerializer.SerializeToElement(new ConfigPayload
                {
                    IntervalSeconds = request.IntervalSeconds
                })
            };

            bool sent = await SocketService.SendToNode(request.NodeId, socketMessage);

            _logger.LogInformation("CONFIG_UPDATE enviado a {Name}: intervalSeconds={Interval}, sent={Sent}",
                node.name, request.IntervalSeconds, sent);

            return Ok(new
            {
                nodeId = request.NodeId,
                nodeName = node.name,
                intervalSeconds = request.IntervalSeconds,
                tcpSent = sent
            });
        }
    }

    public class ChangeIntervalRequest
    {
        public Guid NodeId { get; set; }
        public int IntervalSeconds { get; set; }
    }
}
