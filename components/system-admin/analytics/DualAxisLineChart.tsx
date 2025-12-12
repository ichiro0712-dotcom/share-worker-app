'use client';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface DualAxisLineChartProps {
    title: string;
    labels: string[];
    dataset1: {
        label: string;
        data: number[];
        color: string;
    };
    dataset2?: {
        label: string;
        data: number[];
        color: string;
    };
    height?: number;
    // 単軸モード（dataset2を無視）
    singleAxis?: boolean;
}

export default function DualAxisLineChart({
    title,
    labels,
    dataset1,
    dataset2,
    height = 300,
    singleAxis = false
}: DualAxisLineChartProps) {
    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
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
            y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                beginAtZero: true,
                ticks: { precision: 0 },
                title: {
                    display: true,
                    text: dataset1.label,
                }
            },
            ...(!singleAxis && dataset2 ? {
                y1: {
                    type: 'linear' as const,
                    display: true,
                    position: 'right' as const,
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: {
                        drawOnChartArea: false,
                    },
                    title: {
                        display: true,
                        text: dataset2.label,
                    }
                },
            } : {}),
        },
    };

    const datasets = [
        {
            label: dataset1.label,
            data: dataset1.data,
            borderColor: dataset1.color,
            backgroundColor: dataset1.color.replace('rgb', 'rgba').replace(')', ', 0.5)'),
            yAxisID: 'y',
            tension: 0.3,
        }
    ];

    if (!singleAxis && dataset2) {
        datasets.push({
            label: dataset2.label,
            data: dataset2.data,
            borderColor: dataset2.color,
            backgroundColor: dataset2.color.replace('rgb', 'rgba').replace(')', ', 0.5)'),
            yAxisID: 'y1',
            tension: 0.3,
        });
    }

    const chartData = {
        labels,
        datasets,
    };

    return <div style={{ height }}><Line options={options} data={chartData} /></div>;
}
