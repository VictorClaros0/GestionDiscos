namespace SocketsProof
{
    using System;
    using System.Collections.Concurrent;
    using System.Collections.Generic;
    using System.Linq;
    using System.Net;
    using System.Net.Sockets;
    using System.Net.WebSockets;
    using System.Text;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using Microsoft.Extensions.Hosting;
    using Microsoft.Extensions.Logging;
    using SocketsProof.Models;

    public class SocketService : BackgroundService
    {
        // Maps macAddress -> latest metric data for WebSocket broadcast
        private static readonly ConcurrentDictionary<string, MetricPayload> ClientMetrics = new();
        // Maps nodeId (Guid) -> TcpClient for bidirectional communication
        private static readonly ConcurrentDictionary<Guid, TcpClient> NodeConnections = new();
        // Maps macAddress -> nodeId for quick lookup
        private static readonly ConcurrentDictionary<string, Guid> MacToNodeId = new();

        private static readonly List<WebSocket> WebSocketClients = new();
        private static readonly object WsLock = new();

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SocketService> _logger;
        private readonly IConfiguration _config;

        private int TcpPort => _config.GetValue<int>("ClusterSettings:TcpPort", 5000);
        private int WsPort => _config.GetValue<int>("ClusterSettings:WsPort", 8080);
        private int MaxNodes => _config.GetValue<int>("ClusterSettings:MaxNodes", 9);

        public SocketService(IServiceScopeFactory scopeFactory, ILogger<SocketService> logger, IConfiguration config)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _config = config;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Iniciando servicio de sockets...");
            _ = Task.Run(() => StartTcpListener(stoppingToken), stoppingToken);
            await StartWebSocketServer(stoppingToken);
        }

        // ─── TCP LISTENER ───────────────────────────────────────────────
        private async Task StartTcpListener(CancellationToken stoppingToken)
        {
            TcpListener listener = new TcpListener(IPAddress.Any, TcpPort);
            listener.Start();
            _logger.LogInformation("Servidor TCP escuchando en puerto {Port}...", TcpPort);

            while (!stoppingToken.IsCancellationRequested)
            {
                TcpClient client = await listener.AcceptTcpClientAsync(stoppingToken);
                _ = Task.Run(() => HandleTcpClient(client, stoppingToken), stoppingToken);
            }
        }

        // ─── WEBSOCKET SERVER ───────────────────────────────────────────
        private async Task StartWebSocketServer(CancellationToken stoppingToken)
        {
            HttpListener listener = new HttpListener();
            // Usa + para aceptar conexiones externas desde cualquier IP
            var wsHost = "+";
            listener.Prefixes.Add($"http://{wsHost}:{WsPort}/");
            listener.Start();
            _logger.LogInformation("Servidor WebSocket en puerto {Port}...", WsPort);

            while (!stoppingToken.IsCancellationRequested)
            {
                HttpListenerContext context = await listener.GetContextAsync();
                if (context.Request.IsWebSocketRequest)
                {
                    HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
                    WebSocket webSocket = webSocketContext.WebSocket;
                    lock (WsLock) { WebSocketClients.Add(webSocket); }
                    _logger.LogInformation("Cliente WebSocket conectado.");
                }
                else
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                }
            }
        }

        // ─── HANDLE INDIVIDUAL TCP CLIENT ───────────────────────────────
        private async Task HandleTcpClient(TcpClient tcpClient, CancellationToken stoppingToken)
        {
            string remoteIp = ((IPEndPoint?)tcpClient.Client.RemoteEndPoint)?.Address.ToString() ?? "unknown";
            _logger.LogInformation("Nueva conexión TCP desde {IP}", remoteIp);

            try
            {
                using NetworkStream stream = tcpClient.GetStream();
                byte[] buffer = new byte[4096];
                StringBuilder messageBuffer = new();

                while (!stoppingToken.IsCancellationRequested)
                {
                    int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, stoppingToken);
                    if (bytesRead == 0) break;

                    string rawData = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    messageBuffer.Append(rawData);

                    // Process complete JSON messages (may receive multiple or partial)
                    string accumulated = messageBuffer.ToString();
                    int braceCount = 0;
                    int msgStart = -1;

                    for (int i = 0; i < accumulated.Length; i++)
                    {
                        if (accumulated[i] == '{')
                        {
                            if (braceCount == 0) msgStart = i;
                            braceCount++;
                        }
                        else if (accumulated[i] == '}')
                        {
                            braceCount--;
                            if (braceCount == 0 && msgStart >= 0)
                            {
                                string jsonMsg = accumulated.Substring(msgStart, i - msgStart + 1);
                                await ProcessMessage(jsonMsg, tcpClient, remoteIp, stoppingToken);
                                messageBuffer.Clear();
                                if (i + 1 < accumulated.Length)
                                    messageBuffer.Append(accumulated.Substring(i + 1));
                                accumulated = messageBuffer.ToString();
                                i = -1; // restart scan
                                msgStart = -1;
                            }
                        }
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning("Conexión TCP cerrada: {Message}", ex.Message);
            }
            finally
            {
                // Remove from maps
                var entryToRemove = MacToNodeId.FirstOrDefault(kvp =>
                    NodeConnections.TryGetValue(kvp.Value, out var conn) && conn == tcpClient);
                if (!string.IsNullOrEmpty(entryToRemove.Key))
                {
                    NodeConnections.TryRemove(entryToRemove.Value, out _);
                    MacToNodeId.TryRemove(entryToRemove.Key, out _);
                    ClientMetrics.TryRemove(entryToRemove.Key, out _);
                    _logger.LogInformation("Nodo {Mac} desconectado y removido del mapa.", entryToRemove.Key);
                }
                tcpClient.Dispose();
                await BroadcastToWebSockets();
            }
        }

        // ─── PROCESS A SINGLE JSON MESSAGE ──────────────────────────────
        private async Task ProcessMessage(string json, TcpClient tcpClient, string remoteIp, CancellationToken ct)
        {
            try
            {
                var message = JsonSerializer.Deserialize<SocketMessage>(json);
                if (message == null)
                {
                    _logger.LogWarning("Payload inválido recibido (null).");
                    return;
                }

                switch (message.Type?.ToUpperInvariant())
                {
                    case "METRIC":
                        await HandleMetric(message.Payload, tcpClient, remoteIp, ct);
                        break;

                    case "ACK":
                        await HandleAck(message.Payload, ct);
                        break;

                    default:
                        _logger.LogWarning("Tipo de mensaje desconocido: {Type}", message.Type);
                        break;
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning("JSON inválido: {Error}", ex.Message);
            }
        }

        // ─── HANDLE METRIC ──────────────────────────────────────────────
        private async Task HandleMetric(JsonElement payload, TcpClient tcpClient, string remoteIp, CancellationToken ct)
        {
            var data = JsonSerializer.Deserialize<MetricPayload>(payload.GetRawText());
            if (data == null || string.IsNullOrEmpty(data.MacAddress))
            {
                _logger.LogWarning("Metric payload inválido.");
                return;
            }

            // ─── VALIDACIÓN DE HORA ──────────────────────────────────────
            const int MaxClockSkewSeconds = 60;
            long serverNow = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            long clientTimestamp = data.Timestamp;
            long clockDiff = Math.Abs(serverNow - clientTimestamp);

            if (clientTimestamp > 0 && clockDiff > MaxClockSkewSeconds)
            {
                _logger.LogWarning(
                    "⏱️ Registro descartado de {Mac}: diferencia de reloj = {Diff}s (límite: {Max}s).",
                    data.MacAddress, clockDiff, MaxClockSkewSeconds);

                var clockError = new SocketMessage
                {
                    Type = "CLOCK_ERROR",
                    Payload = JsonSerializer.SerializeToElement(new
                    {
                        message = "Registro descartado, revise la hora",
                        serverTime = serverNow,
                        clientTime = clientTimestamp,
                        diffSeconds = clockDiff
                    })
                };
                await SendToClient(tcpClient, clockError);
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var clientRecord = await db.Clients.FirstOrDefaultAsync(c => c.mac == data.MacAddress, ct);

            if (clientRecord == null)
            {
                // ─── AUTO-REGISTRATION ──────────────────────────
                int currentCount = await db.Clients.CountAsync(ct);
                if (currentCount >= MaxNodes)
                {
                    _logger.LogWarning("⛔ Rechazado nodo #{Count}: Límite de {Max} alcanzado. MAC: {Mac}",
                        currentCount + 1, MaxNodes, data.MacAddress);
                    // Send rejection and close
                    var rejection = new SocketMessage
                    {
                        Type = "REJECTED",
                        Payload = JsonSerializer.SerializeToElement(new { reason = $"Límite de {MaxNodes} nodos alcanzado" })
                    };
                    await SendToClient(tcpClient, rejection);
                    tcpClient.Close();
                    return;
                }

                clientRecord = new Client
                {
                    id = Guid.NewGuid(),
                    name = data.Hostname ?? data.MacAddress,
                    mac = data.MacAddress,
                    Hostname = data.Hostname,
                    OS = data.OS,
                    IP = !string.IsNullOrEmpty(data.IP) ? data.IP : remoteIp,
                    Status = NodeStatus.Active,
                    LastSeen = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                };
                db.Clients.Add(clientRecord);
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("✅ Nuevo nodo registrado: {Name} ({Mac})", clientRecord.name, clientRecord.mac);
            }

            // Update node info
            clientRecord.LastSeen = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            clientRecord.Status = NodeStatus.Active;
            clientRecord.Hostname = data.Hostname ?? clientRecord.Hostname;
            clientRecord.OS = data.OS ?? clientRecord.OS;
            clientRecord.IP = !string.IsNullOrEmpty(data.IP) ? data.IP : remoteIp;

            // Calculate usage percent
            double usagePercent = data.TotalMemory > 0
                ? ((double)(data.TotalMemory - data.FreeMemory) / data.TotalMemory) * 100.0
                : 0;

            var diskLog = new DiskLog
            {
                id = Guid.NewGuid(),
                totalMemory = (int)data.TotalMemory,
                freeMemory = (int)data.FreeMemory,
                UsagePercent = Math.Round(usagePercent, 2),
                Iops = data.Iops,
                Timestamp = data.Timestamp > 0 ? data.Timestamp : DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                DriveName = data.DriveName,
                DriveType = data.DriveType,
                clientId = clientRecord.id
            };

            db.DiskLogs.Add(diskLog);
            await db.SaveChangesAsync(ct);

            // Update in-memory maps
            MacToNodeId[data.MacAddress] = clientRecord.id;
            NodeConnections[clientRecord.id] = tcpClient;
            ClientMetrics[data.MacAddress] = data;

            _logger.LogInformation("📥 Métrica de {Name}: {Used}/{Total} GB ({Pct}%) IOPS:{Iops}",
                clientRecord.name, data.TotalMemory - data.FreeMemory, data.TotalMemory,
                usagePercent.ToString("F1"), data.Iops);

            await BroadcastToWebSockets();
        }

        // ─── HANDLE ACK ─────────────────────────────────────────────────
        private async Task HandleAck(JsonElement payload, CancellationToken ct)
        {
            var ack = JsonSerializer.Deserialize<AckPayload>(payload.GetRawText());
            if (ack == null || string.IsNullOrEmpty(ack.CommandId))
            {
                _logger.LogWarning("ACK payload inválido.");
                return;
            }

            if (!Guid.TryParse(ack.CommandId, out Guid cmdId)) return;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var command = await db.Commands.FirstOrDefaultAsync(c => c.Id == cmdId, ct);
            if (command == null)
            {
                _logger.LogWarning("ACK para comando inexistente: {Id}", ack.CommandId);
                return;
            }

            command.Status = CommandStatus.Acked;

            var cmdAck = new CommandAck
            {
                Id = Guid.NewGuid(),
                CommandId = cmdId,
                AckedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                Response = ack.Response
            };

            db.CommandAcks.Add(cmdAck);
            await db.SaveChangesAsync(ct);

            _logger.LogInformation("✅ ACK recibido para comando {Id}", ack.CommandId);
        }

        // ─── SEND MESSAGE TO A SPECIFIC NODE ────────────────────────────
        public static async Task<bool> SendToNode(Guid nodeId, SocketMessage message)
        {
            if (!NodeConnections.TryGetValue(nodeId, out var tcpClient) || !tcpClient.Connected)
                return false;

            return await SendToClient(tcpClient, message);
        }

        private static async Task<bool> SendToClient(TcpClient tcpClient, SocketMessage message)
        {
            try
            {
                string json = JsonSerializer.Serialize(message);
                byte[] data = Encoding.UTF8.GetBytes(json + "\n");
                await tcpClient.GetStream().WriteAsync(data);
                return true;
            }
            catch
            {
                return false;
            }
        }

        // ─── BROADCAST TO WEBSOCKETS (for frontend) ────────────────────
        private async Task BroadcastToWebSockets()
        {
            // Build data including node status from in-memory metrics
            string jsonData = JsonSerializer.Serialize(ClientMetrics.Values);
            byte[] buffer = Encoding.UTF8.GetBytes(jsonData);

            List<WebSocket> disconnected = new();

            List<WebSocket> snapshot;
            lock (WsLock) { snapshot = new List<WebSocket>(WebSocketClients); }

            foreach (var ws in snapshot)
            {
                if (ws.State == WebSocketState.Open)
                {
                    try
                    {
                        await ws.SendAsync(new ArraySegment<byte>(buffer),
                            WebSocketMessageType.Text, true, CancellationToken.None);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("❌ WebSocket error: {Message}", ex.Message);
                        disconnected.Add(ws);
                    }
                }
                else
                {
                    disconnected.Add(ws);
                }
            }

            if (disconnected.Count > 0)
            {
                lock (WsLock)
                {
                    foreach (var ws in disconnected)
                    {
                        WebSocketClients.Remove(ws);
                        _logger.LogInformation("🛑 WebSocket eliminado de la lista.");
                    }
                }
            }
        }
    }
}
