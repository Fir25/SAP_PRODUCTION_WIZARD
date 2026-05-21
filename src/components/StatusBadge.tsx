import { EventStatus } from '../types';
import {
  Clock, CheckCircle, XCircle, AlertTriangle, AlertCircle
} from 'lucide-react';

const config: Record<EventStatus, { label: string; bg: string; text: string; border: string; Icon: React.ElementType }> = {
  PENDING:  { label: 'Pending',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-300', Icon: Clock },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-300',Icon: CheckCircle },
  REJECTED: { label: 'Rejected', bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-300',   Icon: XCircle },
  WARNING:  { label: 'Warning',  bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-300',Icon: AlertTriangle },
  ERROR:    { label: 'Error',    bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-300',  Icon: AlertCircle },
};

interface Props {
  status: EventStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const { label, bg, text, border, Icon } = config[status];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${bg} ${text} ${border} ${padding} font-medium uppercase tracking-wide`}>
      <Icon size={size === 'sm' ? 10 : 11} />
      {label}
    </span>
  );
}
