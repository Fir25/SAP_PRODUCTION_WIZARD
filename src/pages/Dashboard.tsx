import { useEffect, useState, useCallback } from 'react';
import {
  Clock, CheckCircle, XCircle, AlertCircle,
  Activity, RefreshCw, ArrowRight, Cpu, TrendingUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WmsEvent, DashboardKPIs } from '../types';
import KPICard from '../components/KPICard';
import StatusBadge from '../components/StatusBadge';
import EventWizard from '../components/EventWizard';

interface Props { onNavigate: (page: string) => void }

export default function Dashboard({ onNavigate }: Props) {
  const [kpis, setKpis] = useState<DashboardKPIs>({ pending: 0, approvedToday: 0, rejectedToday: 0, errors: 0 });
  const [recentEvents, setRecentEvents] = useState<WmsEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<WmsEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [pendingRes, approvedRes, rejectedRes, errorsRes, recentRes] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'WARNING']),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('processed_at', todayStart.toISOString()),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('processed_at', todayStart.toISOString()),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'ERROR'),
      supabase.from('events').select('*').order('created_at', { ascending: false }).limit(6),
    ]);

    setKpis({
      pending: pendingRes.count ?? 0,
      approvedToday: approvedRes.count ?? 0,
      rejectedToday: rejectedRes.count ?? 0,
      errors: errorsRes.count ?? 0,
    });
    if (recentRes.data) setRecentEvents(recentRes.data as WmsEvent[]);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('events-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return (
    <div className="p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Operations Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time WMS validation status</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:block">Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard label="Pending Review"  value={kpis.pending}       icon={Clock}        color="amber"   trend="Awaiting admin action" />
        <KPICard label="Approved Today"  value={kpis.approvedToday} icon={CheckCircle}  color="emerald" trend="Sent to SAP B1" />
        <KPICard label="Rejected Today"  value={kpis.rejectedToday} icon={XCircle}      color="red"     trend="Archived with reason" />
        <KPICard label="Critical Errors" value={kpis.errors}        icon={AlertCircle}  color="rose"    trend="Require immediate attention" />
      </div>

      {/* Activity banner */}
      {kpis.pending > 0 && (
        <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 shrink-0">
            <Activity size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {kpis.pending} event{kpis.pending > 1 ? 's' : ''} pending review
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Production events are waiting for your approval before being sent to SAP Business One.
            </p>
          </div>
          <button
            onClick={() => onNavigate('events')}
            className="flex items-center gap-1.5 bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            Review Now <ArrowRight size={13} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent events */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-slate-500" />
                <h3 className="text-sm font-bold text-slate-700">Recent Events</h3>
              </div>
              <button
                onClick={() => onNavigate('events')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading events...</div>
            ) : recentEvents.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No events found</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Cpu size={14} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ev.item_description}</p>
                      <p className="text-xs text-slate-500 truncate">{ev.production_order} · {ev.machine_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={ev.status} size="sm" />
                      <p className="text-xs text-slate-400">{ev.original_quantity} {ev.unit_of_measure}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Machine summary */}
        <div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <Cpu size={16} className="text-slate-500" />
              <h3 className="text-sm font-bold text-slate-700">Status Breakdown</h3>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Pending Review', count: kpis.pending, color: 'bg-amber-500', pct: kpis.pending },
                { label: 'Approved', count: kpis.approvedToday, color: 'bg-emerald-500', pct: kpis.approvedToday },
                { label: 'Rejected', count: kpis.rejectedToday, color: 'bg-red-500', pct: kpis.rejectedToday },
                { label: 'Errors', count: kpis.errors, color: 'bg-rose-500', pct: kpis.errors },
              ].map(item => {
                const total = kpis.pending + kpis.approvedToday + kpis.rejectedToday + kpis.errors;
                const pct = total > 0 ? (item.pct / total) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">{item.label}</span>
                      <span className="text-slate-500 font-semibold tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">
                Live data · Auto-refreshes on changes
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventWizard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => { setSelectedEvent(null); fetchData(); }}
        />
      )}
    </div>
  );
}
