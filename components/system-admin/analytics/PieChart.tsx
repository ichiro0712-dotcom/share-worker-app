'use client';

import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    ChartOptions
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PieChartProps {
    title: string;
    labels: string[];
    data: number[];
    height?: number;
}

export default function PieChart({ title, labels, data, height = 300 }: PieChartProps) {
    const options: ChartOptions<'pie'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
            },
            title: {
                display: true,
                text: title,
            },
        },
    };

    // Generate colors
    const backgroundColors = [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)',
    ];

    const borderColors = backgroundColors.map(c => c.replace('0.7', '1'));

    const chartData = {
        labels,
        datasets: [
            {
                data,
                backgroundColor: backgroundColors.slice(0, data.length),
                borderColor: borderColors.slice(0, data.length),
                borderWidth: 1,
            },
        ],
    };

    return <div style={{ height }}><Pie options={options} data={chartData} /></div>;
}
