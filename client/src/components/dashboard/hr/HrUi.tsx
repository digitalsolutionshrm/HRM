'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { MdArrowForward, MdLinkOff } from 'react-icons/md';
import Card from 'components/card';
import { Emp, initials } from './hr-model';
import { getMediaUrl } from '@/lib/media-url';

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-navy-700 dark:text-white',
  good: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-300',
  bad: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-300',
};
const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  good: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300',
  warn: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  bad: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
};
const PILL: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-300',
  good: 'bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300',
};

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${PILL[tone]}`}>{children}</span>;
}

export function KpiCard({ label, value, note, icon, tone = 'neutral', onClick, href }: {
  label: string; value: string | number; note: string; icon: ReactNode; tone?: Tone; onClick?: () => void; href?: string;
}) {
  const body = (
    <Card extra="h-full w-full p-4 sm:p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`mt-2 truncate text-2xl font-bold tracking-tight ${TONE_TEXT[tone]}`}>{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE_ICON[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>
    </Card>
  );
  const cls = 'group block w-full rounded-[20px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400';
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

export function Section({ id, title, subtitle, href, hrefLabel = 'View all', action, children }: {
  id?: string; title: string; subtitle?: string; href?: string; hrefLabel?: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <Card extra="w-full overflow-hidden" id={id}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-navy-700 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-navy-700 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {href && <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">{hrefLabel} <MdArrowForward /></Link>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{children}</p>;
}

/** Honest placeholder for areas that have no backend data yet: no numbers, just what is needed. */
export function NotConnected({ title, shows, needs }: { title: string; shows: string[]; needs: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-gray-300 bg-white/60 p-5 dark:border-navy-600 dark:bg-navy-800/60">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500 dark:bg-navy-700 dark:text-gray-300"><MdLinkOff className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-navy-700 dark:text-white">{title} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-navy-700 dark:text-gray-300">Not connected</span></h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{needs}</p>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-2">
            {shows.map((item) => <li key={item} className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function BarList({ items, total, unit = '', barClass = 'bg-brand-500', empty = 'No data yet.' }: {
  items: Array<{ label: string; value: number }>; total?: number; unit?: string; barClass?: string; empty?: string;
}) {
  const shown = items.filter((i) => i.value > 0);
  if (!shown.length) return <Empty>{empty}</Empty>;
  const max = Math.max(1, total ?? Math.max(...shown.map((i) => i.value)));
  return (
    <ul className="space-y-3.5">
      {shown.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="truncate font-medium text-navy-700 dark:text-gray-200">{item.label}</span>
            <span className="shrink-0 text-gray-500 dark:text-gray-400">{item.value.toLocaleString('en-IN')}{unit}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900"><div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(3, Math.round((item.value / max) * 100))}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

const SEGMENTS = ['bg-brand-500', 'bg-pink-500', 'bg-amber-500', 'bg-gray-400'];
export function SegmentBar({ items }: { items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((t, i) => t + i.value, 0);
  if (!total) return <Empty>No data yet.</Empty>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900">
        {items.map((item, i) => item.value > 0 && <div key={item.label} className={SEGMENTS[i % SEGMENTS.length]} style={{ width: `${(item.value / total) * 100}%` }} title={`${item.label}: ${item.value}`} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <span className={`h-2.5 w-2.5 rounded-full ${SEGMENTS[i % SEGMENTS.length]}`} />
            {item.label} <span className="ml-auto font-semibold text-navy-700 dark:text-white">{Math.round((item.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Avatar({ employee, size = 'h-9 w-9' }: { employee?: Emp | null; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200`}>
      {employee?.profileImage ? <img src={getMediaUrl(employee.profileImage)} alt="" className="h-full w-full object-cover" /> : initials(employee)}
    </span>
  );
}

export function PersonRow({ employee, detail, right }: { employee?: Emp | null; detail?: ReactNode; right?: ReactNode }) {
  const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || 'Employee';
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar employee={employee} size="h-8 w-8" />
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{name}</p>{detail && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{detail}</p>}</div>
      </div>
      {right}
    </li>
  );
}

export function Stat({ label, value, tone = 'neutral', note }: { label: string; value: ReactNode; tone?: Tone; note?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-lg font-bold ${TONE_TEXT[tone]}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  );
}

export const chartBase = (categories: string[], colors: string[], stacked = true) => ({
  chart: { stacked, toolbar: { show: false }, fontFamily: 'inherit' },
  colors,
  plotOptions: { bar: { borderRadius: 4, columnWidth: '42%' } },
  dataLabels: { enabled: false },
  stroke: { show: false },
  grid: { borderColor: 'rgba(163,174,208,0.2)', strokeDashArray: 4 },
  xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#A3AED0', fontSize: '11px' } } },
  yaxis: { forceNiceScale: true, decimalsInFloat: 0, labels: { style: { colors: '#A3AED0', fontSize: '11px' } } },
  legend: { position: 'bottom', labels: { colors: '#A3AED0' }, markers: { radius: 12 } },
  tooltip: { theme: 'dark' },
});
