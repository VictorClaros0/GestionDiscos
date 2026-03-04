using System.ComponentModel.DataAnnotations.Schema;

namespace SocketsProof.Models
{
    public enum CommandStatus
    {
        Sent,
        Acked,
        Timeout
    }

    [Table("Commands")]
    public class Command
    {
        public Guid Id { get; set; }
        public Guid NodeId { get; set; }
        public string CommandText { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public CommandStatus Status { get; set; } = CommandStatus.Sent;
        public Client? Node { get; set; }
        public CommandAck? Ack { get; set; }
    }
}
