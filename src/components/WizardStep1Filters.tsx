import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, RotateCcw } from 'lucide-react';
import { fastApiService } from '../lib/fastapi';

export interface SearchFilters {
  postingDateFrom: string;
  postingDateTo: string;
  realDateFrom: string;
  realDateTo: string;
  realTimeFrom: string;
  realTimeTo: string;
  eventType: string;
  product: string;
  productionOrder: string;
}

interface WizardStep1FiltersProps {
  onSearch: (filters: SearchFilters) => void;
  onReset: () => void;
}

export default function WizardStep1Filters({ onSearch, onReset }: WizardStep1FiltersProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    postingDateFrom: '',
    postingDateTo: '',
    realDateFrom: '',
    realDateTo: '',
    realTimeFrom: '',
    realTimeTo: '',
    eventType: '',
    product: '',
    productionOrder: '',
  });

  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const metadata = await fastApiService.getEventsMetadata();
        setEventTypes(metadata.event_types);
        setProducts(metadata.products);
      } catch (error) {
        console.error('Error loading events metadata:', error);
      } finally {
        setLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, []);

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({
      postingDateFrom: '',
      postingDateTo: '',
      realDateFrom: '',
      realDateTo: '',
      realTimeFrom: '',
      realTimeTo: '',
      eventType: '',
      product: '',
      productionOrder: '',
    });
    onReset();
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
                Step 1 of 5 - Search Filters
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                <div className="w-16 h-1 bg-blue-600"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center text-sm font-bold">2</div>
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

      {/* Filters Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">
            Search Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Posting Date (Accounting Date) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Posting Date (Accounting Date) - From
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={filters.postingDateFrom}
                  onChange={(e) => setFilters({ ...filters, postingDateFrom: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Posting Date (Accounting Date) - To
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={filters.postingDateTo}
                  onChange={(e) => setFilters({ ...filters, postingDateTo: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">  
            {/* Real Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Real Date - From
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={filters.realDateFrom}
                  onChange={(e) => setFilters({ ...filters, realDateFrom: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Real Date - To
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={filters.realDateTo}
                  onChange={(e) => setFilters({ ...filters, realDateTo: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

            {/* Real Time */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Real Time - From
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="time"
                  value={filters.realTimeFrom}
                  onChange={(e) => setFilters({ ...filters, realTimeFrom: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Real Time - To
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="time"
                  value={filters.realTimeTo}
                  onChange={(e) => setFilters({ ...filters, realTimeTo: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Event Type Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Event Type (Pulse)
              </label>
              <select
                value={filters.eventType}
                onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                disabled={loadingMetadata}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">All Event Types</option>
                {eventTypes.map(eventType => (
                  <option key={eventType} value={eventType}>{eventType}</option>
                ))}
              </select>
            </div>

            {/* Product Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Product
              </label>
              <select
                value={filters.product}
                onChange={(e) => setFilters({ ...filters, product: e.target.value })}
                disabled={loadingMetadata}
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">All Products</option>
                {products.map(product => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </div>

            {/* Production Order Filter (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Production Order (OF) - Optional
              </label>
              <input
                type="text"
                value={filters.productionOrder}
                onChange={(e) => setFilters({ ...filters, productionOrder: e.target.value })}
                placeholder="Enter production order..."
                className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              <RotateCcw size={16} />
              Reset Filters
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              <Search size={16} />
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
