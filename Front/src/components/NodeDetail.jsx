import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { FaHdd, FaChartLine, FaBolt } from "react-icons/fa";

const epochToLocal = (epoch) => {
    if (!epoch) return "—";
    return new Date(epoch * 1000).toLocaleString();
};

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
            if (dateFrom) url += `&from=${Math.floor(new Date(dateFrom).getTime() / 1000)}`;
            if (dateTo) url += `&to=${Math.floor(new Date(dateTo).getTime() / 1000)}`;
            const res = await fetch(url);
            const data = await res.json();
            setMetrics(data.reverse());
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
        time: m.timestampEpoch ? new Date(m.timestampEpoch * 1000).toLocaleTimeString() : new Date(m.timestamp * 1000).toLocaleTimeString(),
        usagePercent: m.usagePercent,
        totalMemory: m.totalMemory,
        freeMemory: m.freeMemory,
        usedMemory: m.usedMemory,
        iops: m.iops
    }));

    // Gauge component for usage %
    const UsageGauge = ({ percent }) => {
        const radius = 60;
        const circumference = Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        const color = percent > 80 ? "#ef4444" : percent > 60 ? "#f59e0b" : "#22c55e";

        return (
            <svg width="160" height="100" viewBox="0 0 160 100">
                {/* Background arc */}
                <path
                    d="M 20 90 A 60 60 0 0 1 140 90"
                    fill="none"
                    stroke="rgba(55, 75, 130, 0.25)"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
                {/* Value arc */}
                <path
                    d="M 20 90 A 60 60 0 0 1 140 90"
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.3s ease", filter: `drop-shadow(0 0 6px ${color})` }}
                />
                <text x="80" y="78" textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="JetBrains Mono">
                    {percent}%
                </text>
                <text x="80" y="95" textAnchor="middle" fill="#8892a8" fontSize="9" fontWeight="600" letterSpacing="1">
                    UTILIZACIÓN
                </text>
            </svg>
        );
    };

    return (
        <div className="glass-panel p-4">
            <h5 className="fw-bold mb-3" style={{ color: "var(--text-secondary)", fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase" }}>
                <FaHdd className="me-2" style={{ color: "var(--accent-cyan)" }} /> Detalle de Nodo
            </h5>

            {/* Node Selector */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <label className="form-label">Seleccionar Nodo</label>
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
                    <label className="form-label">Desde</label>
                    <input
                        type="datetime-local"
                        className="form-control"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Hasta</label>
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
                <p className="text-center py-5" style={{ color: "var(--text-muted)" }}>Selecciona un nodo para ver su histórico</p>
            ) : loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border" role="status"></div>
                </div>
            ) : metrics.length === 0 ? (
                <p className="text-center py-5" style={{ color: "var(--text-muted)" }}>No hay métricas para este nodo en el rango seleccionado</p>
            ) : (
                <>
                    {/* Node Info + Gauge */}
                    <div className="row mb-4 g-3">
                        <div className="col-md-4">
                            <div className="info-box">
                                <h6 className="fw-bold mb-3" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Información del Nodo
                                </h6>
                                <p className="mb-1"><strong>Nombre:</strong> {selectedNode.name}</p>
                                <p className="mb-1"><strong>Hostname:</strong> {selectedNode.hostname || "—"}</p>
                                <p className="mb-1"><strong>IP:</strong> <code>{selectedNode.ip || "—"}</code></p>
                                <p className="mb-1"><strong>OS:</strong> {selectedNode.os || "—"}</p>
                                <p className="mb-1"><strong>Disco:</strong> {metrics.length > 0 ? (metrics[metrics.length - 1].driveName || "—") : "—"}</p>
                                <p className="mb-1"><strong>Tipo:</strong> {metrics.length > 0 ? (metrics[metrics.length - 1].driveType || "—") : "—"}</p>
                                <p className="mb-0">
                                    <strong>Estado: </strong>
                                    <span className={`badge ${selectedNode.status === "Active" ? "bg-success" : "bg-danger"}`}>
                                        {selectedNode.status === "Active" ? "UP" : "NO REPORTA"}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="col-md-4 d-flex align-items-center justify-content-center">
                            <UsageGauge percent={metrics.length > 0 ? metrics[metrics.length - 1].usagePercent : 0} />
                        </div>
                        <div className="col-md-4">
                            <div className="info-box">
                                <h6 className="fw-bold mb-3" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Últimas Métricas
                                </h6>
                                <p className="mb-1"><strong>Registros:</strong> <span style={{ fontFamily: "JetBrains Mono" }}>{metrics.length}</span></p>
                                {metrics.length > 0 && (
                                    <>
                                        <p className="mb-1"><strong>Total:</strong> <span style={{ fontFamily: "JetBrains Mono", color: "var(--accent-cyan)" }}>{metrics[metrics.length - 1].totalMemory} GB</span></p>
                                        <p className="mb-1"><strong>Libre:</strong> <span style={{ fontFamily: "JetBrains Mono", color: "var(--accent-green)" }}>{metrics[metrics.length - 1].freeMemory} GB</span></p>
                                        <p className="mb-1"><strong>% Uso:</strong> <span style={{ fontFamily: "JetBrains Mono", color: "var(--accent-orange)" }}>{metrics[metrics.length - 1].usagePercent}%</span></p>
                                        <p className="mb-0">
                                            <strong>Último reporte:</strong>
                                            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                                {" "}{epochToLocal(metrics[metrics.length - 1].timestampEpoch)}
                                            </span>
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Usage Percent Chart */}
                    <h6 className="fw-bold mb-2" style={{ color: "var(--text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <FaChartLine className="me-2" style={{ color: "var(--accent-red)" }} /> Uso de Almacenamiento (%)
                    </h6>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,75,130,0.2)" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#8892a8" }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8892a8" }} />
                            <Tooltip contentStyle={{ background: "rgba(15,20,40,0.95)", border: "1px solid rgba(55,75,130,0.3)", borderRadius: "8px", color: "#e8ecf4" }} />
                            <Legend />
                            <Area type="monotone" dataKey="usagePercent" stroke="#ef4444" fill="url(#usageGrad)" name="% Uso" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>

                    {/* IOPS Chart */}
                    <h6 className="fw-bold mt-4 mb-2" style={{ color: "var(--text-secondary)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <FaBolt className="me-2" style={{ color: "var(--accent-orange)" }} /> IOPS
                    </h6>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,75,130,0.2)" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#8892a8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#8892a8" }} />
                            <Tooltip contentStyle={{ background: "rgba(15,20,40,0.95)", border: "1px solid rgba(55,75,130,0.3)", borderRadius: "8px", color: "#e8ecf4" }} />
                            <Bar dataKey="iops" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} barSize={16} name="IOPS" />
                        </BarChart>
                    </ResponsiveContainer>
                </>
            )}
        </div>
    );
};

export default NodeDetail;
