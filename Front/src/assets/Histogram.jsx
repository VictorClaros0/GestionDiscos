import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { FaChartBar } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5042";

const Histogram = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/metrics`);
                const data = await response.json();
                setLogs(data);
            } catch (error) {
                console.error("Error obteniendo logs:", error);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 10000);
        return () => clearInterval(interval);
    }, []);

    const histogramData = () => {
        const bins = [
            { range: "0-100 GB", count: 0 },
            { range: "101-300 GB", count: 0 },
            { range: "301-500 GB", count: 0 },
            { range: "501-700 GB", count: 0 },
            { range: "701-900 GB", count: 0 },
            { range: "900+ GB", count: 0 },
        ];

        logs.forEach(log => {
            const usedMemory = log.usedMemory || (log.totalMemory - log.freeMemory);
            if (usedMemory <= 100) bins[0].count++;
            else if (usedMemory <= 300) bins[1].count++;
            else if (usedMemory <= 500) bins[2].count++;
            else if (usedMemory <= 700) bins[3].count++;
            else if (usedMemory <= 900) bins[4].count++;
            else bins[5].count++;
        });

        return bins;
    };

    return (
        <div className="glass-panel p-4 mt-4">
            <h5 className="fw-bold mb-3" style={{ color: "var(--text-secondary)", fontSize: "0.85rem", letterSpacing: "1px", textTransform: "uppercase" }}>
                <FaChartBar className="me-2" style={{ color: "var(--accent-purple)" }} /> Distribución de Uso de Almacenamiento
            </h5>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={histogramData()}>
                    <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0.4} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(55,75,130,0.2)" />
                    <XAxis dataKey="range" tick={{ fill: "#8892a8", fontSize: 11, fontWeight: 600 }} />
                    <YAxis tick={{ fill: "#8892a8", fontSize: 11 }} />
                    <Tooltip
                        contentStyle={{
                            background: "rgba(15,20,40,0.95)",
                            border: "1px solid rgba(55,75,130,0.3)",
                            borderRadius: "8px",
                            color: "#e8ecf4"
                        }}
                        cursor={{ fill: "rgba(0,180,255,0.05)" }}
                    />
                    <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={40} name="Registros" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default Histogram;
