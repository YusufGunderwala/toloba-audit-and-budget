import toast from 'react-hot-toast';
import React, { useState, useMemo } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Edit3, 
  MessageCircle, 
  FileSpreadsheet, 
  History, 
  X, 
  Check, 
  UserCheck 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToExcel } from '../../lib/exportUtils';
import { logAuditEvent } from '../../lib/auditLogger';

export default function MembersManager({ members, receipts, invoices, user, canWrite, onRefresh, searchTerm }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedLedgerMember, setSelectedLedgerMember] = useState(null);

  const [formData, setFormData] = useState({ name: '', its_number: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState({ show: false, member: null });

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        m.name?.toLowerCase().includes(term) ||
        m.its_number?.includes(term) ||
        m.phone?.includes(term)
      );
    });
  }, [members, searchTerm]);

  // Handle Add / Edit Member
  const handleSubmitMember = async (e) => {
    e.preventDefault();
    if (formData.its_number.length !== 8) {
      toast.error("ITS Number must be exactly 8 digits.");
      return;
    }
    setLoading(true);

    try {
      if (editingMember) {
        // Edit existing
        const { error } = await supabase
          .from('members')
          .update({
            name: formData.name,
            its_number: formData.its_number,
            phone: formData.phone || null
          })
          .eq('id', editingMember.id);

        if (error) throw error;
        await logAuditEvent(user, 'EDIT_MEMBER', `Updated member ${formData.name} (ITS: ${formData.its_number})`);
        toast.success("Member updated successfully!");
      } else {
        // Add new
        const { error } = await supabase.from('members').insert([
          { name: formData.name, its_number: formData.its_number, phone: formData.phone || null }
        ]);

        if (error) throw error;
        await logAuditEvent(user, 'ADD_MEMBER', `Added new member ${formData.name} (ITS: ${formData.its_number})`);
        toast.success("Member added successfully!");
      }

      setFormData({ name: '', its_number: '', phone: '' });
      setEditingMember(null);
      setShowAddModal(false);
      onRefresh();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Member
  const handleDeleteMember = (member) => {
    setDeletePrompt({ show: true, member });
  };

  const confirmDeleteMember = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.from('members').delete().eq('id', deletePrompt.member.id);
      if (error) throw error;

      await logAuditEvent(user, 'DELETE_MEMBER', `Deleted member ${deletePrompt.member.name} (${deletePrompt.member.its_number})`);
      toast.success("Member deleted.");
      setDeletePrompt({ show: false, member: null });
      onRefresh();
    } catch (err) {
      toast.error("Error deleting member: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportMembers = () => {
    const data = filteredMembers.map(m => {
      const memberReceipts = receipts.filter(r => r.member_id === m.id && r.status !== 'void');
      const totalContributed = memberReceipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      return {
        'Full Name': m.name,
        'ITS Number': m.its_number,
        'WhatsApp Phone': m.phone || 'N/A',
        'Total Receipts Paid': memberReceipts.length,
        'Total Lawazam Contributed (₹)': totalContributed,
        'Member Since': new Date(m.created_at).toLocaleDateString('en-GB')
      };
    });
    exportToExcel(data, 'Toloba_Members_Directory');
  };

  // Calculate member stats
  const memberReceipts = useMemo(() => {
    return selectedLedgerMember 
      ? receipts.filter(r => r.member_id === selectedLedgerMember.id)
      : [];
  }, [selectedLedgerMember, receipts]);

  const memberInvoices = useMemo(() => {
    // Only safely parse if invoices exists
    return selectedLedgerMember && invoices
      ? invoices.filter(inv => inv.client_its === selectedLedgerMember.its_number)
      : [];
  }, [selectedLedgerMember, invoices]);
  
  const memberTotalPaid = useMemo(() => {
    return memberReceipts
      .filter(r => r.status !== 'void')
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  }, [memberReceipts]);

  const memberOutstandingDues = useMemo(() => {
    return memberInvoices
      .filter(inv => inv.status === 'unpaid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  }, [memberInvoices]);

  const passbookTimeline = useMemo(() => {
    // Map receipts to a standard timeline format
    const mappedReceipts = memberReceipts.map(r => ({
      ...r,
      type: 'receipt',
      date: new Date(r.created_at),
      title_display: r.receipt_no,
      subtitle_display: `${r.period_month} ${r.period_year} • Mode: ${r.payment_mode}`,
      amount_display: parseFloat(r.amount),
      status_display: r.status?.toUpperCase() || 'VALID',
      isCredit: true
    }));

    // Map invoices to a standard timeline format
    const mappedInvoices = memberInvoices.map(inv => ({
      ...inv,
      type: 'invoice',
      date: new Date(inv.created_at),
      title_display: inv.invoice_no,
      subtitle_display: inv.title,
      amount_display: parseFloat(inv.amount),
      status_display: inv.status?.toUpperCase() || 'UNPAID',
      isCredit: false
    }));

    // Combine and sort descending by date
    return [...mappedReceipts, ...mappedInvoices].sort((a, b) => b.date - a.date);
  }, [memberReceipts, memberInvoices]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-col md:flex-row gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-base font-bold text-slate-800">Member Directory ({filteredMembers.length})</h2>
          <p className="text-xs text-slate-400">Manage committee members, contact info, and individual payment history</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {canWrite && (
            <button 
              onClick={() => {
                setEditingMember(null);
                setFormData({ name: '', its_number: '', phone: '' });
                setShowAddModal(true);
              }}
              className="btn-primary text-xs py-2 px-3.5 flex items-center justify-center gap-1.5 shadow w-full md:w-auto whitespace-nowrap"
            >
              <UserPlus size={16} /> Add Member
            </button>
          )}
          <button 
            onClick={handleExportMembers}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow w-full md:w-auto whitespace-nowrap"
          >
            <FileSpreadsheet size={16} /> Export
          </button>
        </div>
      </div>

      {/* ===== MEMBERS TABLE ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Mobile View: Modern Member Directory Cards (No Horizontal Scroll) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No members found.</div>
          ) : (
            filteredMembers.map(m => {
              const mReceipts = receipts.filter(r => r.member_id === m.id && r.status !== 'void');
              const mTotal = mReceipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

              return (
                <div key={m.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-sm truncate">{m.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                      <span className="font-mono text-slate-600 font-semibold">ITS: {m.its_number}</span>
                      {m.phone && (
                        <>
                          <span>•</span>
                          <a href={`https://wa.me/${m.phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-600 font-semibold">
                            <MessageCircle size={12} /> WhatsApp
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Paid</span>
                      <span className="text-sm font-extrabold text-toloba-dark">
                        ₹{mTotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setSelectedLedgerMember(m)}
                        className="px-2 py-1 bg-toloba/10 hover:bg-toloba/20 text-toloba-dark rounded-lg text-xs font-bold inline-flex items-center gap-1"
                        title="View Payment Ledger"
                      >
                        <History size={13} /> <span>Ledger</span>
                      </button>

                      {canWrite && (
                        <button 
                          onClick={() => {
                            setEditingMember(m);
                            setFormData({ name: m.name, its_number: m.its_number, phone: m.phone || '' });
                            setShowAddModal(true);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center"
                          title="Edit Member"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}

                      {canWrite && (
                        <button 
                          onClick={() => handleDeleteMember(m)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center"
                          title="Delete Member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Full Spreadsheet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">#</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Member Name</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">ITS Number</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">WhatsApp</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Total Paid</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">Added Date</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-slate-400">No members found.</td></tr>
              ) : (
                filteredMembers.map((m, idx) => {
                  const mReceipts = receipts.filter(r => r.member_id === m.id && r.status !== 'void');
                  const mTotal = mReceipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
                  
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 px-4 md:px-6 text-slate-400 text-xs hidden md:table-cell">{idx + 1}</td>
                      <td className="py-4 px-4 md:px-6 font-semibold text-slate-900">{m.name}</td>
                      <td className="py-4 px-4 md:px-6 font-mono text-slate-600 tracking-wider font-semibold">{m.its_number}</td>
                      <td className="py-4 px-4 md:px-6 hidden md:table-cell">
                        {m.phone ? (
                          <a href={`https://wa.me/${m.phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-800 font-semibold text-xs bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
                            <MessageCircle size={14} /> {m.phone}
                          </a>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 md:px-6 font-extrabold text-toloba-dark">₹{mTotal.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4 md:px-6 text-slate-400 text-xs hidden md:table-cell">{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="py-4 px-4 md:px-6 text-right space-x-2">
                        {/* Member Ledger Drawer Button */}
                        <button 
                          onClick={() => setSelectedLedgerMember(m)}
                          className="p-1.5 bg-toloba/10 hover:bg-toloba/20 text-toloba-dark rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          title="View Payment Ledger"
                        >
                          <History size={14} /> <span className="hidden md:inline">Ledger</span>
                        </button>

                        {canWrite && (
                          <button 
                            onClick={() => {
                              setEditingMember(m);
                              setFormData({ name: m.name, its_number: m.its_number, phone: m.phone || '' });
                              setShowAddModal(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center"
                            title="Edit Member"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}

                        {canWrite && (
                          <button 
                            onClick={() => handleDeleteMember(m)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            title="Delete Member"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ADD / EDIT MEMBER MODAL ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                {editingMember ? 'Edit Member Details' : 'Add New Member'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="Enter full name" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">ITS Number (8 Digits)</label>
                <input 
                  type="text" 
                  required 
                  maxLength={8} 
                  minLength={8} 
                  className="input-field font-mono" 
                  placeholder="e.g. 12345678" 
                  value={formData.its_number} 
                  onChange={e => setFormData({...formData, its_number: e.target.value.replace(/\D/g, '')})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">WhatsApp Phone Number</label>
                <input 
                  type="tel" 
                  className="input-field" 
                  placeholder="e.g. 919876543210" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} 
                />
                <p className="text-[11px] text-slate-400 mt-1">Country code + 10-digit number without + or spaces.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="w-1/2 btn-primary py-2.5 text-xs font-bold">
                  {loading ? 'Saving...' : editingMember ? 'Update Member' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MEMBER LEDGER DRAWER ===== */}
      {selectedLedgerMember && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 bg-toloba text-white flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">{selectedLedgerMember.name}</h3>
                <p className="text-xs text-white/70 mt-1">ITS: <span className="font-mono font-bold text-white">{selectedLedgerMember.its_number}</span></p>
                {selectedLedgerMember.phone && <p className="text-xs text-white/70">Phone: {selectedLedgerMember.phone}</p>}
              </div>
              <button onClick={() => setSelectedLedgerMember(null)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Ledger Stats */}
            <div className="p-3.5 sm:p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 text-center">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Total Paid</p>
                <p className="text-sm sm:text-lg font-extrabold text-toloba-dark mt-0.5 sm:mt-1 truncate">₹{memberTotalPaid.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 text-center">
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Receipts</p>
                <p className="text-sm sm:text-lg font-extrabold text-slate-800 mt-0.5 sm:mt-1 truncate">{memberReceipts.filter(r => r.status !== 'void').length}</p>
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-amber-200 text-center shadow-2xs">
                <p className="text-[9px] sm:text-[10px] text-amber-600 font-bold uppercase tracking-wider truncate">Dues Pending</p>
                <p className="text-sm sm:text-lg font-extrabold text-amber-700 mt-0.5 sm:mt-1 truncate">₹{memberOutstandingDues.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Passbook History Timeline */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2">
                <History size={15} className="text-toloba" /> Financial Timeline
              </h4>
              
              {passbookTimeline.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-xs sm:text-sm font-medium">No financial records found.</p>
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {passbookTimeline.map(item => (
                    <div key={item.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}>
                      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-2xs w-full relative z-10 hover:shadow-xs transition-shadow">
                        <div className="flex gap-2.5 sm:gap-3 items-center min-w-0">
                          <div className={`w-1.5 sm:w-2 h-9 sm:h-10 rounded-full flex-shrink-0 ${item.isCredit ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5 truncate">
                              <span className="truncate">{item.title_display}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold tracking-wider flex-shrink-0 ${item.isCredit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {item.type.toUpperCase()}
                              </span>
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate" title={item.subtitle_display}>{item.subtitle_display}</p>
                            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium">{item.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="text-right pl-2 sm:pl-4 border-l border-slate-100 flex-shrink-0">
                          <p className={`font-extrabold text-sm sm:text-base ${item.isCredit ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {item.isCredit ? '+' : '-'} ₹{item.amount_display.toLocaleString('en-IN')}
                          </p>
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold mt-0.5 inline-block ${item.status_display === 'VOID' ? 'bg-slate-100 text-slate-500' : item.isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {item.status_display}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ===== DELETE PROMPT MODAL ===== */}
      {deletePrompt.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Member?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{deletePrompt.member?.name}</span> (ITS: {deletePrompt.member?.its_number})?
              <br/><br/>
              <span className="text-red-500 font-medium">Warning: This will also delete all of their receipt records! This action cannot be undone.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeletePrompt({ show: false, member: null })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteMember}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-lg shadow-red-500/30 transition-all flex items-center gap-2"
              >
                {loading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
