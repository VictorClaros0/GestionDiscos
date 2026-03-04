import { useEffect, useState, useCallback } from "react";
import { FaServer, FaExclamationTriangle, FaCheckCircle, FaNetworkWired, FaHdd, FaTachometerAlt, FaClock } from "react-icons/fa";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import NodeDetail from "./components/NodeDetail";
import CommandPanel from "./components/CommandPanel";
import ConfigPanel from "./components/ConfigPanel";
import Histogram from "./assets/Histogram";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5042";
const MAX_DEVICES = 9;

/* ─── EPOCH UTILITIES ─────────────────────────────────────
   All timestamps from the API include both ISO and epoch (Unix seconds).
   We use epoch for timezone-agnostic display: each regional dashboard
   will render the correct local time regardless of its timezone. */
const epochToLocal = (epoch) => {
    if (!epoch) return "—";
    return new Date(epoch * 1000).toLocaleString();
};

const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return "—";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

const App = () => {
    const [nodes, setNodes] = useState([]);
    const [clusterSummary, setClusterSummary] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(5);
    const [selectedNode, setSelectedNode] = useState(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    // ─── FETCH DATA ─────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            const summaryRes = await fetch(`${API_BASE}/api/cluster/summary`);
            const summaryData = await summaryRes.json();
            setClusterSummary(summaryData);
            setNodes(summaryData.nodes || []);
        } catch (error) {
            console.error("❌ Error al obtener datos:", error);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [fetchData, refreshInterval]);

    // ─── DONUT CHART DATA ───────────────────────────────────────
    const getPieData = () => {
        if (!clusterSummary) return [];
        return [
            { name: "Usado", value: clusterSummary.usedMemoryGB || 0 },
            { name: "Libre", value: clusterSummary.freeMemoryGB || 0 }
        ];
    };
    const PIE_COLORS = ["#ef4444", "#22c55e"];

    // ─── CLUSTER SUMMARY CARDS ──────────────────────────────────
    const renderSummary = () => {
        if (!clusterSummary) return <p className="text-muted mt-3">Conectando al servidor...</p>;
        const s = clusterSummary;
        const usageColor = s.avgUsagePercent > 80 ? '#ef4444' : s.avgUsagePercent > 60 ? '#f59e0b' : '#22c55e';

        return (
            <div className="row g-3">
                {/* Left: KPI cards */}
                <div className="col-lg-8">
                    <div className="d-flex flex-wrap gap-3 justify-content-center">
                        <div className="summary-card card-cyan">
                            <div className="summary-value">{s.totalMemoryGB} GB</div>
                            <div className="summary-label">Total Cluster</div>
                        </div>
                        <div className="summary-card card-red">
                            <div className="summary-value">{s.usedMemoryGB} GB</div>
                            <div className="summary-label">Usado</div>
                        </div>
                        <div className="summary-card card-green">
                            <div className="summary-value">{s.freeMemoryGB} GB</div>
                            <div className="summary-label">Libre</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-value" style={{ color: usageColor }}>
                                {s.avgUsagePercent}%
                            </div>
                            <div className="summary-label">Utilización</div>
                        </div>
                        <div className="summary-card card-green">
                            <div className="summary-value">{s.activeNodes}</div>
                            <div className="summary-label">Activos</div>
                        </div>
                        <div className="summary-card card-red">
                            <div className="summary-value">{s.noReportaNodes}</div>
                            <div className="summary-label">No Reporta</div>
                        </div>
                        <div className="summary-card card-blue">
                            <div className="summary-value">{s.totalNodes}/{MAX_DEVICES}</div>
                            <div className="summary-label">Nodos</div>
                        </div>
                        <div className="summary-card card-cyan">
                            <div className="summary-value">{s.totalIops ?? 0}</div>
                            <div className="summary-label">IOPS Total</div>
                        </div>
                        <div className="summary-card card-purple">
                            <div className="summary-value">{s.growthRateGBPerDay ?? 0}</div>
                            <div className="summary-label">GB/día</div>
                        </div>
                        <div className="summary-card card-orange">
                            <div className="summary-value">{s.avgLatencyMs ?? 0} ms</div>
                            <div className="summary-label">Latencia Prom.</div>
                        </div>
                        <div className="summary-card card-green">
                            <div className="summary-value">{s.clusterAvailability ?? 0}%</div>
                            <div className="summary-label">Disponibilidad</div>
                        </div>
                    </div>
                </div>

                {/* Right: Donut chart */}
                <div className="col-lg-4 d-flex align-items-center justify-content-center">
                    <div style={{ position: "relative", width: 180, height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={getPieData()}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    dataKey="value"
                                    stroke="none"
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    {getPieData().map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(val) => `${val} GB`}
                                    contentStyle={{
                                        background: "rgba(15,20,40,0.95)",
                                        border: "1px solid rgba(55,75,130,0.3)",
                                        borderRadius: "8px",
                                        color: "#e8ecf4"
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center text */}
                        <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%,-50%)",
                            textAlign: "center"
                        }}>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: usageColor, fontFamily: "JetBrains Mono" }}>
                                {s.avgUsagePercent}%
                            </div>
                            <div style={{ fontSize: "0.6rem", color: "#8892a8", textTransform: "uppercase", letterSpacing: "1px" }}>
                                Uso
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ─── TOPOLOGY MAP ───────────────────────────────────────────
    const renderTopology = () => {
        const slots = [];
        for (let i = 0; i < 9; i++) {
            slots.push(nodes[i] || null);
        }

        return (
            <div className="glass-panel p-4 mb-4">
                <h5 className="fw-bold mb-3" style={{ color: "var(--text-secondary)", fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase" }}>
                    <FaNetworkWired className="me-2" style={{ color: "var(--accent-cyan)" }} /> Topología del Cluster
                </h5>
                <div className="d-flex align-items-center justify-content-center gap-4 flex-wrap">
                    {/* Left nodes (0-3) */}
                    <div className="d-flex flex-column gap-2 align-items-end">
                        {slots.slice(0, 4).map((node, i) => (
                            <div key={i} className={`topology-node ${node ? (node.status === "Active" ? "active" : "inactive") : "empty"}`}>
                                {node ? (
                                    <>
                                        <FaHdd style={{ fontSize: "1rem", color: node.status === "Active" ? "var(--accent-green)" : "var(--accent-red)" }} />
                                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{node.name?.substring(0, 8)}</span>
                                        <span className={`pulse-dot ${node.status === "Active" ? "green" : "red"}`}></span>
                                    </>
                                ) : (
                                    <>
                                        <FaHdd style={{ fontSize: "1rem", opacity: 0.3 }} />
                                        <span style={{ color: "var(--text-muted)" }}>Vacío</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Center server */}
                    <div className="topology-center">
                        <FaServer style={{ fontSize: "1.4rem", marginBottom: 4 }} />
                        <span>SERVIDOR</span>
                        <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>CENTRAL</span>
                    </div>

                    {/* Right nodes (4-8) */}
                    <div className="d-flex flex-column gap-2 align-items-start">
                        {slots.slice(4, 9).map((node, i) => (
                            <div key={i + 4} className={`topology-node ${node ? (node.status === "Active" ? "active" : "inactive") : "empty"}`}>
                                {node ? (
                                    <>
                                        <FaHdd style={{ fontSize: "1rem", color: node.status === "Active" ? "var(--accent-green)" : "var(--accent-red)" }} />
                                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{node.name?.substring(0, 8)}</span>
                                        <span className={`pulse-dot ${node.status === "Active" ? "green" : "red"}`}></span>
                                    </>
                                ) : (
                                    <>
                                        <FaHdd style={{ fontSize: "1rem", opacity: 0.3 }} />
                                        <span style={{ color: "var(--text-muted)" }}>Vacío</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // ─── USAGE BAR COMPONENT ────────────────────────────────────
    const UsageBar = ({ percent }) => {
        const barClass = percent > 80 ? "red" : percent > 60 ? "yellow" : "green";
        return (
            <div className="d-flex align-items-center gap-2">
                <div className="usage-bar-track">
                    <div className={`usage-bar-fill ${barClass}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                </div>
                <span style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    fontFamily: "JetBrains Mono",
                    color: percent > 80 ? "var(--accent-red)" : percent > 60 ? "var(--accent-orange)" : "var(--accent-green)",
                    minWidth: "40px"
                }}>
                    {percent}%
                </span>
            </div>
        );
    };

    // ─── NODES TABLE ────────────────────────────────────────────
    const renderNodesTable = () => (
        <div className="glass-panel p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold m-0" style={{ color: "var(--text-secondary)", fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase" }}>
                    <FaServer className="me-2" style={{ color: "var(--accent-cyan)" }} /> Servidores Regionales
                </h5>
                <div className="d-flex align-items-center gap-2">
                    <label style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 600 }}>Auto-refresh:</label>
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '90px' }}
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    >
                        <option value={5}>5 seg</option>
                        <option value={10}>10 seg</option>
                        <option value={30}>30 seg</option>
                        <option value={60}>60 seg</option>
                    </select>
                </div>
            </div>

            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th>Estado</th>
                            <th>Nombre</th>
                            <th>Hostname</th>
                            <th>IP</th>
                            <th>OS</th>
                            <th>Disco</th>
                            <th>Tipo</th>
                            <th>Total</th>
                            <th>Libre</th>
                            <th>% Uso</th>
                            <th>IOPS</th>
                            <th>Uptime</th>
                            <th>Último Reporte</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {nodes.length === 0 ? (
                            <tr><td colSpan="14" className="text-center py-4" style={{ color: "var(--text-muted)" }}>No hay nodos registrados</td></tr>
                        ) : (
                            nodes.map((node) => {
                                const isActive = node.status === "Active";
                                const m = node.latestMetric;
                                return (
                                    <tr key={node.id} className={!isActive ? "table-danger" : ""}>
                                        <td>
                                            {isActive ? (
                                                <span className="badge bg-success d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                                                    <FaCheckCircle /> UP
                                                </span>
                                            ) : (
                                                <span className="badge bg-danger blink d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                                                    <FaExclamationTriangle /> DOWN
                                                </span>
                                            )}
                                        </td>
                                        <td className="fw-bold">{node.name}</td>
                                        <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{node.hostname || "—"}</td>
                                        <td><code>{node.ip || "—"}</code></td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{node.os || "—"}</td>
                                        <td style={{ fontSize: "0.85rem" }}>{m?.driveName || "—"}</td>
                                        <td>
                                            {m?.driveType ? (
                                                <span className={`badge ${m.driveType === 'SSD' ? 'bg-info' : 'bg-secondary'}`}>{m.driveType}</span>
                                            ) : "—"}
                                        </td>
                                        <td style={{ fontFamily: "JetBrains Mono", fontSize: "0.85rem", fontWeight: 600 }}>
                                            {m ? `${m.totalMemory} GB` : "—"}
                                        </td>
                                        <td style={{ fontFamily: "JetBrains Mono", fontSize: "0.85rem" }}>
                                            {m ? `${m.freeMemory} GB` : "—"}
                                        </td>
                                        <td style={{ minWidth: "120px" }}>
                                            {m ? <UsageBar percent={m.usagePercent} /> : "—"}
                                        </td>
                                        <td style={{ fontFamily: "JetBrains Mono", fontSize: "0.85rem" }}>{m?.iops ?? "—"}</td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                            <FaClock className="me-1" style={{ fontSize: "0.7rem" }} />
                                            {formatUptime(node.uptimeSeconds)}
                                        </td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                            {epochToLocal(node.lastSeenEpoch)}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-outline-dark"
                                                onClick={() => { setSelectedNode(node); setActiveTab("detail"); }}
                                            >
                                                Detalle
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // ─── MAIN RENDER ────────────────────────────────────────────
    return (
        <div className="container my-4 fade-in">
            {/* Header */}
            <div className="dashboard-header text-center mb-4 p-4">
                <div className="dashboard-subtitle mb-1">
                    CAJA NACIONAL DE SALUD — SISTEMA DISTRIBUIDO
                </div>
                <h1 className="dashboard-title mb-3">
                    MONITOR DE ALMACENAMIENTO
                </h1>
                {renderSummary()}
            </div>

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mb-4 justify-content-center gap-2">
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        <FaTachometerAlt className="me-2" /> Dashboard
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "detail" ? "active" : ""}`}
                        onClick={() => setActiveTab("detail")}
                    >
                        <FaHdd className="me-2" /> Detalle Nodo
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "commands" ? "active" : ""}`}
                        onClick={() => setActiveTab("commands")}
                    >
                        💻 Comandos
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "config" ? "active" : ""}`}
                        onClick={() => setActiveTab("config")}
                    >
                        ⚙️ Configuración
                    </button>
                </li>
            </ul>

            {/* Tab Content */}
            {activeTab === "dashboard" && (
                <>
                    {renderTopology()}
                    {renderNodesTable()}
                    <Histogram />
                </>
            )}

            {activeTab === "detail" && (
                <NodeDetail
                    nodes={nodes}
                    selectedNode={selectedNode}
                    onSelectNode={setSelectedNode}
                    apiBase={API_BASE}
                />
            )}

            {activeTab === "commands" && (
                <CommandPanel nodes={nodes} apiBase={API_BASE} />
            )}

            {activeTab === "config" && (
                <ConfigPanel nodes={nodes} apiBase={API_BASE} />
            )}
        </div>
    );
};

export default App;
