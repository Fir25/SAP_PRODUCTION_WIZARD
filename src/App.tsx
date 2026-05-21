import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import EventsSelectionPage from './components/EventsSelectionPage';
import OFValidationWorkspace from './components/OFValidationWorkspace';
import type { WmsEvent } from './components/EventsSelectionPage';

type Page = 'selection' | 'validation';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('selection');
  const [selectedEvents, setSelectedEvents] = useState<WmsEvent[]>([]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleEventsSelected = (events: WmsEvent[]) => {
    setSelectedEvents(events);
    setCurrentPage('validation');
  };

  const handleBackToSelection = () => {
    setSelectedEvents([]);
    setCurrentPage('selection');
  };

  if (currentPage === 'selection') {
    return <EventsSelectionPage onEventsSelected={handleEventsSelected} />;
  }

  return (
    <OFValidationWorkspace 
      events={selectedEvents} 
      onBack={handleBackToSelection}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
