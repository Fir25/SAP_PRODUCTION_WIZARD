import { useState } from 'react';
import { parseToDate } from '../lib/date';
import { fastApiService } from '../lib/fastapi';
import WizardStep1Filters, { SearchFilters } from './WizardStep1Filters';
import WizardStep2Results from './WizardStep2Results';
import { WmsEvent } from '../types';
import { getValidationStatus } from '../lib/validation';
import WizardStep3Correction from './WizardStep3Correction';
import WizardStep4Approval, { SapResult } from './WizardStep4Approval';
import WizardStep5SapResult from './WizardStep5SapResult';

type WizardStep = 'filters' | 'results' | 'correction' | 'approval' | 'sap-result';

export default function ProductionWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('filters');
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<WmsEvent[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [currentEvent, setCurrentEvent] = useState<WmsEvent | null>(null);
  const [correctedEvents, setCorrectedEvents] = useState<WmsEvent[]>([]);
  const [sapResults, setSapResults] = useState<SapResult[]>([]);

  // Step 1: Handle search
  const handleSearch = async (filters: SearchFilters) => {
    setSearchFilters(filters);
    
    try {
      const events = await fastApiService.getPendingEvents();
      
      console.log('🔍 Filters selected:', filters);
      console.log('📋 Events received from API:', events.length);
      console.log('📋 Sample event:', events[0]);
      
      // Apply filters
      let filtered = [...events];

      // Date filters
      if (filters.postingDateFrom) {
        const fromDate = new Date(filters.postingDateFrom);
        filtered = filtered.filter(e => {
          const d = parseToDate(e.received_at);
          return d ? d >= fromDate : false;
        });
      }

      if (filters.postingDateTo) {
        const toDate = new Date(filters.postingDateTo);
        filtered = filtered.filter(e => {
          const d = parseToDate(e.received_at);
          return d ? d <= toDate : false;
        });
      }

      // Real date filters
      if (filters.realDateFrom) {
        const fromDate = new Date(filters.realDateFrom);
        filtered = filtered.filter(e => {
          if (!e.sap_date) return false;
          const d = new Date(e.sap_date);
          return d >= fromDate;
        });
      }

      if (filters.realDateTo) {
        const toDate = new Date(filters.realDateTo);
        filtered = filtered.filter(e => {
          if (!e.sap_date) return false;
          const d = new Date(e.sap_date);
          return d <= toDate;
        });
      }

      // Time filters
      if (filters.realTimeFrom) {
        filtered = filtered.filter(e => {
          if (!e.sap_time) return false;
          return e.sap_time >= filters.realTimeFrom;
        });
      }

      if (filters.realTimeTo) {
        filtered = filtered.filter(e => {
          if (!e.sap_time) return false;
          return e.sap_time <= filters.realTimeTo;
        });
      }

      // Event type filter - compare with pulse field
      if (filters.eventType) {
        console.log('🔍 Filtering by event type (pulse):', filters.eventType);
        filtered = filtered.filter(e => e.pulse === filters.eventType);
        console.log('📋 Events after event type filter:', filtered.length);
      }

      // Product filter - compare with item_code field
      if (filters.product) {
        console.log('🔍 Filtering by product:', filters.product);
        filtered = filtered.filter(e =>
          e.item_code.toLowerCase().includes(filters.product.toLowerCase()) ||
          e.item_description.toLowerCase().includes(filters.product.toLowerCase())
        );
        console.log('📋 Events after product filter:', filtered.length);
      }

      // Production order filter
      if (filters.productionOrder) {
        filtered = filtered.filter(e =>
          e.production_order.toLowerCase().includes(filters.productionOrder.toLowerCase())
        );
      }

      console.log('📋 Final filtered events:', filtered.length);
      setFilteredEvents(filtered);
      setCurrentStep('results');
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const handleResetFilters = () => {
    setSearchFilters(null);
    setFilteredEvents([]);
    setSelectedEvents(new Set());
  };

  // Step 2: Handle event selection
  const handleEventSelect = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
    }
  };

  const handleEventClick = (event: WmsEvent) => {
    setCurrentEvent(event);
    setCurrentStep('correction');
  };

  const handleStep2Next = () => {
    const selected = filteredEvents.filter(e => selectedEvents.has(e.id));
    // Use frontend business validation only (do NOT use backend e.status)
    const invalidSelected = selected.filter(e => getValidationStatus(e) === 'invalid');

    if (invalidSelected.length > 0) {
      const ids = invalidSelected.map(e => e.id).join(', ');
      alert(`Cannot proceed: the following selected event(s) are INVALID: ${ids}`);
      return;
    }

    // Allow both 'valid' and 'warning' to proceed
    const proceeding = selected.filter(e => {
      const s = getValidationStatus(e);
      return s === 'valid' || s === 'warning';
    });

    setCorrectedEvents(proceeding);
    setCurrentStep('approval');
  };

  // Step 3: Handle correction
  const handleCorrectionSave = async () => {
    // Reload events to get updated status
    try {
      // Re-apply filters
      if (searchFilters) {
        handleSearch(searchFilters);
      }
    } catch (error) {
      console.error('Error reloading events:', error);
    }
  };

  const handleCorrectionNext = () => {
    setCurrentStep('results');
  };

  // Step 4: Handle approval
  const handleApprovalNext = (results: SapResult[]) => {
    setSapResults(results);
    setCurrentStep('sap-result');
  };

  // Step 5: Handle return home
  const handleReturnHome = () => {
    setCurrentStep('filters');
    setSearchFilters(null);
    setFilteredEvents([]);
    setSelectedEvents(new Set());
    setCurrentEvent(null);
    setCorrectedEvents([]);
    setSapResults([]);
  };

  // Render current step
  switch (currentStep) {
    case 'filters':
      return (
        <WizardStep1Filters
          onSearch={handleSearch}
          onReset={handleResetFilters}
        />
      );

    case 'results':
      return (
        <WizardStep2Results
          events={filteredEvents}
          selectedEvents={selectedEvents}
          onEventSelect={handleEventSelect}
          onSelectAll={handleSelectAll}
          onNext={handleStep2Next}
          onBack={() => setCurrentStep('filters')}
          onEventClick={handleEventClick}
        />
      );

    case 'correction':
      return currentEvent ? (
        <WizardStep3Correction
          event={currentEvent}
          onSave={handleCorrectionSave}
          onBack={() => setCurrentStep('results')}
          onNext={handleCorrectionNext}
        />
      ) : null;

    case 'approval':
      return (
        <WizardStep4Approval
          events={correctedEvents}
          onBack={() => setCurrentStep('results')}
          onNext={handleApprovalNext}
        />
      );

    case 'sap-result':
      return (
        <WizardStep5SapResult
          sapResults={sapResults}
          onReturnHome={handleReturnHome}
        />
      );

    default:
      return null;
  }
}
