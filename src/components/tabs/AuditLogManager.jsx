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
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-toloba" /> Immutable Security Audit Trail ({filteredLogs.length})
          </h2>
          <p className="text-xs text-slate-400">Complete, tamper-evident log of all financial actions, receipt generations, and member modifications</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
          >
            <FileSpreadsheet size={16} /> Excel (.xlsx)
          </button>
          <button 
            onClick={handleExportPDF}
            className="btn-primary text-xs font-bold py-2 px-3.5 flex items-center gap-2 shadow"
          >
            <Activity size={16} /> PDF Audit Report
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
