import React from 'react';
import { RefreshCw, Search, ShieldAlert, Sparkles, Menu } from 'lucide-react';

export default function Header({ activeTab, onRefresh, loading, searchTerm, setSearchTerm, onMenuClick }) {
  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Executive Financial Dashboard';
      case 'receipts': return 'Receipts & Income Collection';
      case 'members': return 'Member Directory & Financial History';
      case 'expenses': return 'Expense Tracker & Committee Outflow';
      case 'events': return 'Event Budgeting & Cost Control';
      case 'invoices': return 'Invoicing & Bill Management';
      case 'audit': return 'Security Audit Trail & Logs';
      case 'users': return 'User Access & Password Management';
      default: return 'Account Management';
    }
  };

  return (
    <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-3.5 sm:px-6 md:px-8 no-print relative z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex-shrink-0">
      <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 rounded-xl transition-all"
          aria-label="Open Navigation"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:block w-1.5 h-6 bg-gradient-to-b from-toloba to-emerald-600 rounded-full"></div>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 tracking-tight truncate max-w-[150px] sm:max-w-[260px] md:max-w-none">{getTitle()}</h1>
          <p className="hidden md:block text-[11px] text-slate-400 font-medium tracking-wide">Treasury Portal</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Search Input */}
        {['members', 'receipts', 'expenses', 'invoices'].includes(activeTab) && (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200/80 rounded-xl text-xs focus:ring-2 focus:ring-toloba/20 focus:border-toloba transition-all duration-200 w-32 sm:w-48 md:w-64 focus:w-40 sm:focus:w-56 md:focus:w-72 outline-none placeholder:text-slate-400"
            />
          </div>
        )}

        <button 
          onClick={onRefresh} 
          disabled={loading}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200/90 shadow-xs"
          title="Refresh Data"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-toloba' : 'text-slate-500'} />
          <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
}
