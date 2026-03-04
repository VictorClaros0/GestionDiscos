namespace SocketsProof.Models
{
    using Microsoft.EntityFrameworkCore;

    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Client> Clients { get; set; }
        public DbSet<DiskLog> DiskLogs { get; set; }
        public DbSet<Command> Commands { get; set; }
        public DbSet<CommandAck> CommandAcks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Client → DiskLogs (1:N)
            modelBuilder.Entity<DiskLog>()
                .HasOne(d => d.Client)
                .WithMany(c => c.diskLogs)
                .HasForeignKey(d => d.clientId)
                .OnDelete(DeleteBehavior.Cascade);

            // Client → Commands (1:N)
            modelBuilder.Entity<Command>()
                .HasOne(cmd => cmd.Node)
                .WithMany(c => c.Commands)
                .HasForeignKey(cmd => cmd.NodeId)
                .OnDelete(DeleteBehavior.Cascade);

            // Command → Ack (1:1)
            modelBuilder.Entity<CommandAck>()
                .HasOne(ack => ack.Command)
                .WithOne(cmd => cmd.Ack)
                .HasForeignKey<CommandAck>(ack => ack.CommandId)
                .OnDelete(DeleteBehavior.Cascade);

            // Performance indexes
            modelBuilder.Entity<DiskLog>()
                .HasIndex(d => new { d.clientId, d.Timestamp })
                .HasDatabaseName("IX_DiskLog_ClientId_Timestamp");

            modelBuilder.Entity<Client>()
                .HasIndex(c => c.LastSeen)
                .HasDatabaseName("IX_Client_LastSeen");

            modelBuilder.Entity<Client>()
                .HasIndex(c => c.mac)
                .IsUnique()
                .HasDatabaseName("IX_Client_Mac");

            // Store enums as strings
            modelBuilder.Entity<Client>()
                .Property(c => c.Status)
                .HasConversion<string>();

            modelBuilder.Entity<Command>()
                .Property(c => c.Status)
                .HasConversion<string>();
        }
    }
}
