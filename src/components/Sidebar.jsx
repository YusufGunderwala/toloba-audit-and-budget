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

export default function Sidebar({ activeTab, setActiveTab, user, userRole, onLogout, onChangePassword, onCloseSidebar }) {
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, show: true },
    { id: 'receipts', label: 'Receipts & Income', icon: <PlusCircle size={18} />, show: true },
    { id: 'members', label: 'Member Directory', icon: <Users size={18} />, show: true },
    { id: 'expenses', label: 'Expenses Outflow', icon: <TrendingDown size={18} />, show: true },
    { id: 'events', label: 'Event Budgeting', icon: <CalendarDays size={18} />, show: true },
    { id: 'invoices', label: 'Invoices & Bills', icon: <FileText size={18} />, show: true },
    { id: 'audit', label: 'Audit Trail', icon: <Activity size={18} />, show: canWrite },
    { id: 'users', label: 'User & Passwords', icon: <ShieldCheck size={18} />, show: isAdmin },
  ];

  return (
    <aside className="w-64 h-full bg-toloba-dark text-white flex flex-col no-print z-50 shadow-2xl border-r border-white/10 flex-shrink-0">
      {/* Brand Header */}
      <div className="p-4 md:p-6 flex flex-col items-center border-b border-white/10 bg-black/10 relative">
        <button 
          onClick={onCloseSidebar}
          className="absolute top-4 right-4 p-1.5 lg:hidden text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden mb-3 shadow-xl ring-4 ring-white/10 bg-white flex items-center justify-center mt-2 md:mt-0 p-1.5">
          <img src="/TolobaLogoAnand.png" alt="Toloba Logo" className="w-full h-full object-contain" />
        </div>
        <h2 className="font-bold text-sm text-center tracking-wide leading-tight mt-1 text-white">TOLOBA UL KULLIYAAT IL MUMINOON (ANAND)</h2>
        <p className="text-toloba-light/70 text-[11px] font-medium mt-1 uppercase tracking-widest">Treasury Suite v2.0</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 mb-2">Main Menu</div>
        {navItems.filter(item => item.show).map(item => {
          const isActive = activeTab === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-gradient-to-r from-toloba to-emerald-600 text-white shadow-lg shadow-emerald-900/40 border border-white/20 font-semibold' 
                  : 'hover:bg-white/10 text-white/80 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-toloba-light/80'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center space-x-3 px-2 py-2">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white font-bold border border-white/20 shadow">
            {(userRole?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="text-xs flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{userRole?.display_name || user?.email}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold mt-1 ${roleBadge.color}`}>
              {roleBadge.icon} {roleBadge.label}
            </span>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button 
            onClick={onChangePassword} 
            className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all text-xs font-medium"
            title="Change Password"
          >
            <KeyRound size={14} />
            <span>Password</span>
          </button>
          <button 
            onClick={onLogout} 
            className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-white/70 hover:text-white hover:bg-red-500/20 hover:border hover:border-red-500/30 transition-all text-xs font-medium border border-transparent"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
