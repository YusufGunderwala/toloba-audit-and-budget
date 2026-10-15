import React from 'react';
import { ShieldCheck, FileSpreadsheet, Activity, Clock, User } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';

export default function AuditLogManager({ auditLogs, searchTerm }) {
  const filteredLogs = auditLogs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.details?.toLowerCase().includes(term) ||
      log.user_email?.toLowerCase().includes(term)
    );
  });

  const handleExportExcel = () => {
    const data = filteredLogs.map(l => ({
      'Timestamp': new Date(l.created_at).toLocaleString('en-GB'),
      'User Email': l.user_email || 'System',
      'Action Performed': l.action,
      'Details': l.details
    }));
    exportToExcel(data, 'Toloba_Security_Audit_Logs');
  };

  const handleExportPDF = () => {
    const cols = ['Timestamp', 'User', 'Action', 'Details'];
    const rows = filteredLogs.map(l => [
      new Date(l.created_at).toLocaleString('en-GB'),
      l.user_email || 'System',
      l.action,
      l.details || ''
    ]);
    exportToPDF('Security Audit Trail Report', cols, rows, 'Toloba_Audit_Log');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-toloba flex-shrink-0" /> Immutable Security Audit Trail ({filteredLogs.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Complete, tamper-evident log of all financial actions, receipt generations, and member modifications</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-slate-800 hover:bg-slate-900 transition-all text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
          >
            <FileSpreadsheet size={16} /> <span>Excel (.xlsx)</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none justify-center btn-primary text-xs font-bold py-2 px-3.5 flex items-center gap-2 shadow"
          >
            <Activity size={16} /> <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Mobile View: Modern Audit Event Cards (No Horizontal Scroll) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No audit events recorded yet.</div>
          ) : (
            filteredLogs.map(l => (
              <div key={l.id} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-toloba bg-toloba/10 px-2 py-0.5 rounded border border-toloba/20">
                    {l.action}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(l.created_at).toLocaleString('en-GB')}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                  {l.details || 'No additional details'}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
                  <User size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{l.user_email || 'System'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Spreadsheet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-6 font-semibold">Timestamp</th>
                <th className="py-3.5 px-6 font-semibold">User</th>
                <th className="py-3.5 px-6 font-semibold">Action</th>
                <th className="py-3.5 px-6 font-semibold">Details & Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr><td colSpan="4" className="py-12 text-center text-slate-400">No audit events recorded yet.</td></tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 text-slate-500 text-xs font-mono whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('en-GB')}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-800 text-xs">
                      {l.user_email || 'System'}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-toloba bg-toloba/10 px-2.5 py-0.5 rounded border border-toloba/20">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-700 text-xs font-medium">{l.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
