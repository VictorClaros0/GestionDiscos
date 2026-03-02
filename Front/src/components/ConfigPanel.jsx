import { useState } from "react";
import { FaCog } from "react-icons/fa";

const ConfigPanel = ({ nodes, apiBase }) => {
    const [selectedNodeId, setSelectedNodeId] = useState("");
    const [intervalSeconds, setIntervalSeconds] = useState(5);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    const handleChangeInterval = async () => {
        if (!selectedNodeId || intervalSeconds < 1) return;
        setSending(true);
        setResult(null);
        try {
            const res = await fetch(`${apiBase}/api/config/interval`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nodeId: selectedNodeId,
                    intervalSeconds: intervalSeconds
                })
            });
            const data = await res.json();
            if (res.ok) {
                setResult({ success: true, message: `✅ Intervalo cambiado a ${intervalSeconds}s para ${data.nodeName}` });
            } else {
                setResult({ success: false, message: `❌ ${data.error || "Error desconocido"}` });
            }
        } catch (error) {
            setResult({ success: false, message: `❌ Error de conexión: ${error.message}` });
        }
        setSending(false);
    };

    return (
        <div className="glass-panel p-4">
            <h4 className="fw-bold text-dark mb-3"><FaCog className="me-2" /> Configuración de Nodos</h4>

            <div className="border rounded p-4 bg-white" style={{ maxWidth: '600px' }}>
                <h6 className="fw-bold mb-3">Cambiar Intervalo de Envío</h6>
                <p className="text-muted small mb-3">
                    Envía un <code>CONFIG_UPDATE</code> al cliente para que cambie su frecuencia de envío de métricas.
                </p>

                <div className="mb-3">
                    <label className="form-label fw-bold">Nodo</label>
                    <select
                        className="form-select"
                        value={selectedNodeId}
                        onChange={(e) => setSelectedNodeId(e.target.value)}
                    >
                        <option value="">-- Seleccionar Nodo --</option>
                        {nodes.filter(n => n.status === "Active").map(n => (
                            <option key={n.id} value={n.id}>{n.name} ({n.hostname || n.mac})</option>
                        ))}
                    </select>
                </div>

                <div className="mb-3">
                    <label className="form-label fw-bold">Intervalo (segundos)</label>
                    <div className="d-flex gap-2 align-items-center">
                        <input
                            type="range"
                            className="form-range flex-grow-1"
                            min="1"
                            max="120"
                            value={intervalSeconds}
                            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                        />
                        <span className="badge bg-dark fs-6" style={{ minWidth: '50px' }}>
                            {intervalSeconds}s
                        </span>
                    </div>
                    <div className="d-flex justify-content-between text-muted small mt-1">
                        <span>1s</span>
                        <span>30s</span>
                        <span>60s</span>
                        <span>120s</span>
                    </div>
                </div>

                <button
                    className="btn btn-dark w-100"
                    onClick={handleChangeInterval}
                    disabled={sending || !selectedNodeId}
                >
                    {sending ? (
                        <span className="spinner-border spinner-border-sm"></span>
                    ) : (
                        "Aplicar CONFIG_UPDATE"
                    )}
                </button>

                {result && (
                    <div className={`alert ${result.success ? "alert-success" : "alert-danger"} mt-3 mb-0`}>
                        {result.message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfigPanel;
