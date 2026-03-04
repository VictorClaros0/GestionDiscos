using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace ClientApp
{
    class Client
    {
        // Shared interval — can be updated by CONFIG_UPDATE from server
        private static int _intervalSeconds = 5;
        private static readonly object _intervalLock = new();
        private static readonly Random _rng = new();
        private static string OfflineLogPath = "";
        private static string HistoryLogPath = "";

        static async Task Main()
        {
            // ─── CONFIGURATION ──────────────────────────────────────
            var config = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: true)
                .Build();

            string serverIP = config["ServerSettings:ServerIP"] ?? "localhost";
            int port = int.Parse(config["ServerSettings:ServerPort"] ?? "5000");
            _intervalSeconds = int.Parse(config["ServerSettings:IntervalSeconds"] ?? "5");
            string logPath = config["Logging:LogFilePath"] ?? "logs/client.log";

            var logDir = Path.GetDirectoryName(Path.GetFullPath(logPath)) ?? "logs";
            Directory.CreateDirectory(logDir);
            OfflineLogPath = Path.Combine(logDir, "offline_metrics.jsonl");
            HistoryLogPath = Path.Combine(logDir, "metrics_history.log");

            // ─── SERILOG ────────────────────────────────────────────
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Information()
                .WriteTo.Console()
                .WriteTo.File(logPath, rollingInterval: RollingInterval.Day)
                .CreateLogger();

            Log.Information("═══════════════════════════════════════════════");
            Log.Information("  Storage Cluster Client Iniciado");
            Log.Information("  Servidor: {IP}:{Port} | Intervalo: {Interval}s", serverIP, port, _intervalSeconds);
            Log.Information("═══════════════════════════════════════════════");

            string macAddress = GetMacAddress();
            string hostname = Environment.MachineName;
            string os = $"{Environment.OSVersion.Platform} {Environment.OSVersion.Version}";

            Log.Information("MAC: {Mac} | Host: {Host} | OS: {OS}", macAddress, hostname, os);

            // ─── RECONNECTION LOOP ──────────────────────────────────
            using var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };

            while (!cts.Token.IsCancellationRequested)
            {
                try
                {
                    using var tcpClient = new TcpClient();
                    await tcpClient.ConnectAsync(serverIP, port, cts.Token);
                    Log.Information("✅ Conectado al servidor {IP}:{Port}", serverIP, port);

                    using var stream = tcpClient.GetStream();

                    // Sincronizar métricas atrasadas antes de continuar
                    await SyncOfflineMetrics(stream, cts.Token);

                    // Run sender and listener concurrently
                    var senderTask = SendMetricsLoop(stream, macAddress, hostname, os, cts.Token);
                    var listenerTask = ListenForServerMessages(stream, cts.Token);

                    // Wait for either to finish (usually means disconnect)
                    await Task.WhenAny(senderTask, listenerTask);

                    Log.Warning("Conexión perdida con el servidor.");
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Log.Warning("No se pudo conectar a {IP}:{Port}: {Error}. Reintentando en 5s...",
                        serverIP, port, ex.Message);
                }

                if (!cts.Token.IsCancellationRequested)
                    await Task.Delay(5000, cts.Token).ConfigureAwait(false);
            }

            Log.Information("Cliente detenido.");
            await Log.CloseAndFlushAsync();
        }

        // ─── METRIC SENDER LOOP ─────────────────────────────────────
        static async Task SendMetricsLoop(NetworkStream stream, string mac, string hostname, string os, CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    // Get first ready drive
                    DriveInfo drive = DriveInfo.GetDrives().FirstOrDefault(d => d.IsReady)
                        ?? new DriveInfo("C");

                    long totalGB = drive.TotalSize / (1024L * 1024 * 1024);
                    long freeGB = drive.AvailableFreeSpace / (1024L * 1024 * 1024);
                    long usedGB = totalGB - freeGB;
                    double usagePercent = totalGB > 0 ? ((double)usedGB / totalGB) * 100.0 : 0;
                    int simulatedIops = _rng.Next(50, 500);
                    string driveName = drive.Name;
                    string driveType = drive.DriveType == DriveType.Fixed ? DetectDriveMediaType(drive) : drive.DriveType.ToString();

                    var metric = new MetricPayload
                    {
                        MacAddress = mac,
                        Hostname = hostname,
                        OS = os,
                        IP = "",
                        TotalMemory = totalGB,
                        FreeMemory = freeGB,
                        UsedMemory = usedGB,
                        UsagePercent = Math.Round(usagePercent, 2),
                        Iops = simulatedIops,
                        Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        DriveName = driveName,
                        DriveType = driveType
                    };

                    var message = new SocketMessage
                    {
                        Type = "METRIC",
                        Payload = JsonSerializer.SerializeToElement(metric)
                    };

                    string json = JsonSerializer.Serialize(message);
                    
                    try
                    {
                        byte[] data = Encoding.UTF8.GetBytes(json + "\n");
                        await stream.WriteAsync(data, ct);
                        
                        // Guardar en log histórico permanente
                        await File.AppendAllTextAsync(HistoryLogPath, json + Environment.NewLine, ct);

                        Log.Information("📤 Enviado en vivo: {Drive} ({Type}) {Used}/{Total} GB ({Pct}%) IOPS:{Iops}",
                            driveName, driveType, usedGB, totalGB, usagePercent.ToString("F1"), simulatedIops);
                    }
                    catch (Exception ex)
                    {
                        Log.Warning("Nube inaccesible ({Error}). Guardando métrica en disco offline...", ex.Message);
                        await File.AppendAllTextAsync(OfflineLogPath, json + Environment.NewLine, CancellationToken.None);
                        throw; // Burbujear error para romper el loop y forzar reconexión TCP
                    }

                    int interval;
                    lock (_intervalLock) { interval = _intervalSeconds; }
                    await Task.Delay(interval * 1000, ct);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception)
                {
                    // Romper loop para forzar el ciclo de reconexión del while principal
                    break;
                }
            }
        }

        // ─── OFFLINE SYNC ───────────────────────────────────────────
        static async Task SyncOfflineMetrics(NetworkStream stream, CancellationToken ct)
        {
            if (!File.Exists(OfflineLogPath)) return;

            var lines = await File.ReadAllLinesAsync(OfflineLogPath, ct);
            if (lines.Length == 0) return;

            Log.Information("♻️ Iniciando sincronización de {Count} métricas offline pendientes...", lines.Length);
            var unsynced = new List<string>();

            foreach (var line in lines)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                
                try
                {
                    byte[] data = Encoding.UTF8.GetBytes(line + "\n");
                    await stream.WriteAsync(data, ct);
                    
                    // Solo si llegó bien, se mueve al historial masivo
                    await File.AppendAllTextAsync(HistoryLogPath, line + Environment.NewLine, ct);
                }
                catch
                {
                    unsynced.Add(line);
                }
            }

            if (unsynced.Any())
            {
                await File.WriteAllLinesAsync(OfflineLogPath, unsynced, ct);
                Log.Warning("⚠️ Sincronización parcial. Quedan {Count} métricas pendientes.", unsynced.Count);
            }
            else
            {
                File.Delete(OfflineLogPath);
                Log.Information("✅ Sincronización completada. Todas las métricas offline subidas.");
            }
        }

        // ─── LISTENER FOR SERVER MESSAGES ───────────────────────────
        static async Task ListenForServerMessages(NetworkStream stream, CancellationToken ct)
        {
            byte[] buffer = new byte[4096];
            StringBuilder msgBuffer = new();

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, ct);
                    if (bytesRead == 0) break; // Server disconnected

                    string raw = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    msgBuffer.Append(raw);

                    // Parse complete JSON objects
                    string accumulated = msgBuffer.ToString();
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
                                await ProcessServerMessage(jsonMsg, stream);
                                msgBuffer.Clear();
                                if (i + 1 < accumulated.Length)
                                    msgBuffer.Append(accumulated.Substring(i + 1));
                                accumulated = msgBuffer.ToString();
                                i = -1;
                                msgStart = -1;
                            }
                        }
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    Log.Error("Error en listener: {Error}", ex.Message);
                    break;
                }
            }
        }

        static async Task ProcessServerMessage(string json, NetworkStream stream)
        {
            try
            {
                var message = JsonSerializer.Deserialize<SocketMessage>(json);
                if (message == null) return;

                switch (message.Type?.ToUpperInvariant())
                {
                    case "COMMAND":
                        var cmd = JsonSerializer.Deserialize<CommandPayload>(message.Payload.GetRawText());
                        if (cmd != null)
                        {
                            Log.Information("[COMMAND_LOG] 📩 COMANDO recibido [{Id}]: {Text} | Timestamp: {Time}",
                                cmd.CommandId, cmd.CommandText, DateTime.UtcNow.ToString("O"));

                            // Send ACK back to server
                            var ackMessage = new SocketMessage
                            {
                                Type = "ACK",
                                Payload = JsonSerializer.SerializeToElement(new AckPayload
                                {
                                    CommandId = cmd.CommandId,
                                    Response = "OK"
                                })
                            };
                            string ackJson = JsonSerializer.Serialize(ackMessage);
                            byte[] ackData = Encoding.UTF8.GetBytes(ackJson + "\n");
                            await stream.WriteAsync(ackData);
                            Log.Information("[COMMAND_LOG] ✅ ACK enviado para comando {Id}", cmd.CommandId);
                        }
                        break;

                    case "CONFIG_UPDATE":
                        var config = JsonSerializer.Deserialize<ConfigPayload>(message.Payload.GetRawText());
                        if (config != null && config.IntervalSeconds > 0)
                        {
                            lock (_intervalLock) { _intervalSeconds = config.IntervalSeconds; }
                            Log.Information("⚙️ CONFIG_UPDATE: Intervalo cambiado a {Interval}s", config.IntervalSeconds);
                        }
                        break;

                    case "REJECTED":
                        Log.Warning("⛔ Conexión rechazada por el servidor: {Payload}", message.Payload.GetRawText());
                        break;

                    default:
                        Log.Warning("Mensaje desconocido del servidor: {Type}", message.Type);
                        break;
                }
            }
            catch (Exception ex)
            {
                Log.Error("Error procesando mensaje del servidor: {Error}", ex.Message);
            }
        }

        // ─── UTILITY ────────────────────────────────────────────────
        static string GetMacAddress()
        {
            foreach (NetworkInterface nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus == OperationalStatus.Up &&
                    nic.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                {
                    return nic.GetPhysicalAddress().ToString();
                }
            }
            return "000000000000";
        }

        /// <summary>
        /// Detects whether the drive is SSD or HDD using a cross-platform heuristic.
        /// On Linux checks /sys/block, on Windows defaults to SSD for fixed drives.
        /// </summary>
        static string DetectDriveMediaType(DriveInfo drive)
        {
            try
            {
                if (OperatingSystem.IsLinux())
                {
                    // Try to read rotational flag from sysfs
                    string devName = drive.Name.TrimEnd('/');
                    if (devName.StartsWith("/dev/")) devName = devName.Substring(5);
                    // Strip partition number (e.g., sda1 → sda)
                    string blockDev = new string(devName.TakeWhile(c => !char.IsDigit(c)).ToArray());
                    string rotationalPath = $"/sys/block/{blockDev}/queue/rotational";
                    if (File.Exists(rotationalPath))
                    {
                        string val = File.ReadAllText(rotationalPath).Trim();
                        return val == "0" ? "SSD" : "HDD";
                    }
                }
                // Default heuristic: if drive is fixed, assume SSD (most modern servers)
                return "SSD";
            }
            catch
            {
                return "Unknown";
            }
        }
    }

    // ─── SHARED PROTOCOL CLASSES (same contract as server) ──────────
    public class SocketMessage
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }
    }

    public class MetricPayload
    {
        [JsonPropertyName("macAddress")] public string MacAddress { get; set; } = "";
        [JsonPropertyName("hostname")] public string Hostname { get; set; } = "";
        [JsonPropertyName("os")] public string OS { get; set; } = "";
        [JsonPropertyName("ip")] public string IP { get; set; } = "";
        [JsonPropertyName("totalMemory")] public long TotalMemory { get; set; }
        [JsonPropertyName("freeMemory")] public long FreeMemory { get; set; }
        [JsonPropertyName("usedMemory")] public long UsedMemory { get; set; }
        [JsonPropertyName("usagePercent")] public double UsagePercent { get; set; }
        [JsonPropertyName("iops")] public int Iops { get; set; }
        [JsonPropertyName("timestamp")] public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        [JsonPropertyName("driveName")] public string DriveName { get; set; } = "";
        [JsonPropertyName("driveType")] public string DriveType { get; set; } = "";
    }

    public class CommandPayload
    {
        [JsonPropertyName("commandId")] public string CommandId { get; set; } = "";
        [JsonPropertyName("commandText")] public string CommandText { get; set; } = "";
    }

    public class AckPayload
    {
        [JsonPropertyName("commandId")] public string CommandId { get; set; } = "";
        [JsonPropertyName("response")] public string Response { get; set; } = "OK";
    }

    public class ConfigPayload
    {
        [JsonPropertyName("intervalSeconds")] public int IntervalSeconds { get; set; }
    }
}