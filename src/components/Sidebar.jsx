import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Users, 
  Receipt, 
  TrendingDown, 
  CalendarDays, 
  FileText, 
  ShieldCheck, 
  LogOut,
  IndianRupee,
  Eye,
  Activity,
  KeyRound,
  X
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  userRole, 
  receipts = [],
  expenses = [],
  members = [],
  onLogout, 
  onChangePassword, 
  onCloseSidebar 
}) {
  const isAdmin = userRole?.role === 'super_admin';
  const isTreasurer = userRole?.role === 'treasurer';
  const isViewer = userRole?.role === 'viewer';
  const canWrite = isAdmin || isTreasurer;

  const getRoleBadge = () => {
    if (isAdmin) return { label: 'Super Admin', color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: <ShieldCheck size={12} /> };
    if (isTreasurer) return { label: 'Treasurer', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: <IndianRupee size={12} /> };
    return { label: 'Auditor', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: <Eye size={12} /> };
  };

  const roleBadge = getRoleBadge();

  // Navigation badge counts
  const totalReceiptsCount = (receipts || []).filter(r => r.status !== 'void').length;
  const totalMembersCount = (members || []).length;

  const sections = [
    {
      title: 'FINANCIAL LEDGER',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} />, show: true },
        { id: 'receipts', label: 'Receipts & Income', icon: <Receipt size={17} />, show: true, badge: totalReceiptsCount > 0 ? totalReceiptsCount : null },
        { id: 'expenses', label: 'Expenses Outflow', icon: <TrendingDown size={17} />, show: true },
        { id: 'invoices', label: 'Invoices & Bills', icon: <FileText size={17} />, show: true },
      ]
    },
    {
      title: 'COMMUNITY & EVENTS',
      items: [
        { id: 'members', label: 'Member Directory', icon: <Users size={17} />, show: true, badge: totalMembersCount > 0 ? totalMembersCount : null },
        { id: 'events', label: 'Event Budgeting', icon: <CalendarDays size={17} />, show: true },
      ]
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { id: 'audit', label: 'Audit Trail', icon: <Activity size={17} />, show: canWrite },
        { id: 'users', label: 'User & Passwords', icon: <ShieldCheck size={17} />, show: isAdmin },
      ]
    }
  ];

  return (
    <aside className="w-[84vw] max-w-[310px] lg:w-68 h-full bg-gradient-to-b from-[#062c19] via-[#093a22] to-[#041a0f] text-white flex flex-col no-print z-50 shadow-2xl border-r border-emerald-500/20 flex-shrink-0 rounded-r-3xl lg:rounded-r-none overflow-hidden relative">
      
      {/* Subtle Dawat Motif Ambient Background */}
      <div className="absolute inset-0 bg-fatemi-pattern bg-repeat opacity-[0.04] pointer-events-none"></div>

      {/* Brand Header */}
      <div className="p-4 md:p-5 flex flex-col items-center border-b border-white/10 bg-black/20 relative z-10">
        <button 
          onClick={onCloseSidebar}
          className="absolute top-3.5 right-3.5 p-2 lg:hidden text-white/60 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 rounded-xl transition-all"
          aria-label="Close Navigation"
        >
          <X size={18} />
        </button>

        {/* Crest Frame with Royal Gold Ring */}
        <div className="w-16 h-16 rounded-2xl overflow-hidden mb-2.5 shadow-xl ring-2 ring-amber-400/50 bg-white flex items-center justify-center p-1.5 transform hover:scale-105 transition-transform">
          <img src="/TolobaLogoAnand.png" alt="Toloba Logo" className="w-full h-full object-contain" />
        </div>

        <h2 className="font-extrabold text-xs md:text-sm text-center tracking-wide leading-tight text-white px-2 mt-1">
          TOLOBA UL KULLIYAAT IL MUMINOON
        </h2>
        <p className="text-[11px] font-semibold text-emerald-300/80 mt-1 uppercase tracking-wider">
          Anand
        </p>
      </div>
      
      {/* Scrollable Navigation Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        
        {/* Navigation Sections */}
        {sections.map((sec, idx) => {
          const visibleItems = sec.items.filter(item => item.show);
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              <div className="text-[10px] font-extrabold text-emerald-400/70 uppercase tracking-widest px-3 mb-1.5 flex items-center justify-between">
                <span>{sec.title}</span>
              </div>

              {visibleItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id)} 
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                      isActive 
                        ? 'bg-gradient-to-r from-emerald-600 to-toloba text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/30 font-bold' 
                        : 'hover:bg-white/10 text-white/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? 'text-amber-300' : 'text-emerald-400/80'}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                        isActive 
                          ? 'bg-white/20 text-white border-white/30' 
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

      </div>
      
      {/* User Profile & Footer Controls */}
      <div className="p-3.5 border-t border-white/10 bg-black/30 relative z-10">
        <div className="flex items-center space-x-2.5 px-1 py-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-toloba flex items-center justify-center text-white font-bold border border-emerald-400/30 shadow-md flex-shrink-0">
            {(userRole?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="text-xs flex-1 min-w-0">
            <p className="font-bold text-white truncate">{userRole?.display_name || user?.email}</p>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold mt-0.5 ${roleBadge.color}`}>
              {roleBadge.icon} {roleBadge.label}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-2.5">
          <button 
            onClick={onChangePassword} 
            className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 border border-white/10 transition-all text-xs font-medium active:scale-95"
            title="Change Password"
          >
            <KeyRound size={12} />
            <span>Password</span>
          </button>
          <button 
            onClick={onLogout} 
            className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-rose-300 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-all text-xs font-medium border border-transparent active:scale-95"
          >
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
