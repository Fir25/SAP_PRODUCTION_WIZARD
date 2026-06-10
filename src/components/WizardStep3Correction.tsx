import { useState } from 'react';
import { ChevronLeft, ChevronRight, Save, PlayCircle, XCircle, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { fastApiService, UpdateEventRequest } from '../lib/fastapi';

export interface WmsEvent {
  id: string;
  external_id: string;
  pulse: string; // Event type from middleware (e.g., PincePFE03, SortieWagon)
  event_type: string;
  status: string;
  production_order: string;
  item_code: string;
  item_description: string;
  original_quantity: number;
  modified_quantity: number | null;
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
  sap_date?: string;
  // sap_time?: string;
}

interface WizardStep3CorrectionProps {
  event: WmsEvent;
  onSave: () => void;
  onBack: () => void;
  onNext: () => void;
}

export default function WizardStep3Correction({ event, onSave, onBack, onNext }: WizardStep3CorrectionProps) {
  console.log('EVENT RECEIVED', event);
  const [corrections, setCorrections] = useState({
    product: event.item_code,
    production_order: event.production_order,
    quantity: event.modified_quantity ?? event.original_quantity,
    bin_location: event.bin_location,
    warehouse: event.warehouse_code,
    date: event.sap_date ? event.sap_date.split('T')[0] : '',
    // time: event.sap_time || '',
    comments: event.notes || '',
  });

  const [validationResult, setValidationResult] = useState<{ status: string; errors: any[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleSaveCorrection = async () => {
    setSaving(true);
    try {
      const updateRequest: UpdateEventRequest = {
        event_id: event.id,
        production_order: corrections.production_order,
        item_code: corrections.product,
        bin_location: corrections.bin_location,
        quantity: corrections.quantity,
        product: corrections.product,
        warehouse: corrections.warehouse,
        notes: corrections.comments,
      };

      await fastApiService.updateEvent(updateRequest);
      setValidationResult(null); // Reset validation after correction
      onSave();
    } catch (error) {
      console.error('Error saving correction:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await fastApiService.validateEvent(event.id);
      setValidationResult(result);
    } catch (error) {
      console.error('Error validating event:', error);
    } finally {
      setValidating(false);
    }
  };

  const getValidationIcon = (status: string) => {
    switch (status) {
      case 'OK': return <CheckCircle size={16} className="text-emerald-500" />;
      case 'WARNING': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'ERROR': return <XCircle size={16} className="text-red-500" />;
      default: return <AlertCircle size={16} className="text-slate-500" />;
    }
  };

  const canProceed = validationResult && validationResult.status === 'VALID';

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
                Step 3 of 5 - Event Correction Workspace
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">3</div>
              <div className="w-16 h-1 bg-slate-300 dark:bg-slate-600"></div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">4</div>
              <div className="w-16 h-1 bg-slate-300 dark:bg-slate-600"></div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Correction Form */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Event Details - {event.id}
            </h2>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${event.status === 'VALID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                event.status === 'ERROR' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
              Status: {event.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* Product */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Product
              </label>
              <input
                type="text"
                value={corrections.product}
                onChange={(e) => setCorrections({ ...corrections, product: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Production Order */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Production Order (OF)
              </label>
              <input
                type="text"
                value={corrections.production_order}
                onChange={(e) => setCorrections({ ...corrections, production_order: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quantity */}
           <div>
  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
    Quantity ({event.unit_of_measure})
  </label>

  <input
    type="number"
    value={corrections.quantity === 0 ? '' : corrections.quantity}
    placeholder="Enter quantity"
    onChange={(e) =>
      setCorrections({
        ...corrections,
        quantity: e.target.value === ''
          ? 0
          : Number(e.target.value)
      })
    }
    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

            {/* Bin Location */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Bin Location
              </label>
              <input
                type="text"
                value={corrections.bin_location}
                onChange={(e) => setCorrections({ ...corrections, bin_location: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Warehouse
              </label>
              <input
                type="text"
                value={corrections.warehouse}
                onChange={(e) => setCorrections({ ...corrections, warehouse: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={corrections.date}
                onChange={(e) => setCorrections({ ...corrections, date: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Time */}
            {/* <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Time
              </label>
              <input
                type="time"
                value={corrections.time}
                onChange={(e) => setCorrections({ ...corrections, time: e.target.value })}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div> */}

            {/* Comments */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Comments
              </label>
              <textarea
                value={corrections.comments}
                onChange={(e) => setCorrections({ ...corrections, comments: e.target.value })}
                rows={3}
                placeholder="Add correction notes..."
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Validation Rules */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mb-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
              Validation Rules
            </h3>

            {validationResult ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 p-4 rounded-lg ${validationResult.status === 'VALID'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                  {validationResult.status === 'VALID' ? (
                    <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle size={20} className="text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {validationResult.status === 'VALID' ? 'Validation Passed - Status is VALID' : 'Validation Failed'}
                  </span>
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="space-y-2">
                    {validationResult.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border ${error.severity === 'ERROR'
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
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{error.field}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{error.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Click "Validate" to check all business rules
                    </span>
                  </div>
                </div>
                {event.validation_rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      {getValidationIcon(rule.status)}
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{rule.rule}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{rule.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-slate-200 dark:border-slate-700 pt-6">
            <button
              onClick={handleSaveCorrection}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition"
            >
              <Save size={16} />
              Save Correction
            </button>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 transition"
            >
              <PlayCircle size={16} />
              Validate
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            <ChevronLeft size={16} />
            Back to Results
          </button>
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition"
          >
            Proceed to Approval
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
