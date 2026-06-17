import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Search, Filter, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { fastApiService } from '../lib/fastapi';
import { formatDate, parseToDate } from '../lib/date';
import { webSocketService } from '../lib/websocket';

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

interface EventsSelectionPageProps {
  onEventsSelected: (events: WmsEvent[]) => void;
}

export default function EventsSelectionPage({ onEventsSelected }: EventsSelectionPageProps) {
  const [events, setEvents] = useState<WmsEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<WmsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [ofFilter, setOfFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  // Load events
  useEffect(() => {
    loadEvents();

    // WebSocket for real-time updates
    webSocketService.connect();
    const unsubscribe = webSocketService.subscribe((message) => {
      if (message.type === 'event_created' || message.type === 'event_updated') {
        loadEvents();
      }
    });

    return () => {
      unsubscribe();
      webSocketService.disconnect();
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    // Date + Time range filter (From)
    if (dateFrom || timeFrom) {
      const fromDateTime = new Date(`${dateFrom || '1970-01-01'}T${timeFrom || '00:00:00'}`);
      filtered = filtered.filter(e => {
        const d = parseToDate(e.received_at);
        return d ? d >= fromDateTime : false;
      });
    }

    // Date + Time range filter (To)
    if (dateTo || timeTo) {
      const toDateTime = new Date(`${dateTo || '9999-12-31'}T${timeTo || '23:59:59'}`);
      filtered = filtered.filter(e => {
        const d = parseToDate(e.received_at);
        return d ? d <= toDateTime : false;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    // Machine filter
    if (machineFilter !== 'all') {
      filtered = filtered.filter(e => e.machine_id === machineFilter);
    }

    // OF filter
    if (ofFilter) {
      filtered = filtered.filter(e =>
        (e.production_order || '').toLowerCase().includes(ofFilter.toLowerCase())
      );
    }

    // Product filter
    if (productFilter) {
      filtered = filtered.filter(e =>
        e.item_code.toLowerCase().includes(productFilter.toLowerCase()) ||
        e.item_description.toLowerCase().includes(productFilter.toLowerCase())
      );
    }

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.id.toLowerCase().includes(query) ||
        (e.production_order || '').toLowerCase().includes(query) ||
        e.item_code.toLowerCase().includes(query) ||
        e.item_description.toLowerCase().includes(query) ||
        e.machine_name.toLowerCase().includes(query) ||
        e.bin_location.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events, dateFrom, timeFrom, dateTo, timeTo, statusFilter, machineFilter, ofFilter, productFilter, searchQuery]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fastApiService.getPendingEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
    setSelectAll(newSelected.size === filteredEvents.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleValidateSelected = () => {
    const selected = events.filter(e => selectedEvents.has(e.id));
    onEventsSelected(selected);
  };

  // Get unique values for filters
  const uniqueMachines = [...new Set(events.map(e => e.machine_id))];
  const uniqueStatuses = [...new Set(events.map(e => e.status))];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
      case 'APPROVED': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
      case 'REJECTED': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
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
                Events Selection
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Filter and select events for batch validation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                <Filter size={16} />
                Filters
                {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                onClick={loadEvents}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-4">
  {/* AJOUT DE items-end ICI POUR ALIGNER LES INPUTS EN BAS */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-end">

    {/* From Date */}
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        From Date
      </label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    {/* To Date */}
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        To Date
      </label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    {/* Status Filter */}
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        Status
      </label>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Statuses</option>
        {uniqueStatuses.map(status => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
    </div>

    {/* Machine Filter */}
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        Machine
      </label>
      <select
        value={machineFilter}
        onChange={(e) => setMachineFilter(e.target.value)}
        className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Machines</option>
        {uniqueMachines.map(machine => (
          <option key={machine} value={machine}>{machine}</option>
        ))}
      </select>
    </div>

    {/* OF Filter */}
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        Production Order(OF)
      </label>
      <input
        type="text"
        value={ofFilter}
        onChange={(e) => setOfFilter(e.target.value)}
        placeholder="Search OF..."
        className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* Product Filter */}
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        Product
      </label>
      <input
        type="text"
        value={productFilter}
        onChange={(e) => setProductFilter(e.target.value)}
        placeholder="Search product..."
        className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    
  </div>
</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by ID, OF, product, machine, or bin location..."
              className="w-full pl-12 pr-4 py-3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Events Table */}
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
                    Select All ({filteredEvents.length})
                  </span>
                </label>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedEvents.size} selected
                </span>
              </div>
              {selectedEvents.size > 0 && (
                <button
                  onClick={handleValidateSelected}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                >
                  <Check size={16} />
                  Validate Selected Events
                </button>
              )}
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 dark:text-slate-400">Loading events...</div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 dark:text-slate-400">No events found</div>
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
                      Event ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Heure
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Production Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Machine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Bin Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredEvents.map((event) => (
                    <tr
                      key={event.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${
                        selectedEvents.has(event.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedEvents.has(event.id)}
                          onChange={() => handleSelectEvent(event.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-800 dark:text-slate-200">
                        {event.id}
                      </td>
                      {/* Date / Time */}
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(event.received_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {event.production_order || 'No Production Order'}
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
                      <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200">
                        {event.machine_name}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-800 dark:text-slate-200">
                        {event.bin_location}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}