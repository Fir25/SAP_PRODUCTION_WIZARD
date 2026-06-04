import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, AlertCircle, Edit2, Save, X, Check, PlayCircle } from 'lucide-react';
import { fastApiService, UpdateEventRequest } from '../lib/fastapi';

export interface WmsEvent {
  id: string;
  external_id: string;
  event_type: string;
  status: string;
  production_order: string;
  item_code: string;
  item_description: string;
  original_quantity: number;
  unit_of_measure: string;
  machine_id: string;
  machine_name: string;
  warehouse_code: string;
  bin_location: string;
  validation_rules: Array<{
    rule: string;
    status: string;
    message: string;
  }>;
  notes: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
}

interface OFValidationWorkspaceProps {
  events: WmsEvent[];
  onBack: () => void;
  onRefresh: () => void;
}

interface EventCorrection {
  eventId: string;
  production_order?: string;
  item_code?: string;
  modified_quantity: number;
  bin_location: string;
  warehouse?: string;
  comments: string;
  accepted_warnings: string[];
}

interface ValidationResult {
  eventId: string;
  status: 'VALID' | 'INVALID' | 'PENDING';
  errors: Array<{
    field: string;
    message: string;
    severity: string;
  }>;
}

export default function OFValidationWorkspace({ events, onBack, onRefresh }: OFValidationWorkspaceProps) {
  const [selectedForApproval, setSelectedForApproval] = useState<Set<string>>(new Set());
  const [selectedForRejection, setSelectedForRejection] = useState<Set<string>>(new Set());
  const [expandedOFs, setExpandedOFs] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, EventCorrection>>({});
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Group events by Production Order
  const groupedEvents = events.reduce((acc, event) => {
    const of = event.production_order;
    if (!acc[of]) {
      acc[of] = [];
    }
    acc[of].push(event);
    return acc;
  }, {} as Record<string, WmsEvent[]>);

  const hasProblems = (event: WmsEvent) => {
    return event.validation_rules.some(rule => rule.status === 'ERROR' || rule.status === 'WARNING');
  };

  const getValidationIcon = (status: string) => {
    switch (status) {
      case 'OK': return <CheckCircle size={16} className="text-emerald-500" />;
      case 'WARNING': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'ERROR': return <XCircle size={16} className="text-red-500" />;
      default: return <AlertCircle size={16} className="text-slate-500" />;
    }
  };

  const toggleOFExpansion = (of: string) => {
    const newExpanded = new Set(expandedOFs);
    if (newExpanded.has(of)) {
      newExpanded.delete(of);
    } else {
      newExpanded.add(of);
    }
    setExpandedOFs(newExpanded);
  };

  const startEditing = (eventId: string) => {
    setEditingEvent(eventId);
    const event = events.find(e => e.id === eventId);
    if (event && !corrections[eventId]) {
      setCorrections(prev => ({
        ...prev,
        [eventId]: {
          eventId,
          modified_quantity: event.original_quantity,
          bin_location: event.bin_location,
          comments: event.notes || '',
          accepted_warnings: [],
        }
      }));
    }
  };

  const saveCorrection = async (eventId: string) => {
    const correction = corrections[eventId];
    if (!correction) return;

    try {
      const updateRequest: UpdateEventRequest = {
        event_id: eventId,
        production_order: correction.production_order,
        item_code: correction.item_code,
        bin_location: correction.bin_location,
        quantity: correction.modified_quantity,
        warehouse: correction.warehouse,
        notes: correction.comments,
      };

      await fastApiService.updateEvent(updateRequest);
      setEditingEvent(null);
      // Reset validation status after correction - user must validate again
      setValidationResults(prev => {
        const newResults = { ...prev };
        delete newResults[eventId];
        return newResults;
      });
    } catch (error) {
      console.error('Error saving correction:', error);
      // Handle error - show toast or alert
    }
  };

  const validateEvent = async (eventId: string) => {
    console.log(`🔍 Starting validation for event ${eventId}`);
    try {
      const result = await fastApiService.validateEvent(eventId);
      console.log(`✅ Validation response received for event ${eventId}:`, result);
      
      setValidationResults(prev => ({
        ...prev,
        [eventId]: {
          eventId,
          status: result.status,
          errors: result.errors,
        },
      }));
      
      console.log(`📊 Validation status updated in local state: ${result.status}`);
      
      // Refresh events from backend to get updated status
      console.log(`🔄 Refreshing events from backend...`);
      onRefresh();
      
      console.log(`✅ Events refreshed, approve button should now be ${result.status === 'VALID' ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Error validating event:', error);
      // Handle error - show toast or alert
    }
  };

  const cancelEditing = (eventId: string) => {
    setEditingEvent(null);
    setCorrections(prev => {
      const newCorrections = { ...prev };
      delete newCorrections[eventId];
      return newCorrections;
    });
  };

  const toggleEventSelection = (eventId: string, type: 'approval' | 'rejection') => {
    if (type === 'approval') {
      const newSelected = new Set(selectedForApproval);
      if (newSelected.has(eventId)) {
        newSelected.delete(eventId);
      } else {
        newSelected.add(eventId);
        setSelectedForRejection(prev => {
          const newRejection = new Set(prev);
          newRejection.delete(eventId);
          return newRejection;
        });
      }
      setSelectedForApproval(newSelected);
    } else {
      const newSelected = new Set(selectedForRejection);
      if (newSelected.has(eventId)) {
        newSelected.delete(eventId);
      } else {
        newSelected.add(eventId);
        setSelectedForApproval(prev => {
          const newApproval = new Set(prev);
          newApproval.delete(eventId);
          return newApproval;
        });
      }
      setSelectedForRejection(newSelected);
    }
  };

  const handleApproveSelected = async () => {
    // Check if all selected events are validated
    for (const eventId of selectedForApproval) {
      const validationResult = validationResults[eventId];
      if (!validationResult || validationResult.status !== 'VALID') {
        alert(`Event ${eventId} is not validated. Please validate all events before approval.`);
        return;
      }
    }

    if (selectedForApproval.size === 0) return;
    
    setSubmitting(true);
    setSubmitError('');
    
    try {
      const promises = Array.from(selectedForApproval).map(async (eventId) => {
        const event = events.find(e => e.id === eventId);
        const correction = corrections[eventId];
        
        await fastApiService.approveEvent({
          event_id: eventId,
          modified_quantity: correction?.modified_quantity || event?.original_quantity || 0,
          notes: correction?.comments,
        });
      });
      
      await Promise.all(promises);
      alert('Events approved successfully');
      onBack();
    } catch (error) {
      console.error('Error approving events:', error);
      setSubmitError('Failed to approve events');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSelected = async () => {
    if (selectedForRejection.size === 0) return;
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required');
      return;
    }
    
    setSubmitting(true);
    setSubmitError('');
    
    try {
      const promises = Array.from(selectedForRejection).map(async (eventId) => {
        const correction = corrections[eventId];
        
        await fastApiService.rejectEvent({
          event_id: eventId,
          rejection_reason: rejectionReason,
          notes: correction?.comments,
        });
      });
      
      await Promise.all(promises);
      alert('Events rejected successfully');
      onBack();
    } catch (error) {
      console.error('Error rejecting events:', error);
      setSubmitError('Failed to reject events');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                ← Back to Selection
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  OF Validation Workspace
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {events.length} events across {Object.keys(groupedEvents).length} production orders
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium text-emerald-600">{selectedForApproval.size}</span> selected for approval,
                <span className="font-medium text-red-600 ml-1">{selectedForRejection.size}</span> for rejection
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {Object.entries(groupedEvents).map(([of, ofEvents]) => (
          <div key={of} className="mb-6">
            {/* OF Header */}
            <div
              onClick={() => toggleOFExpansion(of)}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition"
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {expandedOFs.has(of) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{of}</h3>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {ofEvents.length} events
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ofEvents.filter(e => hasProblems(e)).length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-full">
                      <AlertTriangle size={12} />
                      {ofEvents.filter(e => hasProblems(e)).length} issues
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* OF Events */}
            <AnimatePresence>
              {expandedOFs.has(of) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 space-y-2"
                >
                  {ofEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`bg-white dark:bg-slate-800 rounded-lg border ${
                        hasProblems(event) 
                          ? 'border-amber-300 dark:border-amber-600' 
                          : 'border-slate-200 dark:border-slate-700'
                      } overflow-hidden`}
                    >
                      {/* Event Header */}
                      <div
                        onClick={() => startEditing(event.id)}
                        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {hasProblems(event) && <Edit2 size={16} className="text-amber-500" />}
                            <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{event.id}</span>
                          </div>
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {event.item_code} - {event.item_description}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Qty: {event.original_quantity} {event.unit_of_measure}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {event.machine_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Validation Status */}
                          <div className="flex items-center gap-1">
                            {event.validation_rules.map((rule, idx) => (
                              <div key={idx} className="flex items-center gap-1" title={rule.message}>
                                {getValidationIcon(rule.status)}
                              </div>
                            ))}
                          </div>
                          {/* Selection Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEventSelection(event.id, 'approval');
                              }}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                selectedForApproval.has(event.id)
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                              }`}
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEventSelection(event.id, 'rejection');
                              }}
                              className={`px-3 py-1 text-xs font-medium rounded ${
                                selectedForRejection.has(event.id)
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                              }`}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline Correction Panel */}
                      <AnimatePresence>
                        {editingEvent === event.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                          >
                            <div className="px-6 py-4">
                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                                Correct Event {event.id}
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Production Order
                                  </label>
                                  <input
                                    type="text"
                                    value={corrections[event.id]?.production_order || event.production_order}
                                    onChange={(e) => setCorrections(prev => ({
                                      ...prev,
                                      [event.id]: {
                                        ...prev[event.id],
                                        production_order: e.target.value,
                                      }
                                    }))}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Item Code
                                  </label>
                                  <input
                                    type="text"
                                    value={corrections[event.id]?.item_code || event.item_code}
                                    onChange={(e) => setCorrections(prev => ({
                                      ...prev,
                                      [event.id]: {
                                        ...prev[event.id],
                                        item_code: e.target.value,
                                      }
                                    }))}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Quantity ({event.unit_of_measure})
                                  </label>
                                  <input
                                    type="number"
                                    value={corrections[event.id]?.modified_quantity || event.original_quantity}
                                    onChange={(e) => setCorrections(prev => ({
                                      ...prev,
                                      [event.id]: {
                                        ...prev[event.id],
                                        modified_quantity: parseFloat(e.target.value),
                                      }
                                    }))}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Bin Location
                                  </label>
                                  <input
                                    type="text"
                                    value={corrections[event.id]?.bin_location || event.bin_location}
                                    onChange={(e) => setCorrections(prev => ({
                                      ...prev,
                                      [event.id]: {
                                        ...prev[event.id],
                                        bin_location: e.target.value,
                                      }
                                    }))}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                    Warehouse
                                  </label>
                                  <input
                                    type="text"
                                    value={corrections[event.id]?.warehouse || event.warehouse_code}
                                    onChange={(e) => setCorrections(prev => ({
                                      ...prev,
                                      [event.id]: {
                                        ...prev[event.id],
                                        warehouse: e.target.value,
                                      }
                                    }))}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>

                              <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                                  Comments
                                </label>
                                <textarea
                                  value={corrections[event.id]?.comments || ''}
                                  onChange={(e) => setCorrections(prev => ({
                                    ...prev,
                                    [event.id]: {
                                      ...prev[event.id],
                                      comments: e.target.value,
                                    }
                                  }))}
                                  rows={2}
                                  placeholder="Add correction notes..."
                                  className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                              </div>

                              {/* Validation Rules */}
                              <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                                  Validation Status
                                </label>
                                
                                {/* Display validation results if available */}
                                {validationResults[event.id] ? (
                                  <div className="space-y-2">
                                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                                      validationResults[event.id].status === 'VALID' 
                                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                    }`}>
                                      {validationResults[event.id].status === 'VALID' ? (
                                        <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                                      ) : (
                                        <XCircle size={16} className="text-red-600 dark:text-red-400" />
                                      )}
                                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {validationResults[event.id].status === 'VALID' ? 'Validation Passed' : 'Validation Failed'}
                                      </span>
                                    </div>
                                    
                                    {validationResults[event.id].errors.length > 0 && (
                                      <div className="space-y-2">
                                        {validationResults[event.id].errors.map((error, idx) => (
                                          <div
                                            key={idx}
                                            className={`flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border ${
                                              error.severity === 'ERROR' 
                                                ? 'border-red-200 dark:border-red-800' 
                                                : 'border-amber-200 dark:border-amber-800'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              {error.severity === 'ERROR' ? (
                                                <XCircle size={16} className="text-red-500" />
                                              ) : (
                                                <AlertTriangle size={16} className="text-amber-500" />
                                              )}
                                              <span className="text-sm text-slate-700 dark:text-slate-300">{error.field}</span>
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{error.message}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {event.validation_rules.map((rule, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                      >
                                        <div className="flex items-center gap-2">
                                          {getValidationIcon(rule.status)}
                                          <span className="text-sm text-slate-700 dark:text-slate-300">{rule.rule}</span>
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{rule.message}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => saveCorrection(event.id)}
                                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                                >
                                  <Save size={16} />
                                  Save Correction
                                </button>
                                <button
                                  onClick={() => validateEvent(event.id)}
                                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
                                >
                                  <PlayCircle size={16} />
                                  Validate
                                </button>
                                <button
                                  onClick={() => cancelEditing(event.id)}
                                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                  <X size={16} />
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {selectedForRejection.size > 0 && (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (required)..."
                    className="w-64 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={handleRejectSelected}
                    disabled={submitting || !rejectionReason.trim()}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-red-400 transition"
                  >
                    <X size={16} />
                    Reject Selected ({selectedForRejection.size})
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {selectedForApproval.size > 0 && (
                <button
                  onClick={handleApproveSelected}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 transition"
                >
                  <Check size={16} />
                  Approve Selected ({selectedForApproval.size})
                </button>
              )}
            </div>
          </div>
          {submitError && (
            <div className="mt-3 text-sm text-red-600">{submitError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
