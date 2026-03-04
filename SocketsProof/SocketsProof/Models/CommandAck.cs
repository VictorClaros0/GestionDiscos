using System.ComponentModel.DataAnnotations.Schema;

namespace SocketsProof.Models
{
    [Table("CommandAcks")]
    public class CommandAck
    {
        public Guid Id { get; set; }
        public Guid CommandId { get; set; }
        public long AckedAt { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        public string? Response { get; set; }
        public Command? Command { get; set; }
    }
}
