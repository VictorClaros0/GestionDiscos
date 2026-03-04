using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocketsProof.Models;

namespace SocketsProof.Controllers
{
    [Route("api/metrics")]
    [ApiController]
    public class MetricsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MetricsController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// GET /api/metrics?nodeId=X&from=Y&to=Z
        /// Returns disk metrics, optionally filtered by node and date range.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetMetrics(
            [FromQuery] Guid? nodeId,
            [FromQuery] long? from,
            [FromQuery] long? to)
        {
            var query = _context.DiskLogs.AsQueryable();

            if (nodeId.HasValue)
                query = query.Where(d => d.clientId == nodeId.Value);

            if (from.HasValue)
                query = query.Where(d => d.Timestamp >= from.Value);

            if (to.HasValue)
                query = query.Where(d => d.Timestamp <= to.Value);

            var metrics = await query
                .OrderByDescending(d => d.Timestamp)
                .Take(500)
                .Select(d => new
                {
                    d.id,
                    d.clientId,
                    d.totalMemory,
                    d.freeMemory,
                    usedMemory = d.totalMemory - d.freeMemory,
                    d.UsagePercent,
                    d.Iops,
                    d.DriveName,
                    d.DriveType,
                    d.Timestamp,
                    timestampEpoch = d.Timestamp
                })
                .ToListAsync();

            return Ok(metrics);
        }
    }
}
