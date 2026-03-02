import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import axios from "axios";

const Histogram = () => {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await axios.get("http://localhost:5042/api/DiskLog");
                setLogs(response.data);
            } catch (error) {
                console.error("Error obteniendo logs:", error);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    // ✅ Agrupar logs en rangos de memoria usada
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
            const usedMemory = log.totalMemory - log.freeMemory;
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
                    <BarChart width={800} height={400} data={histogramData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="range" stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                        <YAxis stroke="#000" tick={{ fill: '#000', fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #000', borderRadius: '8px', color: '#000' }} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                        <Bar dataKey="count" fill="#333" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </div>
            </div>
        </div>
    );
};

export default Histogram;
