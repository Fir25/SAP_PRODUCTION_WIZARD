import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle,
  AlertCircle, Factory, Package, MapPin, Hash, Calendar, Cpu,
  Check, ClipboardCheck, FileText, ThumbsUp, ThumbsDown, Search,
  Filter, RefreshCw, Zap, Sun, Moon
} from 'lucide-react';
import { WmsEvent, ValidationRule } from '../types';
import { fastApiService } from '../lib/fastapi';
import { formatDate } from '../lib/date';
import { webSocketService } from '../lib/websocket';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  'Select Event',
  'Summary',
  'Validation',
  'Adjust Quantity',
  'Decision',
  'Result'
];

function RuleIcon({ status }: { status: ValidationRule['status'] }) {
  if (status === 'OK') return <CheckCircle size={16} className="text-emerald-500" />;
  if (status === 'WARNING') return <AlertTriangle size={16} className="text-amber-500" />;
  return <AlertCircle size={16} className="text-red-500" />;
}

function InfoRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-sm text-slate-800 dark:text-slate-200 text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

export default function SapValidationWizard() {
  const { mode, toggleMode } = useTheme();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<WmsEvent | null>(null);
  const [pendingEvents, setPendingEvents] = useState<WmsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Load pending events on mount
  useEffect(() => {
    loadPendingEvents();
    
    // Connect to WebSocket for real-time updates
    webSocketService.connect();
    
    // Subscribe to WebSocket updates
    const unsubscribe = webSocketService.subscribe((message) => {
      if (message.type === 'event_created' || message.type === 'event_updated') {
        loadPendingEvents();
      }
    });

    return () => {
      unsubscribe();
      webSocketService.disconnect();
    };
  }, []);

  const loadPendingEvents = async () => {
    setLoading(true);
    try {
      const events = await fastApiService.getPendingEvents();
      setPendingEvents(events);
    } catch (error) {
      console.error('Error loading pending events:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = pendingEvents.filter(event =>
    event.production_order.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.item_description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEventSelect = (event: WmsEvent) => {
    setSelectedEvent(event);
    setQuantity(String(event.original_quantity));
    setNotes(event.notes || '');
    setRejectionReason('');
    setSubmitError('');
    setExecutionResult(null);
    setStep(1);
  };

  const handleApprove = async () => {
    if (!selectedEvent || !user) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { setSubmitError('Quantity must be greater than 0'); return; }
    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await fastApiService.approveEvent({
        event_id: selectedEvent.id,
        modified_quantity: qty,
        notes,
      });
      setExecutionResult(result);
      setStep(5);
    } catch (error) {
      setSubmitError('Failed to approve event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedEvent || !user) return;
    if (!rejectionReason.trim()) { setSubmitError('Rejection reason is required'); return; }
    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await fastApiService.rejectEvent({
        event_id: selectedEvent.id,
        rejection_reason: rejectionReason,
        notes,
      });
      setExecutionResult(result);
      setStep(5);
    } catch (error) {
      setSubmitError('Failed to reject event');
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setSelectedEvent(null);
    setStep(0);
    setExecutionResult(null);
    loadPendingEvents();
  };

  const eventTypeLabel: Record<string, string> = {
    PRODUCTION_RECEIPT: 'Production Receipt',
    MATERIAL_CONSUMPTION: 'Material Consumption',
    STOCK_TRANSFER: 'Stock Transfer',
    STOCK_ADJUSTMENT: 'Stock Adjustment',
  };

  return (
    <div className={`min-h-screen ${mode === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
      {/* Header */}
      <header className={`${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b px-6 py-4`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600">
              <Factory size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-white">SAP B1 Validation Wizard</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Industrial Production Events</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadPendingEvents}
              className={`p-2 rounded-lg ${mode === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} transition-colors`}
              title="Refresh events"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={toggleMode}
              className={`p-2 rounded-lg ${mode === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'} transition-colors`}
              title="Toggle theme"
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full border border-amber-200 dark:border-amber-700">
              <Zap size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">DEMO MODE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {/* Step 0: Pending Events Selection */}
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Pending Events</h2>
                <p className="text-slate-500 dark:text-slate-400">Select a production event to validate and send to SAP Business One</p>
              </div>

              {/* Search and Filters */}
              <div className={`${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border p-4 mb-6`}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by OF, product code, or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${
                        mode === 'dark'
                          ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                          : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                  <button className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${
                    mode === 'dark'
                      ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  } transition-colors`}>
                    <Filter size={18} />
                    Filters
                  </button>
                </div>
              </div>

              {/* Events List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={32} className="text-slate-400 animate-spin" />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className={`${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border p-12 text-center`}>
                  <ClipboardCheck size={48} className="text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No pending events found</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredEvents.map((event) => (
                    <motion.button
                      key={event.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleEventSelect(event)}
                      className={`${mode === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-white border-slate-200 hover:bg-slate-50'} rounded-xl border p-5 text-left transition-all`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                          <Cpu size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-slate-800 dark:text-white">{event.production_order}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              event.validation_rules.some(r => r.status === 'ERROR')
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : event.validation_rules.some(r => r.status === 'WARNING')
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            }`}>
                              {event.validation_rules.some(r => r.status === 'ERROR') ? 'ERRORS' :
                               event.validation_rules.some(r => r.status === 'WARNING') ? 'WARNINGS' : 'VALID'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{event.item_description}</p>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{event.item_code}</span>
                            <span>•</span>
                            <span>{event.machine_name}</span>
                            <span>•</span>
                            <span>{formatDate(event.received_at)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-slate-800 dark:text-white">{event.original_quantity}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{event.unit_of_measure}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Steps 1-5: Wizard Steps */}
          {step > 0 && selectedEvent && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-4xl mx-auto"
            >
              {/* Step Progress */}
              <div className={`${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border p-4 mb-6`}>
                <div className="flex items-center gap-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                      <button
                        onClick={() => i <= step && i > 0 && setStep(i)}
                        disabled={i > step || i === 0}
                        className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                          i === step ? 'text-blue-600 dark:text-blue-400' : i < step ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        <span className={`
                          w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                          ${i === step ? 'border-blue-600 dark:border-blue-400 bg-blue-600 dark:bg-blue-400 text-white' :
                            i < step ? 'border-emerald-500 bg-emerald-500 text-white' :
                            'border-slate-300 dark:border-slate-600 text-slate-400'}
                        `}>
                          {i < step ? <Check size={12} /> : i + 1}
                        </span>
                        <span className="hidden sm:block">{s}</span>
                      </button>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <div className={`${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border overflow-hidden`}>
                {/* Step 1: Event Summary */}
                {step === 1 && (
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Factory size={20} className="text-blue-600 dark:text-blue-400" />
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">Event Summary</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-3">
                          <ClipboardCheck size={16} className="text-slate-500" />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Production</span>
                        </div>
                        <InfoRow label="Order" value={selectedEvent.production_order} mono />
                        <InfoRow label="Type" value={eventTypeLabel[selectedEvent.event_type] || selectedEvent.event_type} />
                        <InfoRow label="Received" value={formatDate(selectedEvent.received_at)} />
                      </div>
                      <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Package size={16} className="text-slate-500" />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Item</span>
                        </div>
                        <InfoRow label="Code" value={selectedEvent.item_code} mono />
                        <InfoRow label="Description" value={selectedEvent.item_description} />
                        <InfoRow label="Quantity" value={`${selectedEvent.original_quantity} ${selectedEvent.unit_of_measure}`} />
                      </div>
                      <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Cpu size={16} className="text-slate-500" />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Machine</span>
                        </div>
                        <InfoRow label="ID" value={selectedEvent.machine_id} mono />
                        <InfoRow label="Name" value={selectedEvent.machine_name} />
                      </div>
                      <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin size={16} className="text-slate-500" />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Location</span>
                        </div>
                        <InfoRow label="Warehouse" value={selectedEvent.warehouse_code} mono />
                        <InfoRow label="Bin" value={selectedEvent.bin_location} mono />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Business Rules Validation */}
                {step === 2 && (
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Hash size={20} className="text-blue-600 dark:text-blue-400" />
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">Business Rules Validation</h2>
                    </div>
                    <div className="space-y-3">
                      {selectedEvent.validation_rules.map((rule, i) => (
                        <div key={i} className={`
                          flex items-start gap-3 rounded-xl p-4 border
                          ${rule.status === 'OK' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
                            rule.status === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                            'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}
                        `}>
                          <RuleIcon status={rule.status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{rule.rule.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{rule.message}</p>
                          </div>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                            rule.status === 'OK' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                            rule.status === 'WARNING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          }`}>{rule.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Quantity Adjustment */}
                {step === 3 && (
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <FileText size={20} className="text-blue-600 dark:text-blue-400" />
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">Quantity Adjustment</h2>
                    </div>
                    <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4 mb-6`}>
                      <InfoRow label="Production Order" value={selectedEvent.production_order} mono />
                      <InfoRow label="Item Code" value={selectedEvent.item_code} mono />
                      <InfoRow label="Original Quantity" value={`${selectedEvent.original_quantity} ${selectedEvent.unit_of_measure}`} />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                          Validated Quantity <span className="text-slate-400 font-normal lowercase">({selectedEvent.unit_of_measure})</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className={`w-full border rounded-lg px-4 py-2.5 text-sm font-mono font-semibold
                              focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                              ${mode === 'dark'
                                ? 'bg-slate-700 border-slate-600 text-white'
                                : 'bg-white border-slate-300 text-slate-800'
                              }`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                            {selectedEvent.unit_of_measure}
                          </span>
                        </div>
                        {parseFloat(quantity) !== selectedEvent.original_quantity && parseFloat(quantity) > 0 && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Modified: {selectedEvent.original_quantity} → {quantity} {selectedEvent.unit_of_measure}
                            {' '}({((parseFloat(quantity) - selectedEvent.original_quantity) / selectedEvent.original_quantity * 100).toFixed(1)}% change)
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                          Operator Notes <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          placeholder="Add any relevant notes or observations..."
                          className={`w-full border rounded-lg px-4 py-2.5 text-sm resize-none
                            focus:outline-none focus:ring-2 focus:ring-blue-500 transition
                            ${mode === 'dark'
                              ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                              : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                            }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Final Decision */}
                {step === 4 && (
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">Final Decision</h2>
                    </div>
                    <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl p-4 mb-6 space-y-0`}>
                      <InfoRow label="Production Order" value={selectedEvent.production_order} mono />
                      <InfoRow label="Item" value={`${selectedEvent.item_code} — ${selectedEvent.item_description}`} />
                      <InfoRow label="Validated Quantity" value={`${quantity || selectedEvent.original_quantity} ${selectedEvent.unit_of_measure}`} />
                      {notes && <InfoRow label="Notes" value={notes} />}
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                        Rejection Reason <span className="text-slate-400 font-normal lowercase">(required for rejection)</span>
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => { setRejectionReason(e.target.value); setSubmitError(''); }}
                        rows={2}
                        placeholder="Explain why this event is being rejected..."
                        className={`w-full border rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 transition
                          ${mode === 'dark'
                            ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                            : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                          }`}
                      />
                    </div>
                    {submitError && (
                      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 mb-4">
                        <AlertCircle size={15} className="text-red-500 shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleReject}
                        disabled={submitting}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ThumbsDown size={16} />
                        {submitting ? 'Processing...' : 'Reject'}
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={submitting}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-600 dark:bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <ThumbsUp size={16} />
                        {submitting ? 'Sending to SAP...' : 'Approve & Send to SAP'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 5: Execution Result */}
                {step === 5 && executionResult && (
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      {executionResult.success ? (
                        <CheckCircle size={20} className="text-emerald-500" />
                      ) : (
                        <XCircle size={20} className="text-red-500" />
                      )}
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wide">Execution Result</h2>
                    </div>
                    <div className={`rounded-xl p-6 border text-center ${
                      executionResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}>
                      {executionResult.success ? (
                        <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
                      ) : (
                        <XCircle size={48} className="text-red-500 mx-auto mb-4" />
                      )}
                      <p className="font-bold text-slate-800 dark:text-white text-lg mb-2">
                        {executionResult.success ? 'Event Approved Successfully' : 'Event Rejected'}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                        {executionResult.response_message || executionResult.error}
                      </p>
                      {executionResult.document_number && (
                        <div className={`${mode === 'dark' ? 'bg-slate-700' : 'bg-white'} rounded-lg p-4 mb-4`}>
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">SAP Document Number</p>
                          <p className="text-lg font-mono font-bold text-slate-800 dark:text-white">{executionResult.document_number}</p>
                        </div>
                      )}
                      <div className="text-left space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Validated by:</span>
                          <span className="font-medium text-slate-800 dark:text-white">{profile?.full_name || user?.email}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Timestamp:</span>
                          <span className="font-medium text-slate-800 dark:text-white">{new Date().toLocaleString('en-GB')}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={resetWizard}
                      className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                    >
                      Validate Another Event
                    </button>
                  </div>
                )}
              </div>

              {/* Navigation */}
              {step > 0 && step < 5 && (
                <div className={`flex items-center justify-between mt-6 ${mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-xl border p-4`}>
                  <button
                    onClick={() => setStep(s => Math.max(0, s - 1))}
                    disabled={step === 1}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span className="text-xs text-slate-400">{step} / {STEPS.length - 1}</span>
                  {step < 4 && (
                    <button
                      onClick={() => setStep(s => Math.min(5, s + 1))}
                      className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Cancel Button */}
              {step > 0 && step < 5 && (
                <button
                  onClick={resetWizard}
                  className={`mt-4 w-full py-2.5 rounded-lg border ${
                    mode === 'dark'
                      ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  } text-sm font-medium transition-colors`}
                >
                  Cancel and Return to Event List
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
