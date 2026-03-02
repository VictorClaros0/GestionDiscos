import { useEffect, useState, useCallback } from "react";
import { FaPaperPlane, FaSync } from "react-icons/fa";

const CommandPanel = ({ nodes, apiBase }) => {
    const [selectedNodeId, setSelectedNodeId] = useState("");
    const [commandText, setCommandText] = useState("");
    const [commands, setCommands] = useState([]);
    const [sending, setSending] = useState(false);
    const [filterNodeId, setFilterNodeId] = useState("");

    const fetchCommands = useCallback(async () => {
        try {
            let url = `${apiBase}/api/commands`;
            if (filterNodeId) url += `?nodeId=${filterNodeId}`;
            const res = await fetch(url);
            const data = await res.json();
            setCommands(data);
        } catch (error) {
            console.error("Error fetching commands:", error);
        }
    }, [apiBase, filterNodeId]);

    useEffect(() => {
        fetchCommands();
        const interval = setInterval(fetchCommands, 5000);
        return () => clearInterval(interval);
    }, [fetchCommands]);

    const handleSend = async () => {
        if (!selectedNodeId || !commandText.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`${apiBase}/api/commands`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nodeId: selectedNodeId,
                    commandText: commandText.trim()
                })
            });
            if (res.ok) {
                setCommandText("");
                fetchCommands();
            }
        } catch (error) {
            console.error("Error sending command:", error);
        }
        setSending(false);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "Sent": return <span className="badge bg-warning text-dark">⏳ Sent</span>;
            case "Acked": return <span className="badge bg-success">✅ Acked</span>;
            case "Timeout": return <span className="badge bg-danger">⏱️ Timeout</span>;
            default: return <span className="badge bg-secondary">{status}</span>;
        }
    };

    return (
        <div className="glass-panel p-4">
            <h4 className="fw-bold text-dark mb-3">💻 Panel de Comandos</h4>

            {/* Send Command */}
            <div className="border rounded p-3 bg-white mb-4">
                <h6 className="fw-bold mb-3">Enviar Comando</h6>
                <div className="row g-3">
                    <div className="col-md-4">
                        <label className="form-label fw-bold small">Nodo Destino</label>
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
                    <div className="col-md-6">
                        <label className="form-label fw-bold small">Comando</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Ej: ipconfig, systeminfo, dir..."
                            value={commandText}
                            onChange={(e) => setCommandText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                        <button
                            className="btn btn-dark w-100"
                            onClick={handleSend}
                            disabled={sending || !selectedNodeId || !commandText.trim()}
                        >
                            {sending ? (
                                <span className="spinner-border spinner-border-sm"></span>
                            ) : (
                                <><FaPaperPlane className="me-1" /> Enviar</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Command History */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-dark m-0">Historial de Comandos</h6>
                <div className="d-flex gap-2 align-items-center">
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '200px' }}
                        value={filterNodeId}
                        onChange={(e) => setFilterNodeId(e.target.value)}
                    >
                        <option value="">Todos los nodos</option>
                        {nodes.map(n => (
                            <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                    </select>
                    <button className="btn btn-sm btn-outline-dark" onClick={fetchCommands}>
                        <FaSync />
                    </button>
                </div>
            </div>

            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr className="text-dark">
                            <th>Estado</th>
                            <th>Comando</th>
                            <th>Nodo</th>
                            <th>Enviado</th>
                            <th>ACK</th>
                            <th>Respuesta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commands.length === 0 ? (
                            <tr><td colSpan="6" className="text-center text-muted py-4">No hay comandos</td></tr>
                        ) : (
                            commands.map((cmd) => {
                                const nodeName = nodes.find(n => n.id === cmd.nodeId)?.name || cmd.nodeId;
                                return (
                                    <tr key={cmd.id}>
                                        <td>{getStatusBadge(cmd.status)}</td>
                                        <td><code>{cmd.commandText}</code></td>
                                        <td>{nodeName}</td>
                                        <td className="small">{new Date(cmd.sentAt).toLocaleString()}</td>
                                        <td className="small">{cmd.ackedAt ? new Date(cmd.ackedAt).toLocaleString() : "—"}</td>
                                        <td className="small">{cmd.ackResponse || "—"}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CommandPanel;
