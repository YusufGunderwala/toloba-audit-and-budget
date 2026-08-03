import toast from 'react-hot-toast';
import React, { useState, useMemo } from 'react';
import CustomSelect from '../ui/CustomSelect';
import { 
  TrendingDown, 
  PlusCircle, 
  FileSpreadsheet, 
  Trash2, 
  IndianRupee, 
  CheckCircle2, 
  Tag, 
  Calendar 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToExcel } from '../../lib/exportUtils';
import { logAuditEvent } from '../../lib/auditLogger';

export default function ExpensesManager({ expenses, events, user, canWrite, onRefresh, searchTerm }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState({ show: false, exp: null });

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Catering',
    paymentMode: 'Cash',
    eventId: '',
    voucherNo: '',
    vendorName: '',
    notes: ''
  });

  const categories = [
    'Catering', 'Logistics', 'Venue & Rent', 
    'Printing & Stationery', 'Sound & Light', 
    'Administrative', 'Maintenance', 'Miscellaneous'
  ];

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        e.title?.toLowerCase().includes(term) ||
        e.category?.toLowerCase().includes(term) ||
        e.vendor_name?.toLowerCase().includes(term) ||
        e.voucher_no?.toLowerCase().includes(term)
      );
    });
  }, [expenses, searchTerm]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0);
  }, [filteredExpenses]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('expenses').insert([
        {
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category,
          payment_mode: formData.paymentMode,
          event_id: formData.eventId || null,
          voucher_no: formData.voucherNo || null,
          vendor_name: formData.vendorName || null,
          notes: formData.notes || null
        }
      ]);

      if (error) throw error;

      await logAuditEvent(user, 'CREATE_EXPENSE', `Recorded expense "${formData.title}" for ₹${formData.amount} (${formData.category})`);
      toast.success("Expense logged successfully!");
      setFormData({
        title: '', amount: '', category: 'Catering', paymentMode: 'Cash',
        eventId: '', voucherNo: '', vendorName: '', notes: ''
      });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error("Error logging expense: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = (exp) => {
    setDeletePrompt({ show: true, exp });
  };

  const confirmDeleteExpense = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.from('expenses').delete().eq('id', deletePrompt.exp.id);
      if (error) throw error;

      await logAuditEvent(user, 'DELETE_EXPENSE', `Deleted expense "${deletePrompt.exp.title}" of ₹${deletePrompt.exp.amount}`);
      toast.success("Expense deleted.");
      setDeletePrompt({ show: false, exp: null });
      onRefresh();
    } catch (err) {
      toast.error("Error deleting expense: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const data = filteredExpenses.map(e => ({
      'Voucher No': e.voucher_no || 'N/A',
      'Title': e.title,
      'Category': e.category,
      'Amount (₹)': e.amount,
      'Payment Mode': e.payment_mode,
      'Vendor Name': e.vendor_name || 'N/A',
      'Event Linked': e.events?.event_name || 'General',
      'Notes': e.notes || '',
      'Date': new Date(e.created_at).toLocaleDateString('en-GB')
    }));
    exportToExcel(data, 'Toloba_Expenses_Report');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Committee Expense Log ({filteredExpenses.length})</h2>
          <p className="text-xs text-slate-400">Total Outflow Logged: <span className="font-extrabold text-red-600">₹{totalExpense.toLocaleString('en-IN')}</span></p>
        </div>

        <div className="flex gap-3">
          {canWrite && (
            <button 
              onClick={() => setShowForm(!showForm)} 
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 shadow transition-all"
            >
              <PlusCircle size={16} /> {showForm ? 'Close Form' : 'Log New Expense'}
            </button>
          )}
          <button 
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
          >
            <FileSpreadsheet size={16} /> Export Expenses (.xlsx)
          </button>
        </div>
      </div>

      {/* ===== LOG EXPENSE FORM ===== */}
      {showForm && canWrite && (
        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-xl max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <TrendingDown size={20} className="text-red-600" /> Log Outflow Voucher
          </h3>

          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Expense Title</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="e.g. Catering for Niyaz" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    className="input-field pl-9 font-extrabold" 
                    placeholder="0.00" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Category</label>
                <CustomSelect 
                  className="input-field text-sm" 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  options={categories.map(c => ({ value: c, label: c }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Payment Mode</label>
                <CustomSelect 
                  className="input-field text-sm" 
                  value={formData.paymentMode} 
                  onChange={e => setFormData({...formData, paymentMode: e.target.value})}
                  options={[
                    { value: 'Cash', label: 'Cash' },
                    { value: 'UPI', label: 'UPI' },
                    { value: 'Bank Transfer', label: 'Bank Transfer' },
                    { value: 'Cheque', label: 'Cheque' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Link to Event (Optional)</label>
                <CustomSelect 
                  className="input-field text-sm" 
                  value={formData.eventId} 
                  onChange={e => setFormData({...formData, eventId: e.target.value})}
                  options={[
                    { value: '', label: '-- General Committee Expense --' },
                    ...events.map(ev => ({ value: ev.id, label: ev.event_name }))
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Vendor Name (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Al-Taiba Caterers" 
                  value={formData.vendorName} 
                  onChange={e => setFormData({...formData, vendorName: e.target.value})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Voucher / Bill No (Optional)</label>
                <input 
                  type="text" 
                  className="input-field font-mono" 
                  placeholder="e.g. VCH-0012" 
                  value={formData.voucherNo} 
                  onChange={e => setFormData({...formData, voucherNo: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Notes</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Additional notes..." 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5">
                <CheckCircle2 size={16} /> {loading ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 md:px-6 font-semibold">Voucher No</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Details</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">Category</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Amount</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">Event Linked</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Date</th>
                {canWrite && <th className="py-3.5 px-4 md:px-6 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr><td colSpan={canWrite ? 7 : 6} className="py-12 text-center text-slate-400">No expenses logged yet.</td></tr>
              ) : (
                filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 md:px-6 font-mono font-bold text-slate-600">{e.voucher_no || '---'}</td>
                    <td className="py-4 px-4 md:px-6">
                      <p className="font-semibold text-slate-800">{e.title}</p>
                      <p className="text-[11px] text-slate-400">Vendor: {e.vendor_name || 'N/A'}</p>
                      <p className="text-[11px] text-slate-400 md:hidden mt-0.5">{e.category}</p>
                    </td>
                    <td className="py-4 px-4 md:px-6 hidden md:table-cell">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 md:px-6 font-extrabold text-red-600">₹{parseFloat(e.amount).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-4 md:px-6 hidden md:table-cell">
                      {e.events ? (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {e.events.event_name}
                        </span>
                      ) : <span className="text-slate-400 text-xs italic">None</span>}
                    </td>
                    <td className="py-4 px-4 md:px-6 text-slate-600 font-medium">{new Date(e.created_at).toLocaleDateString('en-GB')}</td>
                    {canWrite && (
                      <td className="py-4 px-4 md:px-6 text-right space-x-2">
                        <button 
                          onClick={() => handleDeleteExpense(e)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== DELETE PROMPT MODAL ===== */}
      {deletePrompt.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Expense?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{deletePrompt.exp?.title}</span> of ₹{deletePrompt.exp?.amount}?
              <br/><br/>
              <span className="text-red-500 font-medium">Warning: This action cannot be undone.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeletePrompt({ show: false, exp: null })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteExpense}
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
