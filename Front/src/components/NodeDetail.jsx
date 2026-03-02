import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const NodeDetail = ({ nodes, selectedNode, onSelectNode, apiBase }) => {
    const [metrics, setMetrics] = useState([]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchMetrics = async (nodeId) => {
        if (!nodeId) return;
        setLoading(true);
        try {
            let url = `${apiBase}/api/metrics?nodeId=${nodeId}`;
            if (dateFrom) url += `&from=${new Date(dateFrom).toISOString()}`;
            if (dateTo) url += `&to=${new Date(dateTo).toISOString()}`;
            const res = await fetch(url);
            const data = await res.json();
            setMetrics(data.reverse()); // chronological order
        } catch (error) {
            console.error("Error fetching metrics:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (selectedNode) fetchMetrics(selectedNode.id);
    }, [selectedNode]);

    const handleFilter = () => {
        if (selectedNode) fetchMetrics(selectedNode.id);
    };

    const chartData = metrics.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString(),
        usagePercent: m.usagePercent,
        totalMemory: m.totalMemory,
        freeMemory: m.freeMemory,
        usedMemory: m.usedMemory,
        iops: m.iops
    }));

    return (
        <div className="glass-panel p-4">
            <h4 className="fw-bold text-dark mb-3">🔍 Detalle de Nodo</h4>

            {/* Node Selector */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <label className="form-label fw-bold text-dark">Seleccionar Nodo</label>
                    <select
                        className="form-select"
                        value={selectedNode?.id || ""}
                        onChange={(e) => {
                            const node = nodes.find(n => n.id === e.target.value);
                            onSelectNode(node || null);
                        }}
                    >
                        <option value="">-- Seleccionar --</option>
                        {nodes.map(n => (
                            <option key={n.id} value={n.id}>{n.name} ({n.hostname || n.mac})</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-3">
                    <label className="form-label fw-bold text-dark">Desde</label>
                    <input
                        type="datetime-local"
                        className="form-control"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </div>
                <div className="col-md-3">
                    <label className="form-label fw-bold text-dark">Hasta</label>
                    <input
                        type="datetime-local"
                        className="form-control"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                    <button className="btn btn-dark w-100" onClick={handleFilter}>Filtrar</button>
                </div>
            </div>

            {!selectedNode ? (
                <p className="text-muted text-center py-5">Selecciona un nodo para ver su histórico</p>
            ) : loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-dark" role="status"></div>
                </div>
            ) : metrics.length === 0 ? (
                <p className="text-muted text-center py-5">No hay métricas para este nodo en el rango seleccionado</p>
            ) : (
                <>
                    {/* Node Info Card */}
                    <div className="row mb-4">
                        <div className="col-md-6">
                            <div className="border rounded p-3 bg-white">
                                <h6 className="fw-bold">Información del Nodo</h6>
                                <p className="mb-1"><strong>Nombre:</strong> {selectedNode.name}</p>
                                <p className="mb-1"><strong>Hostname:</strong> {selectedNode.hostname || "—"}</p>
                                <p className="mb-1"><strong>IP:</strong> {selectedNode.ip || "—"}</p>
                                <p className="mb-1"><strong>OS:</strong> {selectedNode.os || "—"}</p>
                                <p className="mb-0">
                                    <strong>Estado: </strong>
                                    <span className={`badge ${selectedNode.status === "Active" ? "bg-success" : "bg-danger"}`}>
                                        {selectedNode.status === "Active" ? "UP" : "NO REPORTA"}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="border rounded p-3 bg-white">
                                <h6 className="fw-bold">Últimas Métricas</h6>
                                <p className="mb-1"><strong>Registros:</strong> {metrics.length}</p>
                                {metrics.length > 0 && (
                                    <>
                                        <p className="mb-1"><strong>Último Total:</strong> {metrics[metrics.length - 1].totalMemory} GB</p>
                                        <p className="mb-1"><strong>Último Libre:</strong> {metrics[metrics.length - 1].freeMemory} GB</p>
                                        <p className="mb-0"><strong>Último Uso:</strong> {metrics[metrics.length - 1].usagePercent}%</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Usage Percent Chart */}
                    <h6 className="fw-bold text-dark mb-2">📈 Uso de Almacenamiento (%)</h6>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px' }} />
                            <Legend />
                            <Line type="monotone" dataKey="usagePercent" stroke="#dc3545" name="% Uso" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* IOPS Chart */}
                    <h6 className="fw-bold text-dark mt-4 mb-2">⚡ IOPS</h6>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px' }} />
                            <Bar dataKey="iops" fill="#333" radius={[4, 4, 0, 0]} barSize={20} name="IOPS" />
                        </BarChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
};

export default NodeDetail;
