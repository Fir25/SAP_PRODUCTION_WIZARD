import { Printer, Download, Home, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export interface SapResult {
  eventId: string;
  success: boolean;
  document_number?: string;
  response_code?: string;
  response_message?: string;
  error?: string;
}

interface WizardStep5SapResultProps {
  sapResults: SapResult[];
  onReturnHome: () => void;
}

export default function WizardStep5SapResult({ sapResults, onReturnHome }: WizardStep5SapResultProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    // In a real implementation, this would generate a PDF
    // For now, we'll use the browser's print to PDF functionality
    window.print();
  };

  const successfulResults = sapResults.filter(r => r.success);
  const failedResults = sapResults.filter(r => !r.success);

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
                Step 5 of 5 - SAP Result
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
              <div className="w-16 h-1 bg-blue-600"></div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Events</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">{sapResults.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <AlertCircle size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Successful</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{successfulResults.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Failed</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{failedResults.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle size={24} className="text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* SAP Results Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
          <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-6 py-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              SAP Response Information
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Event ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    SAP DocEntry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    SAP DocNum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    SAP Document Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Response Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Response Message
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {sapResults.map((result) => (
                  <tr
                    key={result.eventId}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${
                      result.success ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <td className="px-6 py-4">
                      {result.success ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Success</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <XCircle size={16} className="text-red-500" />
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">Error</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-800 dark:text-slate-200">
                      {result.eventId}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                      {result.document_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                      {result.document_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                      {result.success ? 'Goods Receipt' : 'Error'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                      {result.response_code || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 max-w-md">
                      {result.response_message || result.error || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {successfulResults.length} events successfully posted to SAP Business One
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              <Download size={16} />
              Export PDF
            </button>
            <button
              onClick={onReturnHome}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              <Home size={16} />
              Return to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
