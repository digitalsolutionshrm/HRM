'use client';

import dynamic from 'next/dynamic';
import { formatCompact, formatCurrency } from './payroll-shared';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function TrendChart({ labels, values, name }: { labels: string[]; values: number[]; name: string }) {
  const options: any = {
    chart: { toolbar: { show: false }, fontFamily: 'inherit' },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
    dataLabels: { enabled: false },
    colors: ['#4318FF'],
    xaxis: {
      categories: labels,
      labels: { style: { colors: '#A3AED0', fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: '#A3AED0', fontSize: '12px' }, formatter: (v: number) => formatCompact(v) } },
    grid: { borderColor: 'rgba(163,174,208,0.2)', strokeDashArray: 4 },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return <Chart options={options} type="bar" width="100%" height="100%" series={[{ name, data: values }]} />;
}

export function DonutChart({ labels, values, colors }: { labels: string[]; values: number[]; colors: string[] }) {
  const options: any = {
    chart: { fontFamily: 'inherit' },
    labels,
    colors,
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: { pie: { donut: { size: '68%' } } },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => formatCurrency(v) } },
  };

  return <Chart options={options} type="donut" width="100%" height="100%" series={values} />;
}
