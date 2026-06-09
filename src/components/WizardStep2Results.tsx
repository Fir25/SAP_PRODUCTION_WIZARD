import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../lib/date';
import { WmsEvent } from '../types';
import { getValidationStatus, ValidationStatus } from '../lib/validation';

interface WizardStep2ResultsProps {
  events: WmsEvent[];
  selectedEvents: Set<string>;
  onEventSelect: (eventId: string) => void;
  onSelectAll: () => void;
  onNext: () => void;
  onBack: () => void;
  onEventClick: (event: WmsEvent) => void;
}

export default function WizardStep2Results({
  events,
  selectedEvents,
  onEventSelect,
  onSelectAll,
  onNext,
  onBack,
  onEventClick,
}: WizardStep2ResultsProps) {
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = () => {
    setSelectAll(!selectAll);
    onSelectAll();
  };

  // Use shared validation utility
  // (keeps UI and navigation logic consistent)
  // getValidationStatus imported from ../lib/validation

  const getValidationIndicator = (event: WmsEvent) => {
    const status: ValidationStatus = getValidationStatus(event);
    switch (status) {
      case 'valid':
        return (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Valid</span>
          </div>
        );
      case 'invalid':
        return (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Invalid</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500"></div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Warning</span>
          </div>
        );
      // default:
      //   return (
      //     <div className="flex items-center gap-2">
      //       <div className="w-4 h-4 rounded-full bg-slate-400"></div>
      //       <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Pending</span>
      //     </div>
      //   );
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
                Step 2 of 5 - Search Results ({events.length} events found)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
              <div className="w-16 h-1 bg-slate-300 dark:bg-slate-600"></div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">3</div>
              <div className="w-16 h-1 bg-slate-300 dark:bg-slate-600"></div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">4</div>
              <div className="w-16 h-1 bg-slate-300 dark:bg-slate-600"></div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Select All
                  </span>
                </label>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedEvents.size} selected
                </span>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {events.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 dark:text-slate-400">No events found matching your filters</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Select
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Validation Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Date
                    </th>
                    {/* <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Time
                    </th> */}
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Event Type (Pulse)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Production Order (OF)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Bin Location
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {events.map((event) => {
                    const validationStatus = getValidationStatus(event);
                    const isInvalid = validationStatus === 'invalid';
                    return (
                      <tr
                        key={event.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${selectedEvents.has(event.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedEvents.has(event.id)}
                            onChange={() => onEventSelect(event.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {getValidationIndicator(event)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(event.received_at)}
                        </td>
                        {/* <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {event.sap_time || '-'}
                        </td> */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {event.item_code}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {event.item_description}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                          {event.pulse}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => onEventClick(event)}
                            className={`text-sm font-medium ${isInvalid
                                ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline cursor-pointer'
                                : 'text-slate-800 dark:text-slate-200 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer'
                              }`}
                          >
                            {event.production_order}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                          {event.modified_quantity ?? event.original_quantity} {event.unit_of_measure}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-800 dark:text-slate-200">
                          {event.bin_location}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            <ChevronLeft size={16} />
            Back to Filters
          </button>
          <button
            onClick={onNext
              
            }
            disabled={selectedEvents.size === 0}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition"
          >
            Review Selected Events ({selectedEvents.size})
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
