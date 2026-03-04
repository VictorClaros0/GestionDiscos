using System.ComponentModel.DataAnnotations.Schema;

namespace SocketsProof.Models
{
    public enum NodeStatus
    {
        Active,
        NoReporta
    }

    [Table("Client")]
    public class Client
    {
        public Guid id { get; set; }
        public string? name { get; set; }
        public string? mac { get; set; }
        public string? Hostname { get; set; }
        public string? OS { get; set; }
        public string? IP { get; set; }
        public NodeStatus Status { get; set; } = NodeStatus.Active;
        public DateTime LastSeen { get; set; } = DateTime.UtcNow;
        public List<DiskLog>? diskLogs { get; set; }
        public List<Command>? Commands { get; set; }
    }
}
