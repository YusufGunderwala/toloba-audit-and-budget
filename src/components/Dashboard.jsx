import React, { useState, useEffect, useCallback, lazy, Suspense, useRef, useDeferredValue } from 'react';
import toast from 'react-hot-toast';
import { LayoutDashboard, Receipt, Users, TrendingDown, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchAllRows } from '../lib/fetchAllRows';
import Sidebar from './Sidebar';
import Header from './Header';
import ChangePasswordModal from './ChangePasswordModal';
import TreasuryLoader from './ui/TreasuryLoader';

// Allow two complete 2.4-second coin animations on dashboard entry.
const MINIMUM_LOADER_MS = 4800;

const DashboardOverview = lazy(() => import('./tabs/DashboardOverview'));
const ReceiptsManager = lazy(() => import('./tabs/ReceiptsManager'));
const MembersManager = lazy(() => import('./tabs/MembersManager'));
const ExpensesManager = lazy(() => import('./tabs/ExpensesManager'));
const EventBudgetManager = lazy(() => import('./tabs/EventBudgetManager'));
const IncomeManager = lazy(() => import('./tabs/IncomeManager'));
const AuditLogManager = lazy(() => import('./tabs/AuditLogManager'));
const UserManagementTab = lazy(() => import('./tabs/UserManagementTab'));

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'receipts', label: 'Lawzam', icon: Receipt },
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

  const isMoreActive = ['events', 'income', 'audit', 'users'].includes(activeTab);
  const activeNavId = isMoreActive ? 'more' : activeTab;

  const handleNavClick = (item) => {
    if (item.isMore) {
      setIsMobileSidebarOpen(true);
    } else {
      setActiveTab(item.id);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const tabSearch = tab => activeTab === tab ? deferredSearch : '';
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // --- Database State ---
  const [members, setMembers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [events, setEvents] = useState([]);
  const [income, setIncome] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loaderTimeElapsed, setLoaderTimeElapsed] = useState(false);
  const requestVersion = useRef(0);
  const pending = useRef(false);
  const [invoices, setInvoices] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditError, setAuditError] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // Role checks
  const isAdmin = userRole?.role === 'super_admin';
  const isTreasurer = userRole?.role === 'treasurer';
  const canWrite = isAdmin || isTreasurer;

  // --- Data Fetching (Parallel for Performance) ---
  const fetchData = useCallback(async (changedTables) => {
    const requestedTables = pending.current || !Array.isArray(changedTables) ? null : changedTables;
    pending.current = true;
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError('');
    try {
      const datasets = [
        [setMembers, 'members', '*', 'name', true],
        [setReceipts, 'receipts', '*, members(name, its_number, phone)', 'receipt_date', false],
        [setExpenses, 'expenses', '*, events(event_name)', 'created_at', false],
        [setEvents, 'events', '*', 'created_at', false],
        [setInvoices, 'invoices', '*', 'created_at', false],
        [setIncome, 'income', '*', 'received_on', false]
      ];
      const requested = requestedTables ? datasets.filter(([, table]) => requestedTables.includes(table)) : datasets;
      const results = await Promise.all(requested.map(async ([setRows, ...query]) => [setRows, await fetchAllRows(...query)]));
      if (version !== requestVersion.current) return;
      results.forEach(([setRows, rows]) => setRows(rows));
      setHasLoaded(true);
    } catch (error) {
      if (version === requestVersion.current) setLoadError(error.message);
    } finally {
      if (version === requestVersion.current) {
        pending.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      requestVersion.current += 1;
      pending.current = false;
    };
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => setLoaderTimeElapsed(true), MINIMUM_LOADER_MS);
    return () => clearTimeout(timer);
  }, []);

  const refreshReceipts = useCallback(() => fetchData(['receipts']), [fetchData]);
  const refreshMembers = useCallback(() => fetchData(['members', 'receipts']), [fetchData]);
  const refreshExpenses = useCallback(() => fetchData(['expenses']), [fetchData]);
  const refreshEvents = useCallback(() => fetchData(['events', 'expenses']), [fetchData]);
  const refreshIncome = useCallback(() => fetchData(['income']), [fetchData]);

  useEffect(() => {
    if (activeTab !== 'audit' || !canWrite || loading) return;
    let active = true;
    setAuditLoading(true);
    setAuditError('');
    fetchAllRows('audit_logs', '*', 'created_at', false)
      .then(rows => { if (active) setAuditLogs(rows); })
      .catch(error => { if (active) setAuditError(error.message); })
      .finally(() => { if (active) setAuditLoading(false); });
    return () => { active = false; };
  }, [activeTab, canWrite, loading]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      toast.error('Could not sign out. Try again.');
      return;
    }
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

          {loadError && (
            <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {hasLoaded ? 'Showing the last successful refresh. ' : ''}Could not load treasury data. {loadError}
            </p>
          )}
          {!loadError && (!hasLoaded || !loaderTimeElapsed) && <TreasuryLoader />}
          {hasLoaded && loaderTimeElapsed && <Suspense fallback={<TreasuryLoader label="Opening view…" />}>
            {visitedTabs.has('dashboard') && (
              <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                <DashboardOverview
                  receipts={receipts}
                  expenses={expenses}
                  income={income}
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
                  canWrite={canWrite}
                  onRefresh={refreshReceipts}
                  searchTerm={tabSearch('receipts')}
                />
              </div>
            )}

            {visitedTabs.has('members') && (
              <div className={activeTab === 'members' ? 'block' : 'hidden'}>
                <MembersManager
                  members={members}
                  receipts={receipts}
                  invoices={invoices}
                  canWrite={canWrite}
                  onRefresh={refreshMembers}
                  searchTerm={tabSearch('members')}
                />
              </div>
            )}

            {visitedTabs.has('expenses') && (
              <div className={activeTab === 'expenses' ? 'block' : 'hidden'}>
                <ExpensesManager
                  expenses={expenses}
                  events={events}
                  canWrite={canWrite}
                  onRefresh={refreshExpenses}
                  searchTerm={tabSearch('expenses')}
                />
              </div>
            )}

            {visitedTabs.has('events') && (
              <div className={activeTab === 'events' ? 'block' : 'hidden'}>
                <EventBudgetManager
                  expenses={expenses}
                  events={events}
                  canWrite={canWrite}
                  onRefresh={refreshEvents}
                />
              </div>
            )}

            {visitedTabs.has('income') && (
              <div className={activeTab === 'income' ? 'block' : 'hidden'}>
                <IncomeManager
                  income={income}
                  canWrite={canWrite}
                  onRefresh={refreshIncome}
                  searchTerm={tabSearch('income')}
                />
              </div>
            )}

            {canWrite && activeTab === 'audit' && (
              <div className={activeTab === 'audit' ? 'block' : 'hidden'}>
                {auditLoading && <p role="status" className="p-3 text-sm text-slate-600">Loading audit trail…</p>}
                {auditError && <p role="alert" className="p-3 text-sm text-red-800">{auditError}</p>}
                <AuditLogManager
                  auditLogs={auditLogs}
                  searchTerm={tabSearch('audit')}
                />
              </div>
            )}

            {isAdmin && visitedTabs.has('users') && (
              <div className={activeTab === 'users' ? 'block' : 'hidden'}>
                <UserManagementTab
                  user={user}
                  userRole={userRole}
                  members={members}
                />
              </div>
            )}

          </Suspense>}
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
          onClose={() => setShowPasswordModal(false)} 
        />
      )}
    </div>
  );
}
