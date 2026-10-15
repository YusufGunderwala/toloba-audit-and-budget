import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Receipt, Users, TrendingDown, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardOverview from './tabs/DashboardOverview';
import ReceiptsManager from './tabs/ReceiptsManager';
import MembersManager from './tabs/MembersManager';
import ExpensesManager from './tabs/ExpensesManager';
import EventBudgetManager from './tabs/EventBudgetManager';
import InvoicesManager from './tabs/InvoicesManager';
import AuditLogManager from './tabs/AuditLogManager';
import UserManagementTab from './tabs/UserManagementTab';
import ChangePasswordModal from './ChangePasswordModal';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: TrendingDown },
  { id: 'more', label: 'More', icon: Menu, isMore: true },
];

export default function Dashboard({ user, userRole, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(['dashboard']));

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const isMoreActive = ['events', 'invoices', 'audit', 'users'].includes(activeTab);
  const activeNavId = isMoreActive ? 'more' : activeTab;

  const handleNavClick = (item) => {
    if (item.isMore) {
      setIsMobileSidebarOpen(true);
    } else {
      setActiveTab(item.id);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // --- Database State ---
  const [members, setMembers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [events, setEvents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Role checks
  const isAdmin = userRole?.role === 'super_admin';
  const isTreasurer = userRole?.role === 'treasurer';
  const canWrite = isAdmin || isTreasurer;

  // --- Data Fetching (Parallel for Performance) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queries = [
        supabase.from('members').select('*').order('name').limit(2000),
        supabase.from('receipts').select('*, members(name, its_number, phone)').order('created_at', { ascending: false }).limit(2000),
        supabase.from('expenses').select('*, events(event_name)').order('created_at', { ascending: false }).limit(2000),
        supabase.from('events').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(1000)
      ];

      const results = await Promise.allSettled(queries);

      if (results[0].status === 'fulfilled' && results[0].value.data) setMembers(results[0].value.data);
      if (results[1].status === 'fulfilled' && results[1].value.data) setReceipts(results[1].value.data);
      if (results[2].status === 'fulfilled' && results[2].value.data) setExpenses(results[2].value.data);
      if (results[3].status === 'fulfilled' && results[3].value.data) setEvents(results[3].value.data);
      if (results[4].status === 'fulfilled' && results[4].value.data) setInvoices(results[4].value.data);
      if (results[5].status === 'fulfilled' && results[5].value.data) setAuditLogs(results[5].value.data);

    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <div className="h-screen w-full flex bg-slate-50 font-sans text-slate-900 relative overflow-hidden">
      
      {/* Sidebar Overlay for Mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out flex-shrink-0`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsMobileSidebarOpen(false); // Close sidebar on mobile when tab changes
          }} 
          user={user} 
          userRole={userRole} 
          receipts={receipts}
          expenses={expenses}
          members={members}
          onLogout={handleLogout} 
          onChangePassword={() => setShowPasswordModal(true)}
          onCloseSidebar={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative min-w-0">
        
        {/* Fatemi Dawat Pattern Watermark */}
        <div className="absolute inset-0 bg-fatemi-pattern bg-repeat opacity-[0.025] mix-blend-multiply pointer-events-none z-0"></div>
        
        {/* Header */}
        <Header 
          activeTab={activeTab} 
          onRefresh={fetchData} 
          loading={loading} 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
        />

        {/* Tab Views Container */}
        <div className="flex-1 overflow-auto p-3 sm:p-5 md:p-8 pb-28 md:pb-8 relative z-10 w-full">
          
          {/* Decorative ambient color blobs */}
          <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-toloba/5 rounded-full blur-3xl -z-10 no-print pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-emerald-300/10 rounded-full blur-3xl -z-10 no-print pointer-events-none"></div>

          {visitedTabs.has('dashboard') && (
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
              <DashboardOverview 
                receipts={receipts} 
                expenses={expenses} 
                members={members} 
                events={events}
                invoices={invoices}
                setActiveTab={setActiveTab}
                canWrite={canWrite}
              />
            </div>
          )}

          {visitedTabs.has('receipts') && (
            <div className={activeTab === 'receipts' ? 'block' : 'hidden'}>
              <ReceiptsManager 
                receipts={receipts} 
                members={members} 
                user={user}
                canWrite={canWrite}
                onRefresh={fetchData}
                searchTerm={searchTerm}
              />
            </div>
          )}

          {visitedTabs.has('members') && (
            <div className={activeTab === 'members' ? 'block' : 'hidden'}>
              <MembersManager 
                members={members} 
                receipts={receipts}
                invoices={invoices}
                user={user}
                canWrite={canWrite}
                onRefresh={fetchData}
                searchTerm={searchTerm}
              />
            </div>
          )}

          {visitedTabs.has('expenses') && (
            <div className={activeTab === 'expenses' ? 'block' : 'hidden'}>
              <ExpensesManager 
                expenses={expenses} 
                events={events}
                user={user}
                canWrite={canWrite}
                onRefresh={fetchData}
                searchTerm={searchTerm}
              />
            </div>
          )}

          {visitedTabs.has('events') && (
            <div className={activeTab === 'events' ? 'block' : 'hidden'}>
              <EventBudgetManager 
                events={events} 
                expenses={expenses}
                receipts={receipts}
                user={user}
                canWrite={canWrite}
                onRefresh={fetchData}
              />
            </div>
          )}

          {visitedTabs.has('invoices') && (
            <div className={activeTab === 'invoices' ? 'block' : 'hidden'}>
              <InvoicesManager 
                invoices={invoices} 
                user={user}
                canWrite={canWrite}
                onRefresh={fetchData}
                searchTerm={searchTerm}
              />
            </div>
          )}

          {visitedTabs.has('audit') && (
            <div className={activeTab === 'audit' ? 'block' : 'hidden'}>
              <AuditLogManager 
                auditLogs={auditLogs}
                searchTerm={searchTerm}
              />
            </div>
          )}

          {visitedTabs.has('users') && (
            <div className={activeTab === 'users' ? 'block' : 'hidden'}>
              <UserManagementTab 
                user={user}
                userRole={userRole}
                onRefresh={fetchData}
              />
            </div>
          )}

        </div>

        {/* Floating Mobile Bottom Navigation Dock */}
        <nav 
          className="fixed left-1/2 -translate-x-1/2 w-[92vw] max-w-[420px] z-40 md:hidden bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-full p-1.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08),0_2px_6px_-1px_rgba(0,0,0,0.04)] no-print select-none"
          style={{
            bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))'
          }}
          aria-label="Bottom Navigation"
        >
          <div className="grid grid-cols-5 gap-1 items-center w-full">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNavId === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`flex flex-col items-center justify-center h-12 w-full rounded-full transition-all duration-200 ease-out focus:outline-none ${
                    isActive
                      ? 'bg-toloba text-white shadow-sm shadow-emerald-950/20'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon 
                    size={18} 
                    strokeWidth={isActive ? 2.2 : 1.9}
                    className={`transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-500'}`} 
                  />
                  <span 
                    className={`text-[10px] tracking-tight mt-0.5 leading-none transition-colors duration-200 ${
                      isActive ? 'font-bold text-white' : 'font-medium text-slate-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal 
          user={user} 
          onClose={() => setShowPasswordModal(false)} 
        />
      )}
    </div>
  );
}
