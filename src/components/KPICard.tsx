import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'amber' | 'emerald' | 'red' | 'rose' | 'blue' | 'slate';
  trend?: string;
}

const colorMap = {
  amber:   { ring: 'ring-amber-100',   bg: 'bg-amber-50',   icon: 'text-amber-600',   value: 'text-amber-700' },
  emerald: { ring: 'ring-emerald-100', bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  red:     { ring: 'ring-red-100',     bg: 'bg-red-50',     icon: 'text-red-600',     value: 'text-red-700' },
  rose:    { ring: 'ring-rose-100',    bg: 'bg-rose-50',    icon: 'text-rose-600',    value: 'text-rose-700' },
  blue:    { ring: 'ring-blue-100',    bg: 'bg-blue-50',    icon: 'text-blue-600',    value: 'text-blue-700' },
  slate:   { ring: 'ring-slate-100',   bg: 'bg-slate-50',   icon: 'text-slate-600',   value: 'text-slate-700' },
};

export default function KPICard({ label, value, icon: Icon, color, trend }: Props) {
  const c = colorMap[color];
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ring-1 ${c.ring} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${c.value}`}>{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-400">{trend}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${c.bg}`}>
          <Icon size={22} className={c.icon} />
        </div>
      </div>
    </div>
  );
}
