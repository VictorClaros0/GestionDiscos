# Storage Cluster Monitoreado – Proyecto Sockets

Sistema de monitoreo de almacenamiento en cluster compuesto por tres componentes que trabajan en conjunto para recopilar, almacenar y visualizar métricas de disco de hasta 9 nodos en tiempo real, con comunicación **bidireccional** por TCP.

---

## Arquitectura

```
┌──────────────┐    TCP :5000     ┌──────────────────────┐    HTTP :5042    ┌─────────────┐
│  Cliente(s)  │ ◄──────────────► │  Servidor .NET       │ ◄─────────────► │  Frontend   │
│  (.NET 8)    │   METRIC/ACK/   │  (ASP.NET Core API)  │   REST API      │  (React 19) │
│  Hasta 9     │   COMMAND/      │  + BackgroundService  │                 │  + Vite     │
└──────────────┘   CONFIG_UPDATE  │  + SQL Server (EF)   │    WS :8080     │  + Recharts │
                                  └──────────────────────┘ ──────────────► └─────────────┘
```

---

## 1. Servidor (`SocketsProof/`)

- **Tecnología**: ASP.NET Core 8 Web API + Entity Framework Core 9 + SQL Server
- **TCP Bidireccional** (puerto 5000):
  - Recibe mensajes `METRIC` con métricas de disco
  - Envía `COMMAND` y `CONFIG_UPDATE` a los clientes
  - Recibe `ACK` de confirmación
- **Auto-registro**: Clientes nuevos se registran automáticamente (hasta 9)
- **Detección "No Reporta"**: BackgroundService (`NodeHealthChecker`) marca nodos inactivos después de 30s
- **WebSocket** (puerto 8080): Broadcast de métricas al frontend
- **API REST** (puerto 5042):
  - `GET /api/nodes` — Lista de nodos con estado
  - `GET /api/cluster/summary` — Resumen agregado del cluster
  - `GET /api/metrics?nodeId=X&from=Y&to=Z` — Métricas con filtros
  - `POST /api/commands` — Enviar comando a un nodo
  - `GET /api/commands?nodeId=X` — Historial de comandos
  - `POST /api/config/interval` — Cambiar intervalo de envío

### Cómo correr el servidor

```bash
cd SocketsProof/SocketsProof
dotnet run
```

> Requiere SQL Server con la base de datos `SocketsDb`. Conexión configurable en `appsettings.json`.

---

## 2. Cliente (`SocketsClient/Sockets/Client/`)

- **Tecnología**: .NET 8 Console App + Serilog
- **Métricas**: Envía periódicamente Total/Used/Free del primer disco listo + IOPS simulado
- **Bidireccional**: Hilo listener recibe `COMMAND` (y envía `ACK`) y `CONFIG_UPDATE` (cambia intervalo en caliente)
- **Reconexión automática** ante caída del servidor
- **Configuración**: `appsettings.json` (IP, puerto, intervalo, ruta de log)
- **Logs**: Serilog a consola y archivo (`logs/client.log`)

### Cómo correr el cliente

```bash
cd SocketsClient/Sockets/Client
dotnet run
```

> Editar `appsettings.json` para apuntar al IP del servidor si no es `localhost`.

---

## 3. Frontend (`Front/`)

- **Tecnología**: React 19 + Vite + Bootstrap 5 + Recharts
- **Dashboard**: Cards de resumen del cluster + tabla de 9 nodos con indicador UP / NO REPORTA
- **Auto-Refresh**: Selector configurable (5/10/30/60 segundos)
- **Detalle de Nodo**: Histórico de métricas con filtro por rango de fechas, gráfico de uso % y IOPS
- **Panel de Comandos**: Enviar comandos a nodos, ver historial con estado (Sent/Acked/Timeout)
- **Configuración**: Cambiar intervalo de envío de métricas por nodo

### Cómo correr el frontend

```bash
cd Front
npm install
npm run dev
```

---

## 4. Base de Datos (SQL Server)

- **Archivo de respaldo**: `SocketsDb (1).bak`
- **Tablas**:
  - `Client` — Nodos registrados (id, name, mac, Hostname, OS, IP, Status, LastSeen)
  - `DiskLog` — Métricas de disco (totalMemory, freeMemory, UsagePercent, Iops, Timestamp)
  - `Commands` — Comandos enviados (CommandText, Status: Sent/Acked/Timeout, SentAt)
  - `CommandAcks` — Confirmaciones de comandos (AckedAt, Response)
- **Índices**: `(clientId, Timestamp)` en DiskLog, `LastSeen` en Client, `mac` único en Client

### Configuración de SQL Server

1. Restaurar `SocketsDb (1).bak` o crear la BD y aplicar migraciones:
   ```bash
   cd SocketsProof/SocketsProof
   dotnet ef database update
   ```
2. Verificar la cadena de conexión en `appsettings.json`:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=localhost;Database=SocketsDb;TrustServerCertificate=True;Trusted_Connection=True"
   }
   ```

---

## Protocolo de Comunicación (JSON sobre TCP)

Todos los mensajes siguen el formato envelope:

```json
{
  "type": "METRIC | COMMAND | ACK | CONFIG_UPDATE",
  "payload": { ... }
}
```

| Tipo            | Dirección          | Payload                                                                                    |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `METRIC`        | Cliente → Servidor | `{ macAddress, hostname, os, ip, totalMemory, freeMemory, usagePercent, iops, timestamp }` |
| `COMMAND`       | Servidor → Cliente | `{ commandId, commandText }`                                                               |
| `ACK`           | Cliente → Servidor | `{ commandId, response }`                                                                  |
| `CONFIG_UPDATE` | Servidor → Cliente | `{ intervalSeconds }`                                                                      |
