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

                    // ─── LOG DE NODOS QUE DEJARON DE REPORTAR ────────────
                    await WriteNoReportaLogFile(db);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Error en NodeHealthChecker");
                }
            }
        }

        /// <summary>
        /// Escribe un archivo log con todos los nodos que alguna vez reportaron
        /// pero dejaron de hacerlo (Status = NoReporta). Se actualiza cada 15 segundos.
        /// </summary>
        private async Task WriteNoReportaLogFile(AppDbContext db)
        {
            try
            {
                var nodosNoReportan = await db.Clients
                    .Where(c => c.Status == NodeStatus.NoReporta)
                    .OrderBy(c => c.LastSeen)
                    .ToListAsync();

                var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
                Directory.CreateDirectory(logDir);
                var logPath = Path.Combine(logDir, "nodos_no_reportan.log");

                using var writer = new StreamWriter(logPath, false, System.Text.Encoding.UTF8);
                await writer.WriteLineAsync("═══════════════════════════════════════════════════════════════");
                await writer.WriteLineAsync("  REGISTRO DE NODOS QUE DEJARON DE REPORTAR");
                await writer.WriteLineAsync($"  Generado: {DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss} (Actualización cada 15s)");
                await writer.WriteLineAsync("═══════════════════════════════════════════════════════════════");
                await writer.WriteLineAsync();

                if (nodosNoReportan.Count == 0)
                {
                    await writer.WriteLineAsync("  ✅ Todos los nodos están reportando correctamente.");
                }
                else
                {
                    await writer.WriteLineAsync($"  ⚠️ Total de nodos sin reportar: {nodosNoReportan.Count}");
                    await writer.WriteLineAsync();

                    foreach (var nodo in nodosNoReportan)
                    {
                        var lastSeenDate = DateTimeOffset.FromUnixTimeSeconds(nodo.LastSeen).ToLocalTime();
                        var sinReportar = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - nodo.LastSeen;

                        await writer.WriteLineAsync($"  ──────────────────────────────────────────────");
                        await writer.WriteLineAsync($"  Nombre:    {nodo.name}");
                        await writer.WriteLineAsync($"  Hostname:  {nodo.Hostname}");
                        await writer.WriteLineAsync($"  MAC:       {nodo.mac}");
                        await writer.WriteLineAsync($"  IP:        {nodo.IP}");
                        await writer.WriteLineAsync($"  OS:        {nodo.OS}");
                        await writer.WriteLineAsync($"  Último reporte: {lastSeenDate:yyyy-MM-dd HH:mm:ss}");
                        await writer.WriteLineAsync($"  Sin reportar:   {sinReportar}s ({sinReportar / 60}min)");
                    }

                    await writer.WriteLineAsync($"  ──────────────────────────────────────────────");
                }

                await writer.WriteLineAsync();
                await writer.WriteLineAsync("═══════════════════════════════════════════════════════════════");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al escribir log de nodos NoReporta");
            }
        }
    }
}
