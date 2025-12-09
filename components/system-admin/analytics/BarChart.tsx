'use client';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface BarChartProps {
    title: string;
    labels: string[];
    data: number[];
    label: string;
    horizontal?: boolean;
    height?: number;
}

export default function BarChart({ title, labels, data, label, horizontal = false, height = 300 }: BarChartProps) {
    const options: ChartOptions<'bar'> = {
        indexAxis: horizontal ? 'y' as const : 'x' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: title,
            },
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            }
        }
    };

    const chartData = {
        labels,
        datasets: [
            {
                label,
                data,
                backgroundColor: 'rgba(53, 162, 235, 0.7)',
                borderColor: 'rgb(53, 162, 235)',
                borderWidth: 1,
            },
        ],
    };

    return <div style={{ height }}><Bar options={options} data={chartData} /></div>;
}
