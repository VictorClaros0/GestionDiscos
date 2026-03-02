import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const API_BASE = "http://localhost:5042";

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
            { range: "0-100", count: 0 },
            { range: "101-300", count: 0 },
            { range: "301-500", count: 0 },
            { range: "501-700", count: 0 },
            { range: "701-900", count: 0 },
            { range: "900+", count: 0 },
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
        <div className="container mt-5">
            <div className="glass-panel p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                <h3 className="text-center text-dark neon-title mb-4 fs-4">Histograma de Uso de Memoria (Logs)</h3>
                <div className="d-flex justify-content-center">
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={histogramData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                            <XAxis dataKey="range" stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                            <YAxis stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #000', borderRadius: '8px', color: '#000' }} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                            <Bar dataKey="count" fill="#333" radius={[4, 4, 0, 0]} barSize={40} name="Registros" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Histogram;
