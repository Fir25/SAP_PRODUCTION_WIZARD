import { useState } from 'react';
import { ChevronLeft, Check, X, AlertTriangle } from 'lucide-react';
import { fastApiService, ApproveEventRequest, RejectEventRequest } from '../lib/fastapi';
import { WmsEvent } from '../types';
import { getValidationStatus } from '../lib/validation';

interface WizardStep4ApprovalProps {
  events: WmsEvent[];
  onBack: () => void;
  onNext: (sapResults: SapResult[]) => void;
}

export interface SapResult {
  eventId: string;
  success: boolean;
  document_number?: string;
  response_code?: string;
  response_message?: string;
  error?: string;
}

export default function WizardStep4Approval({ events, onBack, onNext }: WizardStep4ApprovalProps) {
  const [selectedForApproval, setSelectedForApproval] = useState<Set<string>>(new Set(events.map(e => e.id)));
  const [selectedForRejection, setSelectedForRejection] = useState<Set<string>>(new Set());
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // `events` prop already contains only the events allowed to proceed from Step 2
  // (ProductionWizard ensures invalid events are blocked). We still compute
  // which of these are strictly 'valid' vs 'warning' for display.
  const readyEvents = events;
  const validatedEvents = readyEvents.filter(e => getValidationStatus(e) === 'valid');
  const warningEvents = readyEvents.filter(e => getValidationStatus(e) === 'warning');

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
    if (selectedForApproval.size === 0) return;
    
    setSubmitting(true);
    setSubmitError('');
    
    try {
      const sapResults: SapResult[] = [];
      
      for (const eventId of selectedForApproval) {
        const event = events.find(e => e.id === eventId);
        try {
          const request: ApproveEventRequest = {
            event_id: eventId,
            modified_quantity: event?.original_quantity || 0,
            notes: event?.notes || undefined,
          };
          
          const response = await fastApiService.approveEvent(request);
          sapResults.push({
            eventId,
            success: response.success,
            document_number: response.document_number,
            response_code: response.response_code,
            response_message: response.response_message,
            error: response.error,
          });
        } catch (error) {
          sapResults.push({
            eventId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      onNext(sapResults);
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
      for (const eventId of selectedForRejection) {
        const event = events.find(e => e.id === eventId);
        try {
          const request: RejectEventRequest = {
            event_id: eventId,
            rejection_reason: rejectionReason,
            notes: event?.notes || undefined,
          };
          
          await fastApiService.rejectEvent(request);
        } catch (error) {
          console.error(`Error rejecting event ${eventId}:`, error);
        }
      }
      
      alert('Events rejected successfully');
      onBack();
    } catch (error) {
      console.error('Error rejecting events:', error);
      setSubmitError('Failed to reject events');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALID': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
      case 'PENDING': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
      case 'ERROR': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-slate-600 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                Production Validation Wizard
              </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Step 4 of 5 - Approval Review ({readyEvents.length} events ready — {validatedEvents.length} valid, {warningEvents.length} warnings)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">3</div>
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">4</div>
              <div className="w-16 h-1 bg-slate-300 dark:bg-slate-600"></div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Table */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedForApproval.size} selected for approval,
                  <span className="font-medium text-red-600 ml-1">{selectedForRejection.size} for rejection</span>
                </span>
              </div>
              {validatedEvents.length === 0 && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm">No validated events available for approval</span>
                </div>
              )}
            </div>
          </div>

          {/* Table Content */}
          {validatedEvents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 dark:text-slate-400">No validated events to review. Please validate events in Step 3.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Actions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Production Order (OF)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {validatedEvents.map((event) => (
                    <tr
                      key={event.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${
                        selectedForApproval.has(event.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                        selectedForRejection.has(event.id) ? 'bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleEventSelection(event.id, 'approval')}
                            className={`px-3 py-1 text-xs font-medium rounded ${
                              selectedForApproval.has(event.id)
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => toggleEventSelection(event.id, 'rejection')}
                            className={`px-3 py-1 text-xs font-medium rounded ${
                              selectedForRejection.has(event.id)
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {event.production_order}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {event.item_code}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {event.item_description}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                        {event.original_quantity} {event.unit_of_measure}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rejection Reason Input */}
        {selectedForRejection.size > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mt-6">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Rejection Reason (required)
            </label>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <div className="flex items-center gap-3">
            {selectedForRejection.size > 0 && (
              <button
                onClick={handleRejectSelected}
                disabled={submitting || !rejectionReason.trim()}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-slate-400 transition"
              >
                <X size={16} />
                Reject Selected ({selectedForRejection.size})
              </button>
            )}
            {selectedForApproval.size > 0 && (
              <button
                onClick={handleApproveSelected}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 transition"
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
  );
}
