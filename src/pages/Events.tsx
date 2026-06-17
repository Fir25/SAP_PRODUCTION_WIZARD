import { useEffect, useState, useCallback } from 'react';
import {
  Search, Filter, RefreshCw, ChevronDown, Clock,
  CheckCircle, XCircle, AlertTriangle, AlertCircle, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WmsEvent, EventStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import EventWizard from '../components/EventWizard';
import { formatDate } from '../lib/date';

const STATUS_FILTERS: { value: EventStatus | 'ALL'; label: string; Icon: React.ElementType; color: string }[] = [
  { value: 'ALL',      label: 'All Events', Icon: Filter,        color: 'text-slate-500' },
  { value: 'PENDING',  label: 'Pending',    Icon: Clock,         color: 'text-amber-500' },
  { value: 'WARNING',  label: 'Warning',    Icon: AlertTriangle, color: 'text-orange-500' },
  { value: 'ERROR',    label: 'Error',      Icon: AlertCircle,   color: 'text-rose-500' },
  { value: 'APPROVED', label: 'Approved',   Icon: CheckCircle,   color: 'text-emerald-500' },
  { value: 'REJECTED', label: 'Rejected',   Icon: XCircle,       color: 'text-red-500' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  PRODUCTION_RECEIPT: 'Prod. Receipt',
  MATERIAL_CONSUMPTION: 'Mat. Consumption',
  STOCK_TRANSFER: 'Stock Transfer',
  STOCK_ADJUSTMENT: 'Stock Adjustment',
};

interface Props { onNavigate?: (page: string) => void }

export default function Events({ onNavigate: _onNavigate }: Props) {
  const [events, setEvents] = useState<WmsEvent[]>([]);
  const [filtered, setFiltered] = useState<WmsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<keyof WmsEvent>('received_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedEvent, setSelectedEvent] = useState<WmsEvent | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('received_at', { ascending: false });
    if (data) setEvents(data as WmsEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const channel = supabase
      .channel('events-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

  useEffect(() => {
    let result = [...events];
    if (statusFilter !== 'ALL') result = result.filter(e => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        (e.production_order || '').toLowerCase().includes(q) ||
        e.item_code.toLowerCase().includes(q) ||
        e.item_description.toLowerCase().includes(q) ||
        e.machine_name.toLowerCase().includes(q) ||
        e.bin_location.toLowerCase().includes(q) ||
        (e.external_id || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const av = String(a[sortField] ?? '');
      const bv = String(b[sortField] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    setFiltered(result);
    setPage(0);
  }, [events, search, statusFilter, sortField, sortDir]);

  function toggleSort(field: keyof WmsEvent) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const statusCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Production Events</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} of {events.length} events</p>
        </div>
        <button onClick={fetchEvents} className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {STATUS_FILTERS.map(({ value, label, Icon, color }) => {
          const count = value === 'ALL' ? events.length : statusCounts[value] || 0;
          const active = statusFilter === value;
          return (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              <Icon size={12} className={active ? 'text-white' : color} />
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? 'bg-white/20' : 'bg-slate-100'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by order, item, machine, bin location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { label: 'Event ID',    field: 'external_id' as keyof WmsEvent },
                  { label: 'Type',        field: 'event_type' as keyof WmsEvent },
                  { label: 'Prod. Order', field: 'production_order' as keyof WmsEvent },
                  { label: 'Item',        field: 'item_code' as keyof WmsEvent },
                  { label: 'Quantity',    field: 'original_quantity' as keyof WmsEvent },
                  { label: 'Machine',     field: 'machine_name' as keyof WmsEvent },
                  { label: 'Bin',         field: 'bin_location' as keyof WmsEvent },
                  { label: 'Status',      field: 'status' as keyof WmsEvent },
                  { label: 'Received',    field: 'received_at' as keyof WmsEvent },
                  { label: '',            field: null },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={() => col.field && toggleSort(col.field)}
                    className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap ${col.field ? 'cursor-pointer hover:text-slate-800 select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.field && sortField === col.field && (
                        <ChevronDown size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Loading events...</td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 text-sm">No events match your filters</td>
                </tr>
              ) : paginated.map(ev => {
                const hasIssue = ev.validation_rules.some(r => r.status === 'ERROR' || r.status === 'WARNING');
                return (
                  <tr
                    key={ev.id}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      ev.status === 'PENDING' || ev.status === 'WARNING' ? 'bg-amber-50/30' : ''
                    }`}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{ev.external_id || ev.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                        {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{ev.production_order}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-mono font-semibold text-slate-700">{ev.item_code}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[160px]">{ev.item_description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-slate-800">{ev.modified_quantity ?? ev.original_quantity}</p>
                        {ev.modified_quantity !== null && ev.modified_quantity !== ev.original_quantity && (
                          <p className="text-xs text-slate-400 line-through">{ev.original_quantity}</p>
                        )}
                        <p className="text-xs text-slate-400">{ev.unit_of_measure}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{ev.machine_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{ev.bin_location}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={ev.status} size="sm" />
                        {hasIssue && ev.status !== 'APPROVED' && ev.status !== 'REJECTED' && (
                          <span className="text-xs text-amber-600 font-medium">⚠ Check rules</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(ev.received_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Open wizard"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 text-xs font-semibold rounded-lg border transition-colors ${
                      pg === page ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-white'
                    }`}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventWizard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => { setSelectedEvent(null); fetchEvents(); }}
        />
      )}
    </div>
  );
}
