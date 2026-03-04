using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocketsProof.Models;

namespace SocketsProof.Controllers
{
    [Route("api/nodes")]
    [ApiController]
    public class NodesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NodesController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// GET /api/nodes — Returns all registered nodes with their status.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetNodes()
        {
            var nodes = await _context.Clients
                .Select(c => new
                {
                    c.id,
                    c.name,
                    c.mac,
                    c.Hostname,
                    c.OS,
                    c.IP,
                    Status = c.Status.ToString(),
                    c.LastSeen
                })
                .ToListAsync();

            return Ok(nodes);
        }

        /// <summary>
        /// GET /api/nodes/{id} — Returns a specific node.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetNode(Guid id)
        {
            var node = await _context.Clients.FindAsync(id);
            if (node == null) return NotFound();

            return Ok(new
            {
                node.id,
                node.name,
                node.mac,
                node.Hostname,
                node.OS,
                node.IP,
                Status = node.Status.ToString(),
                node.LastSeen
            });
        }
    }
}
