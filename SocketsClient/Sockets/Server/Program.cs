using ClientApp;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Data.SqlClient;
class Server
{
    static string connectionString = "Server=localhost;Database=SocketsDb;TrustServerCertificate=True;Trusted_Connection=True";
    private static readonly ConcurrentDictionary<string, ClientData> Clients = new();
    private static readonly List<WebSocket> WebSocketClients = new();
    private const int TcpPort = 5000;
    private const int WsPort = 8080;
    static void SaveIndataBase(ClientData data)
    {
        try
        {
            using (SqlConnection connection = new SqlConnection(connectionString))
            {
                connection.Open();
                string query = "INSERT INTO DiskLog (totalMemory, freeMemory,clientId) VALUES (@totalMemory, @freeMemory,(SELECT id FROM Client WHERE mac = @mac))";

                using (SqlCommand command = new SqlCommand(query, connection))
                {
                    command.Parameters.AddWithValue("@mac", data.macAddress);
                    command.Parameters.AddWithValue("@totalMemory", data.totalMemory);
                    command.Parameters.AddWithValue("@freeMemory", data.freeMemory);

                    command.ExecuteNonQuery();
                    Console.WriteLine("Datos almacenados en SQL Server.");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error al guardar en SQL Server: {ex.Message}");
        }
    }
    static async Task Main()
    {
        Console.WriteLine("Iniciando servidor...");
        await StartServer();
    }
    public static async Task StartServer()
    {
        Task.Run(StartTcpListener);
        await StartWebSocketServer();
    }

    private static async Task StartTcpListener()
    {
        TcpListener listener = new TcpListener(IPAddress.Any, TcpPort);
        listener.Start();
        Console.WriteLine($"Servidor TCP escuchando en {TcpPort}...");

        while (true)
        {
            TcpClient client = await listener.AcceptTcpClientAsync();
            _ = Task.Run(() => HandleTcpClient(client));
        }
    }
    private static async Task StartWebSocketServer()
    {
        HttpListener listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{WsPort}/");
        listener.Start();
        Console.WriteLine($"Servidor WebSocket en {WsPort}...");

        while (true)
        {
            HttpListenerContext context = await listener.GetContextAsync();
            if (context.Request.IsWebSocketRequest)
            {
                HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
                WebSocket webSocket = webSocketContext.WebSocket;
                WebSocketClients.Add(webSocket);
                Console.WriteLine("Cliente WebSocket conectado.");
                await BroadcastToWebSockets();
            }
            else
            {
                context.Response.StatusCode = 400;
                context.Response.Close();
            }
        }
    }
    private static async Task HandleTcpClient(TcpClient client)
    {
        using NetworkStream stream = client.GetStream();
        byte[] buffer = new byte[1024];

        while (true)
        {
            int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length);
            if (bytesRead == 0) break;

            string message = Encoding.UTF8.GetString(buffer, 0, bytesRead);
            ClientData? dataObject = JsonSerializer.Deserialize<ClientData>(message);

            if (dataObject != null && dataObject.macAddress != null)
            {
                Clients[dataObject.macAddress] = dataObject;
                SaveIndataBase(dataObject);
                Console.WriteLine($"📥 Recibido de {dataObject.macAddress}: {dataObject.freeMemory}GB libres, {dataObject.totalMemory}GB totales");
                await BroadcastToWebSockets();
            }
        }
    }
    private static async Task BroadcastToWebSockets()
    {
        string jsonData = JsonSerializer.Serialize(Clients.Values);
        byte[] buffer = Encoding.UTF8.GetBytes(jsonData);

        List<WebSocket> disconnectedClients = new List<WebSocket>();

        foreach (var ws in WebSocketClients)
        {
            if (ws.State == WebSocketState.Open)
            {
                try
                {
                    await ws.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ WebSocket error: {ex.Message}");
                    disconnectedClients.Add(ws);
                }
            }
            else
            {
                disconnectedClients.Add(ws);
            }
        }

        // Removemos los WebSockets desconectados de la lista principal
        foreach (var ws in disconnectedClients)
        {
            WebSocketClients.Remove(ws);
            Console.WriteLine("🛑 WebSocket eliminado de la lista.");
        }
    }
    
}

