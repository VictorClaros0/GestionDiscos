using System.ComponentModel.DataAnnotations.Schema;

namespace SocketsProof.Models
{
    [Table("DiskLog")]
    public class DiskLog
    {
        public Guid id { get; set; }
        public int totalMemory { get; set; }
        public int freeMemory { get; set; }
        public double UsagePercent { get; set; }
        public int Iops { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? DriveName { get; set; }
        public string? DriveType { get; set; }
        public Guid clientId { get; set; }
        public Client? Client { get; set; }
    }
}
