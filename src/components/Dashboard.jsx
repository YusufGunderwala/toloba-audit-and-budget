import React, { useState, useEffect, useCallback } from 'react';
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

export default function Dashboard({ user, userRole, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
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
          onLogout={handleLogout} 
          onChangePassword={() => setShowPasswordModal(true)}
          onCloseSidebar={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative min-w-0">
        
        {/* Fatemi Dawat Pattern Watermark */}
        <div className="absolute inset-0 bg-fatemi-pattern bg-repeat opacity-[0.03] mix-blend-multiply pointer-events-none z-0"></div>
        
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
        <div className="flex-1 overflow-auto p-4 md:p-8 relative z-10 w-full">
          
          {/* Decorative ambient color blobs */}
          <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-toloba/10 rounded-full blur-3xl -z-10 no-print pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-emerald-300/20 rounded-full blur-3xl -z-10 no-print pointer-events-none"></div>

          {activeTab === 'dashboard' && (
            <DashboardOverview 
              receipts={receipts} 
              expenses={expenses} 
              members={members} 
              events={events}
              invoices={invoices}
              setActiveTab={setActiveTab}
              canWrite={canWrite}
            />
          )}

          {activeTab === 'receipts' && (
            <ReceiptsManager 
              receipts={receipts} 
              members={members} 
              user={user}
              canWrite={canWrite}
              onRefresh={fetchData}
              searchTerm={searchTerm}
            />
          )}

          {activeTab === 'members' && (
            <MembersManager 
              members={members} 
              receipts={receipts}
              user={user}
              canWrite={canWrite}
              onRefresh={fetchData}
              searchTerm={searchTerm}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesManager 
              expenses={expenses} 
              events={events}
              user={user}
              canWrite={canWrite}
              onRefresh={fetchData}
              searchTerm={searchTerm}
            />
          )}

          {activeTab === 'events' && (
            <EventBudgetManager 
              events={events} 
              expenses={expenses}
              receipts={receipts}
              user={user}
              canWrite={canWrite}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesManager 
              invoices={invoices} 
              user={user}
              canWrite={canWrite}
              onRefresh={fetchData}
              searchTerm={searchTerm}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogManager 
              auditLogs={auditLogs}
              searchTerm={searchTerm}
            />
          )}

          {activeTab === 'users' && (
            <UserManagementTab 
              user={user}
              userRole={userRole}
              onRefresh={fetchData}
            />
          )}

        </div>

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
