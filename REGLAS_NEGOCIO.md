# Reglas de Negocio del Sistema — Storage Cluster Monitoreado

## 1. Reglas de Conexión y Registro (Nodos)

### 1.1 Límite de Nodos (Capacidad del Cluster)

- **Regla:** El sistema está diseñado para manejar un máximo estricto de **9 clientes (nodos)** registrados en la base de datos de manera concurrente.
- **Caso de exceso:** Si un décimo (10º) cliente intenta registrarse, el servidor TCP **rechaza** la conexión enviando un mensaje tipo `REJECTED` (con el motivo "Límite de 9 nodos alcanzado") y cierra el socket inmediatamente.
- **Identidad única:** Un nodo se identifica y se diferencia de los demás _exclusivamente_ por su dirección física (**MAC Address**). Si cambia la IP pero la MAC es la misma, se considera el mismo nodo.

### 1.2 Auto-registro del Cliente

- **Regla:** No existe un proceso manual para dar de alta un servidor regional.
- **Comportamiento:** Cuando un cliente se conecta por primera vez y envía su primer `METRIC` válido, el servidor verifica su MAC. Si no existe, lo **crea automáticamente** en la tabla `Client` guardando su IP actual, Hostname y Sistema Operativo, marcándolo como `Active`.

## 2. Reglas de Transmisión de Métricas y Estado

### 2.1 Regla del "Primer Disco"

- **Regla:** El agente cliente _no_ reporta la suma de todos los discos de la máquina ni un disco en particular por letra harcodeada.
- **Comportamiento:** El cliente escanea las unidades de almacenamiento lógico y extrae las métricas (Total, Free, Used) **exclusivamente de la primera unidad que reporta estar lista (`IsReady = true`)**. Si el sistema operativo reserva discos fragmentados o inaccesibles temporalmente, se ignoran.

### 2.2 Política de Estado "UP / NO REPORTA" (Heartbeat)

- **Regla:** El servidor asume que un nodo está Activo (`UP`) basándose en una "última vez visto" (`LastSeen`).
- **Límite de gracia (Threshold):** El sistema tiene un umbral configurado por defecto en **30 segundos**.
- **Comportamiento ante desconexión:** Si el servidor central (mediante el `NodeHealthChecker`) detecta que han pasado más de 30 segundos sin recibir un mensaje `METRIC` válido de un nodo previamente `Active`, su estado en la base de datos cambia irrevocablemente a `NoReporta` (`DOWN`).
- **Implicación en Dashboard:** El nodo NO desaparece de la topología ni de la tabla. Se mantiene visible pero marcado en rojo (Alerta `DOWN`).

## 3. Comportamiento en Escenarios de Falla de Red (Cortes de Internet)

### 3.1 Caída de red lógica de lado del Cliente

- **Regla:** El cliente asume que puede haber latencia, cortes de ISP, o reinicios del servidor.
- **Reconexión con Backoff:** Si el cliente intenta escribir por TCP y falla (o el socket se rompe abruptamente), entra en un loop de reconexión.
  - Intentará reconectarse indefinidamente _sin crashear_.
  - **Buffering Offline:** Si no logra enviar la métrica en su ciclo, esa lectura **se guarda temporalmente en el archivo local `offline_metrics.jsonl`**. Esto asegura que los datos críticos generados durante el corte de red no se pierdan.

### 3.2 Sincronización Post-Corte (Data Sync)

- **Regla:** Ninguna métrica generada sin internet debe perderse.
- **Comportamiento:** Justo después de que el socket TCP cliente se reconecta exitosamente al Servidor Central, el cliente lee todo su buffer de `offline_metrics.jsonl` y envía el lote completo de métricas atrasadas de golpe.
- Al vaciar exitosamente el buffer offline, el cliente retoma su envío `En Vivo`. Dado que las métricas offline mantuvieron su _Timestamp_ original, las gráficas en el central se pintarán retroactivamente de manera perfecta.

### 3.3 Cliente se Reconecta tras un "Corte Largo"

- **Escenario:** El cable de red de un nodo se desconecta durante 5 minutos.
- **Regla (Back-end):** A los 30 segundos, el servidor lo marca como `NoReporta`.
- **Regla (Recovery):** Cuando vuelve el internet tras 5 minutos, el cliente sincroniza su buffer offline, el servidor reconoce la MAC, actualiza la IP (por si cambió por DHCP), actualiza el `LastSeen` basándose en el tiempo Epoch actual y lo **regresa automáticamente** al estado `Active`. Sin intervención humana.

### 3.4 Caída estrepitosa del Servidor Central

- **Regla:** Si el servicio central (.NET Backend) hace crash o se apaga intencionalmente.
- **Comportamiento Cliente:** Todos los 9 clientes perderán el socket TCP y pasarán silenciosamente a estado "Polling de reconexión", esperando a que el servidor vuelva a estar online en el mismo puerto (5000).
- **Comportamiento Dashboard:** El dashboard React intentará hacer polling al API REST/WebSocket. Al fallar la conexión HTTP, no limpiará los datos visuales, sino que mostrará un status de error ("Conectando al servidor...").

## 4. Reglas Bidireccionales (Comandos y Configuraciones)

### 4.1 Comandos Diferidos VS En Tiempo Real

- **Regla:** Los comandos se envían en caliente. Si se envía un `COMMAND` a un nodo que está `Active`, el comando viaja inmediatamente por el socket TCP abierto.
- **Corte de energía en el tránsito:** Si el comando se envía (`Status: Sent`), pero el cliente pierde internet un milisegundo antes de procesarlo, el servidor nunca recibirá el `ACK`.
- **Efecto visual:** El dashboard mostrará el comando eternamente en estado `Sent` (o `Timeout` temporal). _Los comandos perdidos no se encolan para reenviarse cuando el cliente vuelva._ (Es fire-and-forget con acuse).

### 4.2 Respuestas (ACK) Asíncronas

- **Regla:** La confirmación de que un comando fue ejecutado por el servidor regional viene dada exclusivamente por la recepción asíncrona de un mensaje `ACK`.
- **Persistencia:** Todo `ACK` recibido consolida el ciclo vital de un comando y lo asienta de forma inmutable en la tabla `CommandAcks`.

### 4.3 Configuración en Caliente (Hot-Reload)

- **Regla:** Al enviar un mensaje `CONFIG_UPDATE` desde el Dashboard a un nodo, el cliente reconfigura su propio temporizador/Timer **sin reiniciarse**.
- Si un cliente tiene su reporte seteado cada 5 segundos y se le envía un requerimiento de bajar la latencia a redes lentas (ej. cambiar a 60 segundos), el Timer interno se re-instancia aplicando la nueva métrica al instante.

## 5. Retención de Datos

### 5.1 Política de Archivo Local (Cliente)

- **Historial de Sistema (Logs):** El cliente guarda en su propio disco (en el archivo `logs/client.log` configurado en `Serilog`) los eventos locales. Se usan políticas de rotado de logs por día.
- **Historial de Métricas Emitidas:** Adicional a las métricas del servidor, cada vez que el cliente asegura que una métrica fue entregada con éxito a nivel TCP (ya sea en vivo o por sincronización post-corte), anexa una copia en un archivo continuo local `logs/metrics_history.log`. Esto sirve como bitácora física de auditoría interna.

### 5.2 Retención Centralizada BD (Servidor)

- **Regla:** El appsettings define en días el límite moral de métricas (`"RetentionDays": 30`). Los datos de monitoreo más viejos pierden granularidad y son candidatos a purgarse de las tablas de `DiskLog` porque almacenan eventos cada 5 segundos, lo cual multiplicaría excesivamente el volumen de lectura transaccional SQL.

## 6. Sincronización de Tiempo Universal (Epoch)

### 6.1 Problema de los Husos Horarios Lógicos

- **Regla:** Los clientes regionales y el servidor central **NUNCA** intercambian timestamps en formato de Fechas ISO Estándar (`2026-03-04T10:00:00`).
- **Comportamiento:** Para evitar desfasajes catastróficos por diferencia horaria entre departamentos, o relojes biológicos de latencia, todas las tres capas técnicas (Dashboard Web, Servidor SQL / TCP y Clientes) operan usando **Unix Epoch Timestamps (segundos transcurridos desde 1970)**.
- **Conversión Humana:** El `Timestamp` se guarda nativamente como `long` (bigint) y solamente es traducido a una hora local de zona legible en microsegundos dentro de la UI de React.

