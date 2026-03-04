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

    // Preset intervals
    const presets = [1, 5, 10, 15, 30, 60];

    return (
        <div className="glass-panel p-4">
            <h5 className="fw-bold mb-3" style={{ color: "var(--text-secondary)", fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase" }}>
                <FaCog className="me-2" style={{ color: "var(--accent-cyan)" }} /> Configuración de Nodos
            </h5>

            <div className="info-box" style={{ maxWidth: '650px' }}>
                <h6 className="fw-bold mb-2" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Cambiar Intervalo de Envío
                </h6>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }} className="mb-3">
                    Envía un <code>CONFIG_UPDATE</code> al cliente vía TCP para cambiar la frecuencia de envío de métricas en tiempo real.
                </p>

                <div className="mb-3">
                    <label className="form-label">Nodo</label>
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
                    <label className="form-label">Intervalo (segundos)</label>
                    {/* Preset buttons */}
                    <div className="d-flex gap-2 mb-2 flex-wrap">
                        {presets.map(p => (
                            <button
                                key={p}
                                className={`quick-cmd-btn ${intervalSeconds === p ? 'active' : ''}`}
                                style={intervalSeconds === p ? {
                                    background: "rgba(0,180,255,0.15)",
                                    borderColor: "var(--accent-cyan)",
                                    color: "var(--accent-cyan)"
                                } : {}}
                                onClick={() => setIntervalSeconds(p)}
                            >
                                {p}s
                            </button>
                        ))}
                    </div>
                    <div className="d-flex gap-3 align-items-center">
                        <input
                            type="range"
                            className="form-range flex-grow-1"
                            min="1"
                            max="120"
                            value={intervalSeconds}
                            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                        />
                        <span style={{
                            fontFamily: "JetBrains Mono",
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "var(--accent-cyan)",
                            minWidth: "50px",
                            textAlign: "center"
                        }}>
                            {intervalSeconds}s
                        </span>
                    </div>
                    <div className="d-flex justify-content-between mt-1" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
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
                        <>
                            <FaCog className="me-2" />
                            Aplicar CONFIG_UPDATE
                        </>
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
