import { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, CheckCircle, XCircle, CreditCard as Edit3, Eye, ChevronDown, Download, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuditLog as AuditLogType, AuditAction } from '../types';

const ACTION_CONFIG: Record<AuditAction, { label: string; color: string; Icon: React.ElementType }> = {
  APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200',             Icon: XCircle },
  MODIFIED: { label: 'Modified', color: 'bg-blue-50 text-blue-700 border-blue-200',          Icon: Edit3 },
  VIEWED:   { label: 'Viewed',   color: 'bg-slate-50 text-slate-600 border-slate-200',       Icon: Eye },
};

function ActionBadge({ action }: { action: AuditAction }) {
  const { label, color, Icon } = ACTION_CONFIG[action];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide ${color}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

interface Props { onNavigate?: (page: string) => void }

export default function AuditLog({ onNavigate: _onNavigate }: Props) {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [filtered, setFiltered] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'ALL'>('ALL');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, events(production_order, item_code, item_description)')
      .order('created_at', { ascending: false });
    if (data) setLogs(data as AuditLogType[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    let result = [...logs];
    if (actionFilter !== 'ALL') result = result.filter(l => l.action === actionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.user_email.toLowerCase().includes(q) ||
        l.user_name.toLowerCase().includes(q) ||
        (l.events?.production_order || '').toLowerCase().includes(q) ||
        (l.events?.item_code || '').toLowerCase().includes(q) ||
        (l.rejection_reason || '').toLowerCase().includes(q) ||
        (l.sap_document_number || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      return sortDir === 'desc'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    setFiltered(result);
    setPage(0);
  }, [logs, search, actionFilter, sortDir]);

  function exportCSV() {
    const headers = ['Date', 'User', 'Role', 'Action', 'Production Order', 'Item Code', 'Original Qty', 'Modified Qty', 'SAP Document', 'SAP Response', 'Rejection Reason', 'Notes'];
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleString('en-GB'),
      l.user_name,
      l.user_email,
      l.action,
      l.events?.production_order || '',
      l.events?.item_code || '',
      l.original_quantity ?? '',
      l.modified_quantity ?? '',
      l.sap_document_number || '',
      l.sap_response_code ? `${l.sap_response_code} - ${l.sap_response_message}` : '',
      l.rejection_reason || '',
      l.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const actionCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Audit Trail</h2>
          <p className="text-sm text-slate-500 mt-0.5">Complete traceability of all validation decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download size={13} /> Export CSV
          </button>
          <button onClick={fetchLogs} className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Action filter */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {(['ALL', 'APPROVED', 'REJECTED', 'MODIFIED', 'VIEWED'] as const).map(action => {
          const count = action === 'ALL' ? logs.length : (actionCounts[action] || 0);
          const active = actionFilter === action;
          const cfg = action !== 'ALL' ? ACTION_CONFIG[action] : null;
          return (
            <button
              key={action}
              onClick={() => setActionFilter(action)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {cfg && <cfg.Icon size={11} />}
              {action === 'ALL' ? 'All Actions' : cfg?.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search and sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user, order, item, SAP document..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors bg-white"
        >
          <ChevronDown size={14} className={sortDir === 'asc' ? 'rotate-180' : ''} />
          {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Timestamp', 'Operator', 'Production Order', 'Item', 'Action', 'Orig. Qty', 'Mod. Qty', 'SAP Document', 'Response', 'Rejection Reason'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">Loading audit logs...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-sm">No audit log entries found</td></tr>
              ) : paginated.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <User size={12} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{log.user_name || '—'}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[120px]">{log.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                    {log.events?.production_order || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-700">{log.events?.item_code || '—'}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[140px]">{log.events?.item_description || ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-slate-600 text-right">
                    {log.original_quantity ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums font-semibold text-right">
                    {log.modified_quantity !== null && log.modified_quantity !== log.original_quantity ? (
                      <span className="text-amber-700">{log.modified_quantity}</span>
                    ) : (
                      <span className="text-slate-600">{log.modified_quantity ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {log.sap_document_number || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.sap_response_code ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        log.sap_response_code === '200' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {log.sap_response_code}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">
                    {log.rejection_reason ? (
                      <span className="text-red-600">{log.rejection_reason}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}
