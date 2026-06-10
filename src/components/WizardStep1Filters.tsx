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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 pb-32">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                Production Validation Wizard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Step 1 of 5 - Search Filters
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">1</div>
                <div className="w-16 h-1 bg-blue-600 rounded"></div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">2</div>
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">3</div>
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">4</div>
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">5</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Search Filters</h2>

        {/* Section Cards */}
        <div className="space-y-6">
          {/* SECTION 1: Posting Date */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-black/20 border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="text-blue-600" size={20} />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Posting Date (Accounting Date)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">From</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={filters.postingDateFrom}
                    onChange={(e) => setFilters({ ...filters, postingDateFrom: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">To</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={filters.postingDateTo}
                    onChange={(e) => setFilters({ ...filters, postingDateTo: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Real Production Date */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-black/20 border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="text-emerald-600" size={20} />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Real Production Date</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">From</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={filters.realDateFrom}
                    onChange={(e) => setFilters({ ...filters, realDateFrom: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">To</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={filters.realDateTo}
                    onChange={(e) => setFilters({ ...filters, realDateTo: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Real Production Time */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-black/20 border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-indigo-600" size={20} />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Real Production Time</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">From</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="time"
                    value={filters.realTimeFrom}
                    onChange={(e) => setFilters({ ...filters, realTimeFrom: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">To</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="time"
                    value={filters.realTimeTo}
                    onChange={(e) => setFilters({ ...filters, realTimeTo: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Production Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-black/20 border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="text-sky-600" size={20} />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Production Filters</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Event Type (Pulse)</label>
                <select
                  value={filters.eventType}
                  onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                  disabled={loadingMetadata}
                  className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                >
                  <option value="">All Event Types</option>
                  {eventTypes.map(eventType => (
                    <option key={eventType} value={eventType}>{eventType}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Product</label>
                <select
                  value={filters.product}
                  onChange={(e) => setFilters({ ...filters, product: e.target.value })}
                  disabled={loadingMetadata}
                  className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                >
                  <option value="">All Products</option>
                  {products.map(product => (
                    <option key={product} value={product}>{product}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Production Order (OF) - Optional</label>
                <input
                  type="text"
                  value={filters.productionOrder}
                  onChange={(e) => setFilters({ ...filters, productionOrder: e.target.value })}
                  placeholder="Enter production order..."
                  className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-700 py-4 z-30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <RotateCcw size={16} />
              Reset Filters
            </button>

            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-3 text-sm md:text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition"
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
