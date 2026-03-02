import { useEffect, useState, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaServer, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import NodeDetail from "./components/NodeDetail";
import CommandPanel from "./components/CommandPanel";
import ConfigPanel from "./components/ConfigPanel";
import Histogram from "./assets/Histogram";

const API_BASE = "http://localhost:5042";
const MAX_DEVICES = 9;

const App = () => {
    const [nodes, setNodes] = useState([]);
    const [clusterSummary, setClusterSummary] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(5);
    const [selectedNode, setSelectedNode] = useState(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    // ─── FETCH DATA ─────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        try {
            const [nodesRes, summaryRes] = await Promise.all([
                fetch(`${API_BASE}/api/nodes`),
                fetch(`${API_BASE}/api/cluster/summary`)
            ]);
            const nodesData = await nodesRes.json();
            const summaryData = await summaryRes.json();
            setNodes(nodesData);
            setClusterSummary(summaryData);
        } catch (error) {
            console.error("❌ Error al obtener datos:", error);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [fetchData, refreshInterval]);

    // ─── CLUSTER SUMMARY CARDS ──────────────────────────────────
    const renderSummary = () => {
        if (!clusterSummary) return <p className="text-dark fw-bold mt-3">Cargando datos...</p>;
        return (
            <div className="d-flex justify-content-center flex-wrap gap-3 mb-2">
                <div className="summary-card">
                    <div className="summary-value neon-text-cyan">{clusterSummary.totalMemoryGB} GB</div>
                    <div className="summary-label">Total Cluster</div>
                </div>
                <div className="summary-card">
                    <div className="summary-value neon-text-danger">{clusterSummary.usedMemoryGB} GB</div>
                    <div className="summary-label">Usado</div>
                </div>
                <div className="summary-card">
                    <div className="summary-value neon-text-green">{clusterSummary.freeMemoryGB} GB</div>
                    <div className="summary-label">Libre</div>
                </div>
                <div className="summary-card">
                    <div className="summary-value" style={{ color: '#28a745' }}>{clusterSummary.activeNodes}</div>
                    <div className="summary-label">Activos</div>
                </div>
                <div className="summary-card">
                    <div className="summary-value" style={{ color: '#dc3545' }}>{clusterSummary.noReportaNodes}</div>
                    <div className="summary-label">No Reporta</div>
                </div>
                <div className="summary-card">
                    <div className="summary-value" style={{ color: '#6c757d' }}>{clusterSummary.totalNodes}/{MAX_DEVICES}</div>
                    <div className="summary-label">Nodos</div>
                </div>
            </div>
        );
    };

    // ─── NODES TABLE ────────────────────────────────────────────
    const renderNodesTable = () => (
        <div className="glass-panel p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold text-dark m-0">
                    <FaServer className="me-2" /> Nodos del Cluster
                </h4>
                <div className="d-flex align-items-center gap-2">
                    <label className="text-dark fw-bold small mb-0">Auto-refresh:</label>
                    <select
                        className="form-select form-select-sm"
                        style={{ width: '100px' }}
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
                        <tr className="text-dark">
                            <th>Estado</th>
                            <th>Nombre</th>
                            <th>Hostname</th>
                            <th>IP</th>
                            <th>OS</th>
                            <th>Último Reporte</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nodes.length === 0 ? (
                            <tr><td colSpan="7" className="text-center text-muted py-4">No hay nodos registrados</td></tr>
                        ) : (
                            nodes.map((node) => {
                                const isActive = node.status === "Active";
                                return (
                                    <tr key={node.id} className={!isActive ? "table-danger" : ""}>
                                        <td>
                                            {isActive ? (
                                                <span className="badge bg-success d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                                                    <FaCheckCircle /> UP
                                                </span>
                                            ) : (
                                                <span className="badge bg-danger blink d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                                                    <FaExclamationTriangle /> NO REPORTA
                                                </span>
                                            )}
                                        </td>
                                        <td className="fw-bold">{node.name}</td>
                                        <td>{node.hostname || "—"}</td>
                                        <td><code>{node.ip || "—"}</code></td>
                                        <td className="small">{node.os || "—"}</td>
                                        <td className="small">
                                            {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : "—"}
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
        <div className="container my-4 pulse-slow">
            {/* Header */}
            <div className="text-center mb-4 p-4" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
                <h1 className="fw-bolder text-dark mb-3 display-5" style={{
                    letterSpacing: '3px',
                    textShadow: '2px 2px 4px rgba(255,255,255,0.8)'
                }}>
                    MONITOR NACIONAL DE ALMACENAMIENTO
                </h1>
                {renderSummary()}
            </div>

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mb-4 justify-content-center gap-2">
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "dashboard" ? "active bg-dark" : "text-dark"}`}
                        onClick={() => setActiveTab("dashboard")}
                    >
                        📊 Dashboard
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "detail" ? "active bg-dark" : "text-dark"}`}
                        onClick={() => setActiveTab("detail")}
                    >
                        🔍 Detalle Nodo
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "commands" ? "active bg-dark" : "text-dark"}`}
                        onClick={() => setActiveTab("commands")}
                    >
                        💻 Comandos
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${activeTab === "config" ? "active bg-dark" : "text-dark"}`}
                        onClick={() => setActiveTab("config")}
                    >
                        ⚙️ Configuración
                    </button>
                </li>
            </ul>

            {/* Tab Content */}
            {activeTab === "dashboard" && (
                <>
                    {renderNodesTable()}
                    <div className="container pb-5"><Histogram /></div>
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
