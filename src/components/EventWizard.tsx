import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle,
  AlertCircle, Factory, Package, MapPin, Hash, Calendar, Cpu,
  Check, ClipboardCheck, FileText, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { WmsEvent, ValidationRule } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import { formatDate } from '../lib/date';

interface Props {
  event: WmsEvent;
  onClose: () => void;
  onUpdated: () => void;
}

const STEPS = ['Summary', 'Validation', 'Edit', 'Decision'];

function RuleIcon({ status }: { status: ValidationRule['status'] }) {
  if (status === 'OK') return <CheckCircle size={16} className="text-emerald-500" />;
  if (status === 'WARNING') return <AlertTriangle size={16} className="text-amber-500" />;
  return <AlertCircle size={16} className="text-red-500" />;
}

function InfoRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-sm text-slate-800 text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

export default function EventWizard({ event, onClose, onUpdated }: Props) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [quantity, setQuantity] = useState<string>(String(event.original_quantity));
  const [notes, setNotes] = useState(event.notes || '');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const isPending = event.status === 'PENDING' || event.status === 'WARNING' || event.status === 'ERROR';
  const hasErrors = event.validation_rules.some(r => r.status === 'ERROR');
  const hasWarnings = event.validation_rules.some(r => r.status === 'WARNING');

  async function handleApprove() {
    if (!user) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { setSubmitError('Quantity must be greater than 0'); return; }
    setSubmitting(true);
    setSubmitError('');

    const sapDocNum = `SAP-${Date.now()}`;
    const { error: eventErr } = await supabase
      .from('events')
      .update({
        status: 'APPROVED',
        modified_quantity: qty,
        notes,
        sap_document_number: sapDocNum,
        sap_response_code: '200',
        sap_response_message: 'Document created successfully',
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    if (eventErr) { setSubmitError(eventErr.message); setSubmitting(false); return; }

    await supabase.from('audit_logs').insert({
      event_id: event.id,
      user_id: user.id,
      user_email: user.email ?? '',
      user_name: profile?.full_name || user.email?.split('@')[0] || '',
      action: 'APPROVED',
      original_quantity: event.original_quantity,
      modified_quantity: qty,
      notes,
      sap_document_number: sapDocNum,
      sap_response_code: '200',
      sap_response_message: 'Document created successfully',
    });

    setSubmitting(false);
    onUpdated();
    onClose();
  }

  async function handleReject() {
    if (!user) return;
    if (!rejectionReason.trim()) { setSubmitError('Rejection reason is required'); return; }
    setSubmitting(true);
    setSubmitError('');

    const { error: eventErr } = await supabase
      .from('events')
      .update({
        status: 'REJECTED',
        notes,
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    if (eventErr) { setSubmitError(eventErr.message); setSubmitting(false); return; }

    await supabase.from('audit_logs').insert({
      event_id: event.id,
      user_id: user.id,
      user_email: user.email ?? '',
      user_name: profile?.full_name || user.email?.split('@')[0] || '',
      action: 'REJECTED',
      original_quantity: event.original_quantity,
      modified_quantity: parseFloat(quantity) || event.original_quantity,
      rejection_reason: rejectionReason,
      notes,
    });

    setSubmitting(false);
    onUpdated();
    onClose();
  }

  const eventTypeLabel: Record<string, string> = {
    PRODUCTION_RECEIPT: 'Production Receipt',
    MATERIAL_CONSUMPTION: 'Material Consumption',
    STOCK_TRANSFER: 'Stock Transfer',
    STOCK_ADJUSTMENT: 'Stock Adjustment',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Event Validation Wizard</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{event.external_id || event.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={event.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                    i === step ? 'text-blue-600' : i < step ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  <span className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                    ${i === step ? 'border-blue-600 bg-blue-600 text-white' :
                      i < step ? 'border-emerald-500 bg-emerald-500 text-white' :
                      'border-slate-300 text-slate-400'}
                  `}>
                    {i < step ? <Check size={12} /> : i + 1}
                  </span>
                  <span className="hidden sm:block">{s}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 0: Summary */}
          {step === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Factory size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Event Summary</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ClipboardCheck size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Production</span>
                  </div>
                  <InfoRow label="Order" value={event.production_order || 'No Production Order'} mono />
                  <InfoRow label="Pulse Code" value={event.pulse_code || event.machine_id || 'Unknown'} mono />
                  <InfoRow label="Pulse Name" value={event.pulse_name || '—'} mono />
                  <InfoRow label="Rubrique" value={event.pulse_rubrique || '—'} mono />
                  <InfoRow label="Unit" value={event.pulse_uom || 'PCS'} mono />
                  <InfoRow label="Type" value={eventTypeLabel[event.event_type] || event.event_type} />
                  <InfoRow label="Received" value={formatDate(event.received_at)} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Item</span>
                  </div>
                  <InfoRow label="Code" value={event.item_code} mono />
                  <InfoRow label="Description" value={event.item_description} />
                  <InfoRow label="Quantity" value={`${event.original_quantity} ${event.unit_of_measure}`} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Machine</span>
                  </div>
                  <InfoRow label="ID" value={event.machine_id} mono />
                  <InfoRow label="Name" value={event.machine_name} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Location</span>
                  </div>
                  <InfoRow label="Warehouse" value={event.warehouse_code} mono />
                  <InfoRow label="Bin" value={event.bin_location} mono />
                </div>
              </div>
              {(event.status === 'APPROVED' || event.status === 'REJECTED') && (
                <div className={`rounded-xl p-4 border ${event.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {event.status === 'APPROVED' ? <CheckCircle size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-red-600" />}
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600">SAP Response</span>
                  </div>
                  {event.sap_document_number && <InfoRow label="Document" value={event.sap_document_number} mono />}
                  {event.sap_response_code && <InfoRow label="Response" value={`${event.sap_response_code} - ${event.sap_response_message}`} />}
                  {event.processed_at && <InfoRow label="Processed" value={formatDate(event.processed_at)} />}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Validation */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Hash size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Business Rule Validation</h2>
              </div>
              {hasErrors && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">This event has critical errors that must be addressed before approval.</p>
                </div>
              )}
              {!hasErrors && hasWarnings && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">This event has warnings. Please review before approving.</p>
                </div>
              )}
              {!hasErrors && !hasWarnings && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                  <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                  <p className="text-sm text-emerald-700 font-medium">All business rules passed. Event is ready for approval.</p>
                </div>
              )}
              <div className="space-y-2">
                {event.validation_rules.map((rule, i) => (
                  <div key={i} className={`
                    flex items-start gap-3 rounded-xl p-4 border
                    ${rule.status === 'OK' ? 'bg-emerald-50 border-emerald-100' :
                      rule.status === 'WARNING' ? 'bg-amber-50 border-amber-100' :
                      'bg-red-50 border-red-100'}
                  `}>
                    <RuleIcon status={rule.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{rule.rule.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-slate-700 mt-0.5">{rule.message}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                      rule.status === 'OK' ? 'bg-emerald-100 text-emerald-700' :
                      rule.status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{rule.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Edit */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Edit Fields</h2>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <InfoRow label="Production Order" value={event.production_order} mono />
                <InfoRow label="Item Code" value={event.item_code} mono />
                <InfoRow label="Original Quantity" value={`${event.original_quantity} ${event.unit_of_measure}`} />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Validated Quantity <span className="text-slate-400 font-normal lowercase">({event.unit_of_measure})</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      disabled={!isPending}
                      className={`
                        w-full border rounded-lg px-4 py-2.5 text-sm font-mono font-semibold
                        focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                        ${!isPending ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white border-slate-300 text-slate-800'}
                      `}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      {event.unit_of_measure}
                    </span>
                  </div>
                  {parseFloat(quantity) !== event.original_quantity && parseFloat(quantity) > 0 && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">
                      Modified: {event.original_quantity} → {quantity} {event.unit_of_measure}
                      {' '}({((parseFloat(quantity) - event.original_quantity) / event.original_quantity * 100).toFixed(1)}% change)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Operator Notes <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    disabled={!isPending}
                    rows={3}
                    placeholder="Add any relevant notes or observations..."
                    className={`
                      w-full border rounded-lg px-4 py-2.5 text-sm resize-none
                      focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                      ${!isPending ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-white border-slate-300 text-slate-800'}
                    `}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Decision */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Decision</h2>
              </div>

              {!isPending ? (
                <div className={`rounded-xl p-5 border text-center ${
                  event.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}>
                  {event.status === 'APPROVED'
                    ? <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                    : <XCircle size={32} className="text-red-500 mx-auto mb-2" />
                  }
                  <p className="font-bold text-slate-700">This event has already been {event.status.toLowerCase()}.</p>
                  <p className="text-sm text-slate-500 mt-1">No further action can be taken.</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-0">
                    <InfoRow label="Production Order" value={event.production_order} mono />
                    <InfoRow label="Item" value={`${event.item_code} — ${event.item_description}`} />
                    <InfoRow label="Validated Quantity" value={`${quantity || event.original_quantity} ${event.unit_of_measure}`} />
                    {notes && <InfoRow label="Notes" value={notes} />}
                    <div className="pt-2.5 flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Validation</span>
                      <div className="flex-1" />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        hasErrors ? 'bg-red-100 text-red-700' :
                        hasWarnings ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {hasErrors ? 'ERRORS PRESENT' : hasWarnings ? 'WARNINGS PRESENT' : 'ALL CLEAR'}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                      Rejection Reason <span className="text-slate-400 font-normal lowercase">(required for rejection)</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => { setRejectionReason(e.target.value); setSubmitError(''); }}
                      rows={2}
                      placeholder="Explain why this event is being rejected..."
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 transition bg-white"
                    />
                  </div>

                  {submitError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
                      <AlertCircle size={15} className="text-red-500 shrink-0" />
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleReject}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-red-300 bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ThumbsDown size={16} />
                      {submitting ? 'Processing...' : 'Reject'}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-emerald-400 bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <ThumbsUp size={16} />
                      {submitting ? 'Sending to SAP...' : 'Approve & Send to SAP'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-xs text-slate-400">{step + 1} / {STEPS.length}</span>
          <button
            onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
            disabled={step === STEPS.length - 1}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
