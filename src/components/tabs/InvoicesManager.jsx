import toast from 'react-hot-toast';
import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  PlusCircle, 
  CheckCircle2, 
  MessageCircle, 
  IndianRupee, 
  Calendar, 
  Clock, 
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToExcel } from '../../lib/exportUtils';
import { logAuditEvent } from '../../lib/auditLogger';

export default function InvoicesManager({ invoices, user, canWrite, onRefresh, searchTerm }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    clientName: '',
    clientIts: '',
    clientPhone: '',
    title: '',
    amount: '',
    dueDate: '',
    notes: ''
  });

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        inv.invoice_no?.toLowerCase().includes(term) ||
        inv.client_name?.toLowerCase().includes(term) ||
        inv.title?.toLowerCase().includes(term) ||
        inv.client_its?.includes(term)
      );
    });
  }, [invoices, searchTerm]);

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let data = null;
      let retries = 3;
      let currentError = null;

      while (retries > 0) {
        const { data: latestInvoice } = await supabase
          .from('invoices')
          .select('invoice_no')
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNum = 1;
        if (latestInvoice && latestInvoice.length > 0) {
          const lastNo = latestInvoice[0].invoice_no;
          const match = lastNo.match(/INV-(\d+)/);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        
        const newInvoiceNo = `TOLOBA-INV-${String(nextNum).padStart(4, '0')}`;

        const { data: insertData, error } = await supabase.from('invoices').insert([
          {
            invoice_no: newInvoiceNo,
            client_name: formData.clientName,
            client_its: formData.clientIts || null,
            client_phone: formData.clientPhone || null,
            title: formData.title,
            amount: parseFloat(formData.amount),
            due_date: formData.dueDate,
            notes: formData.notes || null,
            status: 'unpaid'
          }
        ]).select().single();

        if (!error) {
          data = insertData;
          break;
        }

        if (error.code === '23505') {
          retries -= 1;
          currentError = error;
          await new Promise(res => setTimeout(res, 300));
        } else {
          throw error;
        }
      }

      if (!data) throw currentError || new Error("Failed to generate unique invoice number after retries.");

      await logAuditEvent(user, 'CREATE_INVOICE', `Created Invoice ${data.invoice_no} for ₹${formData.amount} (${formData.clientName})`);
      toast.success("Invoice generated successfully!");
      setFormData({ clientName: '', clientIts: '', clientPhone: '', title: '', amount: '', dueDate: '', notes: '' });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error("Error generating invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (inv) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', payment_date: new Date().toISOString() })
        .eq('id', inv.id);

      if (error) throw error;

      await logAuditEvent(user, 'MARK_INVOICE_PAID', `Marked Invoice ${inv.invoice_no} as PAID`);
      toast.success(`Invoice ${inv.invoice_no} marked as Paid!`);
      onRefresh();
    } catch (err) {
      toast.error("Error updating invoice: " + err.message);
    }
  };

  const handleExportExcel = () => {
    const data = filteredInvoices.map(inv => ({
      'Invoice No': inv.invoice_no,
      'Client Name': inv.client_name,
      'ITS Number': inv.client_its || 'N/A',
      'Title / Particulars': inv.title,
      'Amount (₹)': inv.amount,
      'Due Date': inv.due_date,
      'Status': inv.status,
      'Created Date': new Date(inv.created_at).toLocaleDateString('en-GB')
    }));
    exportToExcel(data, 'Toloba_Invoices_Report');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Invoicing & Bill Management ({filteredInvoices.length})</h2>
          <p className="text-xs text-slate-400 mt-0.5">Issue debit notes and track unpaid bills for stalls, sponsorships, or pledges</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canWrite && (
            <button 
              onClick={() => setShowForm(!showForm)} 
              className="flex-1 sm:flex-none justify-center btn-primary text-xs font-bold py-2 px-3.5 flex items-center gap-1.5 shadow"
            >
              <PlusCircle size={16} /> <span>{showForm ? 'Close Form' : 'Generate New Invoice'}</span>
            </button>
          )}
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-slate-800 hover:bg-slate-900 transition-all text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
          >
            <FileSpreadsheet size={16} /> <span>Export (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* ===== GENERATE INVOICE FORM ===== */}
      {showForm && canWrite && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-blue-200 shadow-xl max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> New Bill / Invoice Entry
          </h3>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Client / Party Name</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="e.g. Al-Dawat Traders" 
                  value={formData.clientName} 
                  onChange={e => setFormData({...formData, clientName: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">ITS Number (Optional)</label>
                <input 
                  type="text" 
                  maxLength={8} 
                  className="input-field font-mono" 
                  placeholder="8 digits" 
                  value={formData.clientIts} 
                  onChange={e => setFormData({...formData, clientIts: e.target.value.replace(/\D/g, '')})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Bill Particulars / Title</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="e.g. Sponsorship for Niyaz Stall" 
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
                    className="input-field pl-9 font-extrabold text-base" 
                    placeholder="0.00" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Due Date</label>
                <input 
                  type="date" 
                  required 
                  className="input-field text-xs" 
                  value={formData.dueDate} 
                  onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Client WhatsApp Phone</label>
                <input 
                  type="tel" 
                  className="input-field font-mono" 
                  placeholder="e.g. 919876543210" 
                  value={formData.clientPhone} 
                  onChange={e => setFormData({...formData, clientPhone: e.target.value.replace(/\D/g, '')})} 
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="w-1/2 sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="w-1/2 sm:w-auto btn-primary px-6 py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow">
                <CheckCircle2 size={16} /> {loading ? 'Saving...' : 'Generate Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== INVOICES TABLE ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Mobile View: Modern Invoices Cards (No Horizontal Scroll) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredInvoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No invoices found.</div>
          ) : (
            filteredInvoices.map(inv => (
              <div key={inv.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {inv.invoice_no}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Due: {new Date(inv.due_date).toLocaleDateString('en-GB')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <p className="font-bold text-slate-800 text-sm truncate">{inv.title}</p>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 flex-wrap">
                    <span>Party: <span className="text-slate-600 font-semibold">{inv.client_name}</span></span>
                    {inv.client_its && (
                      <>
                        <span>•</span>
                        <span className="font-mono">ITS: {inv.client_its}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-base font-extrabold text-blue-600">
                    ₹{parseFloat(inv.amount).toLocaleString('en-IN')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {inv.client_phone && (
                      <a 
                        href={`https://wa.me/${inv.client_phone}?text=${encodeURIComponent(
                          `*INVOICE NOTICE - TOLOBA UL KULLIYAAT IL MUMINOON*\n` +
                          `━━━━━━━━━━━━━━━━━━━━\n` +
                          `Invoice No: *${inv.invoice_no}*\n` +
                          `Client: *${inv.client_name}*\n` +
                          `Particulars: ${inv.title}\n` +
                          `Amount Due: *₹${parseFloat(inv.amount).toLocaleString('en-IN')}*\n` +
                          `Due Date: ${new Date(inv.due_date).toLocaleDateString('en-GB')}\n\n` +
                          `Please clear the dues at your earliest convenience.`
                        )}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                        title="WhatsApp Bill Reminder"
                      >
                        <MessageCircle size={14} /> <span className="text-[11px]">Send</span>
                      </a>
                    )}

                    {canWrite && inv.status === 'unpaid' && (
                      <button 
                        onClick={() => handleMarkAsPaid(inv)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow"
                        title="Mark as Paid"
                      >
                        <CheckCircle2 size={14} /> <span className="text-[11px]">Paid</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Spreadsheet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 md:px-6 font-semibold">Invoice Details</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">Vendor</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Amount</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Due Date</th>
                <th className="py-3.5 px-4 md:px-6 font-semibold">Status</th>
                {canWrite && <th className="py-3.5 px-4 md:px-6 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan="6" className="py-12 text-center text-slate-400">No invoices found.</td></tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 md:px-6">
                      <p className="font-bold text-slate-800">{inv.invoice_no}</p>
                      <p className="text-xs text-slate-500">{inv.title}</p>
                    </td>
                    <td className="py-4 px-4 md:px-6 hidden md:table-cell text-slate-600 font-medium">
                      {inv.client_name}
                    </td>
                    <td className="py-4 px-4 md:px-6 font-extrabold text-blue-600">
                      ₹{parseFloat(inv.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 md:px-6 text-slate-500 font-medium">
                      {new Date(inv.due_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-4 px-4 md:px-6">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 md:px-6 text-right space-x-2">
                      {inv.client_phone && (
                        <a 
                          href={`https://wa.me/${inv.client_phone}?text=${encodeURIComponent(
                            `*INVOICE NOTICE - TOLOBA UL KULLIYAAT IL MUMINOON*\n` +
                            `━━━━━━━━━━━━━━━━━━━━\n` +
                            `Invoice No: *${inv.invoice_no}*\n` +
                            `Client: *${inv.client_name}*\n` +
                            `Particulars: ${inv.title}\n` +
                            `Amount Due: *₹${parseFloat(inv.amount).toLocaleString('en-IN')}*\n` +
                            `Due Date: ${new Date(inv.due_date).toLocaleDateString('en-GB')}\n\n` +
                            `Please clear the dues at your earliest convenience.`
                          )}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="p-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          title="WhatsApp Bill Reminder"
                        >
                          <MessageCircle size={14} /> Send Bill
                        </a>
                      )}

                      {canWrite && inv.status === 'unpaid' && (
                        <button 
                          onClick={() => handleMarkAsPaid(inv)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow"
                        >
                          <CheckCircle2 size={14} /> Mark Paid
                        </button>
                      )}
                    </td>
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
