using System.ComponentModel.DataAnnotations.Schema;

namespace SocketsProof.Models
{
    [Table("CommandAcks")]
    public class CommandAck
    {
        public Guid Id { get; set; }
        public Guid CommandId { get; set; }
        public DateTime AckedAt { get; set; } = DateTime.UtcNow;
        public string? Response { get; set; }
        public Command? Command { get; set; }
    }
}
