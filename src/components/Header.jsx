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
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 no-print relative z-10 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-2 md:gap-3">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:block w-2.5 h-7 bg-toloba rounded-full"></div>
        <div>
          <h1 className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate max-w-[200px] md:max-w-none">{getTitle()}</h1>
          <p className="hidden md:block text-xs text-slate-400 font-medium">Treasury Portal</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Search Input */}
        {['members', 'receipts', 'expenses', 'invoices'].includes(activeTab) && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search record or ITS..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-100/80 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-toloba/20 focus:border-toloba focus:bg-white transition-all w-32 sm:w-48 md:w-60 outline-none"
            />
          </div>
        )}

        <button 
          onClick={onRefresh} 
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all border border-slate-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-toloba' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
}
