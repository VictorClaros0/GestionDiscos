using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SocketsProof.Models;

namespace SocketsProof
{
    /// <summary>
    /// Background service that periodically checks for nodes that haven't reported
    /// within the configured threshold and marks them as NoReporta.
    /// </summary>
    public class NodeHealthChecker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<NodeHealthChecker> _logger;
        private readonly int _thresholdSeconds;
        private readonly int _checkIntervalSeconds = 15;

        public NodeHealthChecker(IServiceScopeFactory scopeFactory, ILogger<NodeHealthChecker> logger, IConfiguration config)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _thresholdSeconds = config.GetValue<int>("ClusterSettings:NoReportaThresholdSeconds", 30);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("NodeHealthChecker iniciado. Threshold: {Threshold}s, Check interval: {Interval}s",
                _thresholdSeconds, _checkIntervalSeconds);

            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(_checkIntervalSeconds), stoppingToken);

                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    long threshold = now - _thresholdSeconds;

                    var deadNodes = db.Clients
                        .Where(c => c.Status == NodeStatus.Active && c.LastSeen < threshold)
                        .ToList();

                    foreach (var node in deadNodes)
                    {
                        node.Status = NodeStatus.NoReporta;
                        _logger.LogWarning("⚠️ Nodo {Name} ({Mac}) marcado como NoReporta. Último reporte: {LastSeen}",
                            node.name, node.mac, node.LastSeen);
                    }

                    if (deadNodes.Count > 0)
                        await db.SaveChangesAsync(stoppingToken);

                    // Also check for commands that have been Sent for too long (timeout)
                    long cmdThreshold = now - 60; // 60 seconds timeout

                    var timeoutCommands = db.Commands
                        .Where(c => c.Status == CommandStatus.Sent && c.SentAt < cmdThreshold)
                        .ToList();

                    foreach (var cmd in timeoutCommands)
                    {
                        cmd.Status = CommandStatus.Timeout;
                        _logger.LogWarning("⏱️ Comando {Id} marcado como Timeout", cmd.Id);
                    }

                    if (timeoutCommands.Count > 0)
                        await db.SaveChangesAsync(stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Error en NodeHealthChecker");
                }
            }
        }
    }
}
