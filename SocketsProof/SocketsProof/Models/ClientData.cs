using System.Text.Json;
using System.Text.Json.Serialization;

namespace SocketsProof.Models
{
    /// <summary>
    /// Envelope for all TCP communication between client and server.
    /// The 'type' field determines how 'payload' is deserialized.
    /// </summary>
    public class SocketMessage
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }
    }

    /// <summary>
    /// Payload sent by the client with disk metrics.
    /// </summary>
    public class MetricPayload
    {
        [JsonPropertyName("macAddress")]
        public string MacAddress { get; set; } = string.Empty;

        [JsonPropertyName("hostname")]
        public string Hostname { get; set; } = string.Empty;

        [JsonPropertyName("os")]
        public string OS { get; set; } = string.Empty;

        [JsonPropertyName("ip")]
        public string IP { get; set; } = string.Empty;

        [JsonPropertyName("totalMemory")]
        public long TotalMemory { get; set; }

        [JsonPropertyName("freeMemory")]
        public long FreeMemory { get; set; }

        [JsonPropertyName("usedMemory")]
        public long UsedMemory { get; set; }

        [JsonPropertyName("usagePercent")]
        public double UsagePercent { get; set; }

        [JsonPropertyName("iops")]
        public int Iops { get; set; }

        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        [JsonPropertyName("driveName")]
        public string DriveName { get; set; } = string.Empty;

        [JsonPropertyName("driveType")]
        public string DriveType { get; set; } = string.Empty;
    }

    /// <summary>
    /// Payload for a command sent from server to client.
    /// </summary>
    public class CommandPayload
    {
        [JsonPropertyName("commandId")]
        public string CommandId { get; set; } = string.Empty;

        [JsonPropertyName("commandText")]
        public string CommandText { get; set; } = string.Empty;
    }

    /// <summary>
    /// Payload for an ACK sent from client back to server.
    /// </summary>
    public class AckPayload
    {
        [JsonPropertyName("commandId")]
        public string CommandId { get; set; } = string.Empty;

        [JsonPropertyName("response")]
        public string Response { get; set; } = "OK";
    }

    /// <summary>
    /// Payload for a CONFIG_UPDATE sent from server to client.
    /// </summary>
    public class ConfigPayload
    {
        [JsonPropertyName("intervalSeconds")]
        public int IntervalSeconds { get; set; }
    }
}
