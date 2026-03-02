import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaHdd } from "react-icons/fa";
import Histogram from "./assets/Histogram";
const MAX_DEVICES = 9;
const UPDATE_INTERVAL = 5000;
const TIMEOUT_LIMIT = 10000;

const App = () => {
    const [data, setData] = useState([]);
    const [lastUpdated, setLastUpdated] = useState({});
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await fetch("http://localhost:5042/api/Client");
                const clients = await response.json();
                const initialData = clients.map(client => ({
                    id: client.id,
                    name: client.name,
                    macAddress: client.mac,
                    totalMemory: 0,
                    freeMemory: 0,
                    occupedMemory: 0,
                    lastSeen: 0,
                    isResponsive: false
                }));
                setData(initialData);
            } catch (error) {
                console.error("❌ Error al obtener clientes:", error);
            }
        };
        fetchClients();
    }, []);

    useEffect(() => {
        const connectWebSocket = () => {
            const newSocket = new WebSocket("ws://localhost:8080/");

            newSocket.onopen = () => console.log("✅ Conectado al WebSocket");

            newSocket.onmessage = (event) => {
                console.log("📩 Datos recibidos:", event.data);
                try {
                    const receivedData = JSON.parse(event.data);
                    if (!Array.isArray(receivedData)) return;

                    const now = Date.now();
                    setData(prevData => {
                        return prevData.map(client => {
                            const newDevice = receivedData.find(device => device.macAddress === client.macAddress);
                            if (newDevice) {
                                return {
                                    ...client,
                                    totalMemory: newDevice.totalMemory || 0,
                                    freeMemory: newDevice.freeMemory || 0,
                                    occupedMemory: Math.max((newDevice.totalMemory || 0) - (newDevice.freeMemory || 0), 0),
                                    lastSeen: now,
                                    isResponsive: true
                                };
                            }
                            return client;
                        });
                    });

                    setLastUpdated(prev => {
                        const newUpdates = { ...prev };
                        receivedData.forEach(device => {
                            newUpdates[device.macAddress] = now;
                        });
                        return newUpdates;
                    });
                } catch (error) {
                    console.error("❌ Error al procesar los datos JSON:", error);
                }
            };

            newSocket.onclose = () => {
                console.log("❌ WebSocket cerrado. Intentando reconectar en 3s...");
                setTimeout(connectWebSocket, 3000);
            };

            setSocket(newSocket);
        };

        connectWebSocket();
        return () => socket?.close();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setData(prevData =>
                prevData.map(client => {
                    const lastSeen = lastUpdated[client.macAddress] || 0;
                    return {
                        ...client,
                        isResponsive: Date.now() - lastSeen < TIMEOUT_LIMIT
                    };
                })
            );
        }, UPDATE_INTERVAL);

        return () => clearInterval(interval);
    }, [lastUpdated]);

    const activeClients = data.filter(client => client.isResponsive);
    const totalMemory = activeClients.reduce((acc, client) => acc + (client.totalMemory || 0), 0);
    const usedMemory = activeClients.reduce((acc, client) => acc + (client.occupedMemory || 0), 0);
    const freeMemory = activeClients.reduce((acc, client) => acc + (client.freeMemory || 0), 0);
    const reportados = activeClients.length;

    return (
        <div className="container my-4 pulse-slow">
            <div className="text-center mb-5 p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(16px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                <h1 className="fw-bolder text-dark mb-4 display-4" style={{ letterSpacing: '3px', textShadow: '2px 2px 4px rgba(255,255,255,0.8)' }}>MONITOR NACIONAL DE ALMACENAMIENTO</h1>
                {data.length > 0 ? (
                    <div className="d-flex justify-content-center flex-wrap gap-4 text-dark font-weight-bold fs-5">
                        <span className="badge bg-light text-dark border border-dark p-2 shadow-sm">Total: <span className="neon-text-cyan">{totalMemory} GB</span></span>
                        <span className="badge bg-light text-dark border border-dark p-2 shadow-sm">Usado: <span className="neon-text-danger">{usedMemory} GB</span></span>
                        <span className="badge bg-light text-dark border border-dark p-2 shadow-sm">Libre: <span className="neon-text-green">{freeMemory} GB</span></span>
                        <span className="badge bg-light text-dark border border-dark p-2 shadow-sm">Reportados: <span className="neon-text-cyan">{reportados} / {MAX_DEVICES}</span></span>
                    </div>
                ) : (
                    <p className="text-dark fw-bold mt-3">Cargando datos sensoriales...</p>
                )}
            </div>

            <div className="d-flex flex-column gap-3 mb-5">
                {data.map((client, index) => {
                    const totalMem = client.totalMemory || 0;
                    const freeMem = client.freeMemory || 0;
                    const usedMem = client.occupedMemory || 0;
                    const usagePercentage = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;
                    const isResponsive = client.isResponsive;
                    const progressBarColor = usagePercentage > 70 ? "bg-danger" : usagePercentage > 50 ? "bg-warning" : "bg-success";

                    // Delay calculation for cascading entrance effect
                    const animationDelay = `${index * 0.1}s`;

                    return (
                        <div key={index} className={`glass-row d-flex align-items-center p-3 ${isResponsive ? "" : "danger-glow"}`} style={{ animationDelay }}>
                            {/* Icon section */}
                            <div className="pe-4 ps-2 border-end border-2" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                                <FaHdd size={40} className={`icon-glow ${isResponsive ? "text-dark" : "opacity-50 icon-glow-danger"}`} />
                            </div>

                            {/* Name and status */}
                            <div className="ps-4 pe-4" style={{ minWidth: '200px' }}>
                                <h5 className={`fw-bolder m-0 ${isResponsive ? "text-dark" : "text-dark"}`}>{client.name}</h5>
                                {!isResponsive && <small className="text-danger fw-bold">CONNECTION LOST</small>}
                            </div>

                            {/* Center Progress Bar */}
                            <div className="flex-grow-1 px-4">
                                {isResponsive ? (
                                    <div className="d-flex flex-column w-100">
                                        <div className="d-flex justify-content-between mb-1 text-dark small fw-bold">
                                            <span>Uso: <span className="neon-text-danger">{usedMem} GB</span></span>
                                            <span>Libre: <span className="neon-text-green">{freeMem} GB</span></span>
                                        </div>
                                        <div className="progress progress-glass-long">
                                            <div className={`progress-bar ${progressBarColor}`} role="progressbar" style={{ width: `${usagePercentage}%` }}></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="d-flex align-items-center">
                                        <div className="spinner-grow spinner-grow-sm text-danger me-2" role="status"></div>
                                        <span className="text-dark fw-bold opacity-75">Reconectando...</span>
                                    </div>
                                )}
                            </div>

                            {/* End Stats */}
                            <div className="ps-4 border-start border-2 text-end" style={{ minWidth: '150px', borderColor: 'rgba(0,0,0,0.1)' }}>
                                {isResponsive && (
                                    <div>
                                        <div className="fs-5 fw-bolder text-dark">{usagePercentage.toFixed(1)}%</div>
                                        <div className="text-muted small fw-bold">Total: {totalMem} GB</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="container pb-5"><Histogram></Histogram></div>
        </div>
    );
};

export default App;
