import toast from 'react-hot-toast';
import React, { useState, useMemo } from 'react';
import CustomSelect from '../ui/CustomSelect';
import { 
  PlusCircle, 
  Printer, 
  MessageCircle, 
  CheckCircle2, 
  IndianRupee, 
  Search, 
  FileSpreadsheet,
  Eye,
  Ban,
  Banknote,
  Smartphone,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToExcel } from '../../lib/exportUtils';
import { logAuditEvent } from '../../lib/auditLogger';

// Helper: Convert number to words for receipt
function numberToWords(num) {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = convert(intPart);
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result;
}

export default function ReceiptsManager({ receipts, members, user, canWrite, onRefresh, searchTerm }) {
  const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'print'
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [voidPrompt, setVoidPrompt] = useState({ show: false, receipt: null, reason: '' });

  // Form State
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    mode: 'Cash',
    periodMonth: 'January',
    periodYear: '2026',
    transactionId: '',
    remarks: ''
  });

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        r.receipt_no?.toLowerCase().includes(term) ||
        r.members?.name?.toLowerCase().includes(term) ||
        r.members?.its_number?.includes(term)
      );
    });
  }, [receipts, searchTerm]);

  // Handle Receipt Creation
  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    if (!formData.memberId) {
      toast.error("Please select a member!");
      return;
    }
    setLoading(true);

    try {
      let data = null;
      let retries = 3;
      let currentError = null;

      while (retries > 0) {
        // Calculate next sequential receipt number by fetching the latest one
        const { data: latestReceipt } = await supabase
          .from('receipts')
          .select('receipt_no')
          .order('created_at', { ascending: false })
          .limit(1);

        let nextNum = 1;
        if (latestReceipt && latestReceipt.length > 0) {
          const lastNo = latestReceipt[0].receipt_no;
          const match = lastNo.match(/REC-(\d+)/);
          if (match) {
            nextNum = parseInt(match[1], 10) + 1;
          }
        }
        
        const newReceiptNo = `TOLOBA-REC-${String(nextNum).padStart(4, '0')}`;

        const { data: insertData, error } = await supabase.from('receipts').insert([
          {
            receipt_no: newReceiptNo,
            member_id: formData.memberId,
            amount: parseFloat(formData.amount),
            payment_mode: formData.mode,
            transaction_id: formData.mode === 'UPI' ? formData.transactionId : null,
            period_month: formData.periodMonth,
            period_year: formData.periodYear,
            remarks: formData.remarks || null
          }
        ]).select('*, members(name, its_number, phone)').single();

        if (!error) {
          data = insertData;
          break; // Success!
        }
        
        // If it's a unique constraint violation (code 23505), retry
        if (error.code === '23505') {
          retries -= 1;
          currentError = error;
          // small delay before retry
          await new Promise(res => setTimeout(res, 300));
        } else {
          throw error; // Other error, throw immediately
        }
      }

      if (!data) throw currentError || new Error("Failed to generate unique receipt number after retries.");

      // Audit Log
      const selectedMember = members.find(m => m.id === formData.memberId);
      await logAuditEvent(user, 'CREATE_RECEIPT', `Generated receipt ${data.receipt_no} for ₹${formData.amount} (${selectedMember?.name})`);

      setSelectedReceipt(data);
      setViewMode('print');
      onRefresh();
    } catch (err) {
      toast.error("Failed to create receipt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Void Receipt
  const handleVoidReceipt = (receipt) => {
    setVoidPrompt({ show: true, receipt, reason: '' });
  };

  const confirmVoidReceipt = async () => {
    if (!voidPrompt.reason.trim()) {
      toast.error("Please provide a reason for voiding.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('receipts')
        .update({ status: 'void', remarks: `VOIDED: ${voidPrompt.reason}` })
        .eq('id', voidPrompt.receipt.id);

      if (error) throw error;

      await logAuditEvent(user, 'VOID_RECEIPT', `Voided receipt ${voidPrompt.receipt.receipt_no}. Reason: ${voidPrompt.reason}`);
      toast.success(`Receipt ${voidPrompt.receipt.receipt_no} has been voided.`);
      setVoidPrompt({ show: false, receipt: null, reason: '' });
      onRefresh();
    } catch (err) {
      toast.error("Error voiding receipt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredReceipts.map(r => ({
      'Receipt No': r.receipt_no,
      'Member Name': r.members?.name || 'N/A',
      'ITS Number': r.members?.its_number || 'N/A',
      'Amount (₹)': r.amount,
      'Payment Mode': r.payment_mode,
      'Transaction ID / UTR': r.transaction_id || 'N/A',
      'Period': `${r.period_month} ${r.period_year}`,
      'Status': r.status,
      'Date': new Date(r.created_at).toLocaleDateString('en-GB')
    }));
    exportToExcel(exportData, 'Toloba_Lawazam_Receipts');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Action Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-col md:flex-row gap-4">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button 
            onClick={() => setViewMode('list')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'list' ? 'bg-toloba text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All Receipts ({filteredReceipts.length})
          </button>
          {canWrite && (
            <button 
              onClick={() => {
                setFormData({
                  memberId: '', amount: '', mode: 'Cash',
                  periodMonth: 'January', periodYear: '2026', transactionId: '', remarks: ''
                });
                setViewMode('create');
              }} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${viewMode === 'create' ? 'bg-toloba text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <PlusCircle size={14} /> New Receipt
            </button>
          )}
        </div>

        <button 
          onClick={handleExportExcel}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow w-full md:w-auto"
        >
          <FileSpreadsheet size={16} /> Export
        </button>
      </div>

      {/* ===== LIST VIEW ===== */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Receipt No</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Member Name</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold">ITS</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Amount</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Mode</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold hidden md:table-cell">Period</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Status</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReceipts.length === 0 ? (
                  <tr><td colSpan="8" className="py-12 text-center text-slate-400">No receipts found.</td></tr>
                ) : (
                  filteredReceipts.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${r.status === 'void' ? 'bg-red-50/50 opacity-60' : ''}`}>
                      <td className="py-4 px-4 md:px-6 font-mono font-bold text-toloba">{r.receipt_no}</td>
                      <td className="py-4 px-4 md:px-6 font-semibold text-slate-800">{r.members?.name || 'N/A'}</td>
                      <td className="py-4 px-4 md:px-6 font-mono text-slate-600">{r.members?.its_number || '---'}</td>
                      <td className="py-4 px-4 md:px-6 font-extrabold text-slate-900">₹{parseFloat(r.amount).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4 md:px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold ${r.payment_mode === 'Cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.payment_mode}
                        </span>
                      </td>
                      <td className="py-4 px-4 md:px-6 text-slate-600 font-medium hidden md:table-cell">{r.period_month} {r.period_year}</td>
                      <td className="py-4 px-4 md:px-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                          {r.status?.toUpperCase() || 'VALID'}
                        </span>
                      </td>
                      <td className="py-4 px-4 md:px-6 text-right space-x-2">
                        <button 
                          onClick={() => { setSelectedReceipt(r); setViewMode('print'); }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                          title="View / Re-print Receipt"
                        >
                          <Eye size={14} /> <span className="hidden md:inline">View</span>
                        </button>
                        {canWrite && r.status !== 'void' && (
                          <button 
                            onClick={() => handleVoidReceipt(r)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                            title="Void Receipt"
                          >
                            <Ban size={14} />
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
      )}

      {/* ===== CREATE FORM VIEW ===== */}
      {viewMode === 'create' && (
        <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xl">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Generate Receipt</h2>
            <p className="text-xs text-slate-400 mt-1">Record incoming fee contribution from member</p>
          </div>

          <form onSubmit={handleCreateReceipt} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Select Member</label>
              <CustomSelect 
                className="input-field w-full text-sm" 
                value={formData.memberId} 
                onChange={e => setFormData({...formData, memberId: e.target.value})}
                options={[
                  { value: '', label: '-- Search & Choose Member --' },
                  ...members.map(m => ({ value: m.id, label: `${m.name} (ITS: ${m.its_number})` }))
                ]}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Period Month</label>
                <CustomSelect 
                  className="input-field text-sm" 
                  value={formData.periodMonth} 
                  onChange={e => setFormData({...formData, periodMonth: e.target.value})}
                  options={[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map(m => ({ value: m, label: m }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Period Year</label>
                <CustomSelect 
                  className="input-field text-sm" 
                  value={formData.periodYear} 
                  onChange={e => setFormData({...formData, periodYear: e.target.value})}
                  options={['2024', '2025', '2026', '2027', '2028'].map(y => ({ value: y, label: y }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Payment Mode</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center space-x-2 cursor-pointer py-2.5 rounded-xl border-2 transition-all ${formData.mode === 'Cash' ? 'border-green-600 bg-green-50 text-green-700 font-bold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                    <input type="radio" name="mode" value="Cash" checked={formData.mode === 'Cash'} onChange={e => setFormData({...formData, mode: e.target.value})} className="sr-only" />
                    <span className="flex items-center gap-1.5"><Banknote size={16} /> Cash</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center space-x-2 cursor-pointer py-2.5 rounded-xl border-2 transition-all ${formData.mode === 'UPI' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                    <input type="radio" name="mode" value="UPI" checked={formData.mode === 'UPI'} onChange={e => setFormData({...formData, mode: e.target.value})} className="sr-only" />
                    <span className="flex items-center gap-1.5"><Smartphone size={16} /> UPI</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    className="input-field pl-10 font-extrabold text-base" 
                    placeholder="0.00" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            {formData.mode === 'UPI' && (
              <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200">
                <label className="block text-xs font-bold uppercase text-blue-900 mb-1.5">UPI Reference / UTR Number</label>
                <input 
                  type="text" 
                  required 
                  className="input-field border-blue-300 bg-white font-mono" 
                  placeholder="e.g. 426512345678" 
                  value={formData.transactionId} 
                  onChange={e => setFormData({...formData, transactionId: e.target.value})} 
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Remarks / Notes (Optional)</label>
              <input 
                type="text" 
                className="input-field text-xs" 
                placeholder="e.g. Advance for Q3" 
                value={formData.remarks} 
                onChange={e => setFormData({...formData, remarks: e.target.value})} 
              />
            </div>

            <div className="pt-4 flex gap-4">
              <button type="button" onClick={() => setViewMode('list')} className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="w-2/3 btn-primary py-3 flex items-center justify-center gap-2 text-sm">
                <CheckCircle2 size={18} />
                <span>{loading ? 'Saving...' : 'Save & Print Receipt'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== PRINT VIEW ===== */}
      {viewMode === 'print' && selectedReceipt && (
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 flex justify-between items-center no-print">
            <button onClick={() => setViewMode('list')} className="text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-2">
              ← Back to Receipts List
            </button>
            
            <div className="flex gap-3">
              {selectedReceipt.members?.phone && (
                <a 
                  href={`https://wa.me/${selectedReceipt.members.phone}?text=${encodeURIComponent(
                    `*TOLOBA UL KULLIYAAT IL MUMINOON (ANAND)*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `*OFFICIAL RECEIPT*\n\n` +
                    `Receipt No: *${selectedReceipt.receipt_no}*\n` +
                    `Date: ${new Date(selectedReceipt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
                    `Received From: *${selectedReceipt.members.name}*\n` +
                    `ITS: ${selectedReceipt.members.its_number}\n\n` +
                    `Amount: *₹${parseFloat(selectedReceipt.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}*\n` +
                    `Mode: ${selectedReceipt.payment_mode}${selectedReceipt.payment_mode === 'UPI' ? ' (Txn: ' + selectedReceipt.transaction_id + ')' : ''}\n` +
                    `Period: ${selectedReceipt.period_month} ${selectedReceipt.period_year}\n\n` +
                    `Purpose: Fee / Contribution\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `_Thank you for your contribution._\n` +
                    `_May Allah grant barakat in your wealth and health._`
                  )}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700 text-xs shadow-md shadow-green-600/20"
                >
                  <MessageCircle size={16} /> Send to WhatsApp
                </a>
              )}

              <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 bg-slate-800 hover:bg-slate-900 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-xs shadow-md">
                <Printer size={16} /> Print / Download PDF
              </button>
            </div>
          </div>

          {/* Printable Container */}
          <div id="printable-receipt" className="bg-white border border-slate-200 shadow-2xl rounded-xl relative overflow-hidden" style={{fontFamily: "'Inter', sans-serif"}}>
            
            {/* Header Banner */}
            <div className="bg-toloba px-8 py-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg flex-shrink-0 border border-white/20 bg-white p-1">
                  <img src="/TolobaLogoAnand-transparent.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-wide">TOLOBA UL KULLIYAAT IL MUMINOON (ANAND)</h1>
                  <p className="text-white/70 text-xs font-medium mt-0.5">Treasury Committee</p>
                </div>
              </div>
            </div>

            {/* Meta Row */}
            <div className="px-8 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
              <div className="flex gap-6">
                <p className="text-slate-600">Receipt No: <span className="font-bold text-toloba-dark text-sm">{selectedReceipt.receipt_no}</span></p>
                <p className="text-slate-600">Date: <span className="font-bold text-slate-800">{new Date(selectedReceipt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span></p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedReceipt.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                {selectedReceipt.status === 'void' ? 'VOIDED' : 'OFFICIAL RECEIPT'}
              </span>
            </div>

            {/* Receipt Body */}
            <div className="px-8 py-6 relative z-10">
              
              <table className="w-full border-collapse text-xs mb-6">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-500 font-medium w-36">Received From</td>
                    <td className="py-2.5 font-bold text-slate-900 text-base">{selectedReceipt.members?.name || 'Member'}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-500 font-medium">ITS Number</td>
                    <td className="py-2.5 font-bold font-mono text-slate-800 tracking-wider text-sm">{selectedReceipt.members?.its_number || '---'}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-500 font-medium">Purpose</td>
                    <td className="py-2.5 font-semibold text-slate-800">Fee / Contribution</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-500 font-medium">Period</td>
                    <td className="py-2.5">
                      <span className="font-bold bg-toloba/10 text-toloba-dark px-2.5 py-0.5 rounded border border-toloba/15">
                        {selectedReceipt.period_month} {selectedReceipt.period_year}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 text-slate-500 font-medium">Payment Mode</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${selectedReceipt.payment_mode === 'Cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {selectedReceipt.payment_mode === 'Cash' ? <Banknote size={12} className="mr-1" /> : <Smartphone size={12} className="mr-1" />} {selectedReceipt.payment_mode}
                      </span>
                    </td>
                  </tr>
                  {selectedReceipt.payment_mode === 'UPI' && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 text-slate-500 font-medium">Transaction UTR</td>
                      <td className="py-2.5 font-mono font-semibold text-slate-700">{selectedReceipt.transaction_id}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Amount Display */}
              <div className="bg-toloba/5 border border-toloba/20 rounded-xl p-4 text-center mb-6">
                <p className="text-xs text-slate-500 font-medium mb-0.5">Amount Received</p>
                <p className="text-3xl font-extrabold text-toloba-dark">
                  ₹{parseFloat(selectedReceipt.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  (Rupees {numberToWords(parseFloat(selectedReceipt.amount))} Only)
                </p>
              </div>

              {/* Signature */}
              <div className="flex justify-between items-end pt-2">
                <div className="max-w-[240px]">
                  <p className="text-xs text-slate-500 italic">"May Allah grant barakat in your wealth and health."</p>
                  <p className="text-[9px] text-slate-400 mt-2">Computer generated receipt. No seal required.</p>
                </div>
                
                <div className="text-center relative">
                  <div className="flex justify-center h-20 items-end">
                    <img 
                      src="/esign.png" 
                      alt="Burhanuddin Rampurwala Signature" 
                      className="h-24 object-contain -rotate-6 translate-y-3 mix-blend-multiply opacity-90 relative z-10" 
                    />
                  </div>
                  <div className="w-52 border-t border-toloba-dark pt-1 relative z-0">
                    <p className="font-bold text-slate-800 text-xs mt-1">Burhanuddin Rampurwala</p>
                    <p className="text-[10px] text-slate-500 font-medium">Treasurer</p>
                  </div>
                </div>
              </div>

            </div>

            <div className="h-1.5 bg-gradient-to-r from-toloba-dark via-toloba to-toloba-light"></div>
          </div>
        </div>
      )}

      {/* ===== VOID PROMPT MODAL ===== */}
      {voidPrompt.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Void Receipt</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to VOID receipt <span className="font-semibold text-red-600">{voidPrompt.receipt?.receipt_no}</span>?
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Reason for Voiding</label>
              <input 
                type="text" 
                value={voidPrompt.reason}
                onChange={(e) => setVoidPrompt({ ...voidPrompt, reason: e.target.value })}
                placeholder="E.g., Error in amount, Duplicate..."
                className="input-field border-red-200 focus:border-red-500 focus:ring-red-500/20"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmVoidReceipt()}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setVoidPrompt({ show: false, receipt: null, reason: '' })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmVoidReceipt}
                disabled={loading || !voidPrompt.reason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium shadow-lg shadow-red-500/30 transition-all flex items-center gap-2"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />}
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
