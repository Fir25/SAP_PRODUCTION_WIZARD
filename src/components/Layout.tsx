import { ReactNode, useState } from 'react';
import {
  LayoutDashboard, ClipboardList, FileText, LogOut, Menu, X,
  Factory, Bell, ChevronRight, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem { label: string; icon: React.ElementType; page: string }

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { label: 'Events',    icon: ClipboardList,   page: 'events'    },
  { label: 'Audit Log', icon: FileText,         page: 'audit'     },
];

interface Props {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  pendingCount?: number;
}

export default function Layout({ children, currentPage, onNavigate, pendingCount = 0 }: Props) {
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
            <Factory size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">WMS Validator</p>
            <p className="text-slate-400 text-xs">SAP Integration Layer</p>
          </div>
          <button className="ml-auto text-slate-400 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ label, icon: Icon, page }) => {
            const active = currentPage === page;
            return (
              <button
                key={page}
                onClick={() => { onNavigate(page); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                <Icon size={17} />
                <span className="flex-1 text-left">{label}</span>
                {label === 'Events' && pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {pendingCount}
                  </span>
                )}
                {active && <ChevronRight size={14} />}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{profile?.full_name || user?.email}</p>
              <p className="text-slate-400 text-xs capitalize">{profile?.role || 'operator'}</p>
            </div>
            <button onClick={signOut} title="Sign out" className="text-slate-400 hover:text-red-400 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
          <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-slate-800">
              {navItems.find(n => n.page === currentPage)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <button onClick={() => onNavigate('events')} className="relative p-2 text-slate-500 hover:text-amber-600 transition-colors">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </button>
            )}
            <div className="text-xs text-slate-400 hidden sm:block">
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
