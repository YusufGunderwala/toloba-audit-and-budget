import { ShowMoreRows } from '../ui/ShowMoreRows';
import { useVisibleRows } from '../../lib/useVisibleRows';
import toast from 'react-hot-toast';
import React, { useState, useMemo, useEffect, memo } from 'react';
import CustomSelect from '../ui/CustomSelect';
import DateRangePicker from '../ui/DateRangePicker';
import { 
  PlusCircle, 
  ArrowLeft,
  Download,
  Printer,
  MessageCircle, 
  CheckCircle2, 
  IndianRupee, 
  FileSpreadsheet,
  Eye,
  Ban,
  Banknote,
  Smartphone,
  RefreshCw,
  XCircle,
  Calendar,
  CalendarDays,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToExcel } from '../../lib/exportUtils';
import { treasuryDate, receiptDate, formatTreasuryDate } from '../../lib/treasuryDates';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const receiptAction = 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toloba disabled:cursor-not-allowed disabled:opacity-50';
const secondaryReceiptAction = `${receiptAction} border-slate-300 bg-white text-slate-700 enabled:hover:border-slate-400 enabled:hover:bg-slate-50`;
const currentYear = Number(treasuryDate().slice(0, 4));
const YEARS = Array.from({ length: currentYear - 2024 + 3 }, (_, index) => String(2024 + index));
const currentMonth = MONTHS[Number(treasuryDate().slice(5, 7)) - 1];

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

function ReceiptsManager({ receipts, members, canWrite, onRefresh, searchTerm }) {
  const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'print'
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [voidPrompt, setVoidPrompt] = useState({ show: false, receipt: null, reason: '' });

  const [buildReceiptPDF, setBuildReceiptPDF] = useState(null);
  const [pdfError, setPdfError] = useState('');
  useEffect(() => {
    if (viewMode !== 'print') return;
    let current = true;
    import('../../lib/receiptPDF').then(async module => {
      const buildPDF = await module.loadReceiptPDF();
      if (current) setBuildReceiptPDF(() => buildPDF);
    }).catch(() => {
      if (current) setPdfError('Could not load PDF tools. Refresh the page and try again.');
    });
    return () => { current = false; };
  }, [viewMode]);

  const shareReceipt = async () => {
    try {
      const pdf = buildReceiptPDF(selectedReceipt);
      const filename = `${selectedReceipt.receipt_no}.pdf`;
      const files = [new File([pdf.output('blob')], filename, { type: 'application/pdf' })];
      if (navigator.canShare?.({ files })) {
        try {
          await navigator.share({ files });
          return;
        } catch (error) {
          if (error.name === 'AbortError') return;
        }
      }
      pdf.save(filename);
      toast('PDF downloaded. Attach it to your WhatsApp chat.');
    } catch (error) {
      toast.error(`Could not prepare the receipt PDF: ${error.message}`);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    receiptDate: treasuryDate(),
    memberId: '',
    amount: '',
    mode: 'Cash',
    periodMonth: currentMonth,
    periodYear: String(currentYear),
    transactionId: '',
    remarks: ''
  });

  // Filter States: 'all' | 'month' | 'custom_date'
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('ALL');

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // 1. Text Search Filter (Receipt No, Member Name, ITS)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          r.receipt_no?.toLowerCase().includes(term) ||
          r.members?.name?.toLowerCase().includes(term) ||
          r.members?.its_number?.includes(term);
        if (!matchesSearch) return false;
      }

      // 2. Payment Mode Filter
      if (filterPaymentMode !== 'ALL' && r.payment_mode !== filterPaymentMode) {
        return false;
      }

      // 3. Month / Date Range Filter
      if (filterType === 'month') {
        if (filterYear !== 'ALL') {
          const rYear = r.period_year || receiptDate(r).slice(0, 4);
          if (rYear !== filterYear) return false;
        }
        if (filterMonth !== 'ALL') {
          const rMonth = r.period_month || MONTHS[Number(receiptDate(r).slice(5, 7)) - 1];
          if (rMonth !== filterMonth) {
            return false;
          }
        }
      } else if (filterType === 'custom_date') {
        if (startDate || endDate) {
          const localDateStr = receiptDate(r);

          if (startDate && localDateStr < startDate) return false;
          if (endDate && localDateStr > endDate) return false;
        }
      }

      return true;
    });
  }, [receipts, searchTerm, filterType, filterMonth, filterYear, startDate, endDate, filterPaymentMode]);

  const { visibleRows, showMore, remaining } = useVisibleRows(filteredReceipts);

  const filteredTotalAmount = useMemo(() => {
    return filteredReceipts
      .filter(r => r.status !== 'void')
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  }, [filteredReceipts]);

  // Handle Receipt Creation
  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    if (loading || !canWrite) return;
    if (!formData.memberId) {
      toast.error("Please select a member!");
      return;
    }
    setLoading(true);

    try {
      if (!formData.receiptDate || formData.receiptDate > treasuryDate()) {
        throw new Error('Choose a receipt date through today.');
      }
      const { data, error } = await supabase.from('receipts').insert({
        receipt_date: formData.receiptDate,
        member_id: formData.memberId,
        amount: formData.amount,
        payment_mode: formData.mode,
        transaction_id: formData.mode === 'UPI' ? formData.transactionId.trim() : null,
        period_month: formData.periodMonth,
        period_year: formData.periodYear,
        remarks: formData.remarks || null
      }).select('*, members(name, its_number, phone)').single();
      if (error) throw error;

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
    if (!canWrite) return;
    setVoidPrompt({ show: true, receipt, reason: '' });
  };

  const confirmVoidReceipt = async () => {
    if (!canWrite || loading) return;
    if (!voidPrompt.reason.trim()) {
      toast.error("Please provide a reason for voiding.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('receipts')
        .update({ status: 'void', void_reason: voidPrompt.reason.trim() })
        .eq('id', voidPrompt.receipt.id).eq('status', 'valid').select('id').single();

      if (error) throw error;

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
    let filename = 'Toloba_Lawazam_Receipts';
    if (filterType === 'month') {
      const mStr = filterMonth !== 'ALL' ? filterMonth : 'AllMonths';
      const yStr = filterYear !== 'ALL' ? filterYear : 'AllYears';
      filename = `Toloba_Receipts_${mStr}_${yStr}`;
    } else if (filterType === 'custom_date' && (startDate || endDate)) {
      filename = `Toloba_Receipts_${startDate || 'Start'}_to_${endDate || 'Today'}`;
    }

    const exportData = filteredReceipts.map(r => ({
      'Receipt No': r.receipt_no,
      'Member Name': r.members?.name || 'N/A',
      'ITS Number': r.members?.its_number || 'N/A',
      'Amount (₹)': r.amount,
      'Payment Mode': r.payment_mode,
      'Transaction ID / UTR': r.transaction_id || 'N/A',
      'Period': `${r.period_month} ${r.period_year}`,
      'Status': r.status,
      'Date': formatTreasuryDate(receiptDate(r))
    }));
    exportToExcel(exportData, filename);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Action & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        
        {/* Row 1: Action Tabs & Export Button (Always side-by-side) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
            <button 
              onClick={() => {
                setViewMode('list');
                setFilterType('all');
                setFilterMonth('ALL');
                setFilterYear(String(currentYear));
                setStartDate('');
                setEndDate('');
                setFilterPaymentMode('ALL');
              }} 
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                viewMode === 'list' && filterType === 'all' && filterPaymentMode === 'ALL'
                  ? 'bg-toloba text-white shadow-sm shadow-emerald-900/20' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Receipts ({receipts.length})
            </button>
            {canWrite && (
              <button 
                onClick={() => {
                  setFormData({
                    receiptDate: treasuryDate(), memberId: '', amount: '', mode: 'Cash',
                    periodMonth: MONTHS[Number(treasuryDate().slice(5, 7)) - 1], periodYear: treasuryDate().slice(0, 4), transactionId: '', remarks: ''
                  });
                  setViewMode('create');
                }} 
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                  viewMode === 'create' ? 'bg-toloba text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <PlusCircle size={14} /> New Receipt
              </button>
            )}
          </div>

          <button 
            onClick={handleExportExcel}
            className="px-3 sm:px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all border border-slate-800 flex-shrink-0"
            title="Export to Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" /> 
            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden text-xs">Excel</span>
          </button>
        </div>

        {/* Row 2: Filter Controls (Visible in List View) */}
        {viewMode === 'list' && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            
            {/* Filter Pills Grid (Full width on mobile, snug on desktop) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              
              {/* Filter Type Segmented Control */}
              <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center active:scale-95 ${
                    filterType === 'all'
                      ? 'bg-white text-toloba-dark shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('month')}
                  className={`py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 text-center active:scale-95 ${
                    filterType === 'month'
                      ? 'bg-white text-toloba shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar size={13} /> <span>Month</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('custom_date')}
                  className={`py-1.5 px-2 sm:px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 text-center active:scale-95 ${
                    filterType === 'custom_date'
                      ? 'bg-white text-toloba shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays size={13} /> <span>Custom</span>
                </button>
              </div>

              {/* Mode Pills & Reset Control */}
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {['ALL', 'Cash', 'UPI'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFilterPaymentMode(m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                        filterPaymentMode === m
                          ? 'bg-white text-toloba shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {m === 'ALL' ? 'All Modes' : m}
                    </button>
                  ))}
                </div>

                {(filterType !== 'all' || filterPaymentMode !== 'ALL' || filterMonth !== 'ALL' || filterYear !== String(currentYear) || startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType('all');
                      setFilterMonth('ALL');
                      setFilterYear(String(currentYear));
                      setStartDate('');
                      setEndDate('');
                      setFilterPaymentMode('ALL');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200/80 rounded-xl text-xs font-bold transition-all active:scale-95"
                    title="Reset Filters"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

            </div>

            {/* Sub-row: If Month-wise is active */}
            {filterType === 'month' && (
              <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100/80 animate-in fade-in duration-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <span className="text-[10px] font-bold text-toloba-dark uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={12} /> Select Month & Year:
                </span>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 flex-1">
                  <CustomSelect
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                    className="w-full sm:w-36 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs"
                    options={[
                      { value: 'ALL', label: 'All Months' },
                      ...MONTHS.map(m => ({ value: m, label: m }))
                    ]}
                  />

                  <CustomSelect
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                    className="w-full sm:w-28 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs"
                    options={[
                      { value: 'ALL', label: 'All Years' },
                      ...YEARS.map(y => ({ value: y, label: y }))
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Sub-row: If Custom Dates is active */}
            {filterType === 'custom_date' && (
              <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100/90 animate-in fade-in duration-200">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={({ startDate: s, endDate: e }) => {
                    setStartDate(s);
                    setEndDate(e);
                  }}
                />
              </div>
            )}

            {/* Filter Summary Banner */}
            {(filterType !== 'all' || filterPaymentMode !== 'ALL' || searchTerm) && (
              <div className="flex items-center justify-between gap-1.5 text-xs bg-toloba/5 border border-toloba/15 rounded-xl px-3 py-1.5 animate-in fade-in duration-150">
                <span className="text-toloba-dark font-medium truncate">
                  Filtered:{' '}
                  <strong className="font-bold">
                    {filterType === 'month' 
                      ? `${filterMonth === 'ALL' ? 'All Months' : filterMonth} ${filterYear === 'ALL' ? '' : filterYear}`
                      : filterType === 'custom_date' 
                        ? `${startDate || 'Start'} ➔ ${endDate || 'Today'}`
                        : 'All Time'}
                  </strong>
                  {filterPaymentMode !== 'ALL' && ` • ${filterPaymentMode}`}
                </span>
                <span className="font-bold text-toloba-dark flex-shrink-0">
                  {filteredReceipts.length} ({`₹${filteredTotalAmount.toLocaleString('en-IN')}`})
                </span>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ===== LIST VIEW ===== */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Mobile View: Clean Receipt Cards (No Horizontal Scroll) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filteredReceipts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No receipts found.</div>
            ) : (
              visibleRows.map(r => (
                <div key={r.id} className={`p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors ${r.status === 'void' ? 'bg-red-50/40 opacity-70' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-toloba bg-toloba/10 px-2 py-0.5 rounded border border-toloba/20">
                        {r.receipt_no}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {formatTreasuryDate(receiptDate(r))}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                        {r.status?.toUpperCase() || 'VALID'}
                      </span>
                    </div>

                    <p className="font-bold text-slate-800 text-sm truncate">{r.members?.name || 'N/A'}</p>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 flex-wrap">
                      <span className="font-mono text-slate-500">ITS: {r.members?.its_number || '---'}</span>
                      <span>•</span>
                      <span>{r.period_month} {r.period_year}</span>
                      <span>•</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.payment_mode === 'Cash' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {r.payment_mode}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-base font-extrabold text-slate-900">
                      ₹{parseFloat(r.amount).toLocaleString('en-IN')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => { setSelectedReceipt(r); setViewMode('print'); }}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                        title="View / Print Receipt"
                      >
                        <Eye size={14} />
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
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Receipt No</th>
                  <th className="py-3.5 px-4 md:px-6 font-semibold">Receipt Date</th>
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
                  <tr><td colSpan="9" className="py-12 text-center text-slate-400">No receipts found.</td></tr>
                ) : (
                  visibleRows.map(r => (
                    <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${r.status === 'void' ? 'bg-red-50/50 opacity-60' : ''}`}>
                      <td className="py-4 px-4 md:px-6 font-mono font-bold text-toloba">{r.receipt_no}</td>
                      <td className="py-4 px-4 md:px-6 text-slate-600">{formatTreasuryDate(receiptDate(r))}</td>
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
        <ShowMoreRows remaining={remaining} onClick={showMore} />
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
            <label className="block">
              <span className="block text-sm font-semibold mb-1">Receipt date</span>
              <input type="date" required max={treasuryDate()} className="input-field"
                value={formData.receiptDate}
                onChange={event => setFormData({ ...formData, receiptDate: event.target.value })} />
            </label>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Select Member</label>
              <CustomSelect 
                className="input-field w-full text-sm" 
                value={formData.memberId} 
                onChange={e => setFormData({...formData, memberId: e.target.value})}
                options={[
                  { value: '', label: '-- Search & Choose Member --' },
                  ...members.filter(m => m.status === 'active').map(m => ({ value: m.id, label: `${m.name} (ITS: ${m.its_number})` }))
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
                  options={YEARS.map(y => ({ value: y, label: y }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
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
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:mb-6">
            <button type="button" onClick={() => setViewMode('list')} className={`${receiptAction} border-transparent text-slate-600 enabled:hover:bg-white enabled:hover:text-slate-900`}>
              <ArrowLeft size={16} className="shrink-0" aria-hidden="true" />
              Back to receipts
            </button>

            <div className="flex flex-wrap gap-2">
              {canWrite && (
                <button type="button" disabled={!buildReceiptPDF} onClick={shareReceipt} className={`${receiptAction} border-transparent bg-toloba text-white enabled:hover:bg-toloba-dark`}>
                  <MessageCircle size={16} className="shrink-0" aria-hidden="true" />
                  Share PDF via WhatsApp
                </button>
              )}
              <button type="button" disabled={!buildReceiptPDF} onClick={() => buildReceiptPDF(selectedReceipt).save(`${selectedReceipt.receipt_no}.pdf`)} className={secondaryReceiptAction}>
                <Download size={16} className="shrink-0" aria-hidden="true" />
                Download PDF
              </button>
              <button type="button" onClick={() => window.print()} className={secondaryReceiptAction}>
                <Printer size={16} className="shrink-0" aria-hidden="true" />
                Print
              </button>
            </div>
          </div>

          {pdfError && <p role="alert" className="no-print text-sm text-red-700">{pdfError}</p>}
          {/* Printable Container */}
          <div id="printable-receipt" className="bg-white border border-slate-200 shadow-2xl rounded-xl relative overflow-hidden" style={{fontFamily: "'Inter', sans-serif"}}>
            
            {/* Header Banner */}
            <div className="bg-toloba px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between text-white">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-lg flex-shrink-0 border border-white/20 bg-white p-1">
                  <img src="/TolobaLogoAnand-transparent.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-xl font-extrabold tracking-wide">TOLOBA UL KULLIYAAT IL MUMINOON</h1>
                  <p className="text-white/70 text-[10px] sm:text-xs font-medium mt-0.5">Anand Treasury Committee</p>
                </div>
              </div>
            </div>

            {/* Meta Row */}
            <div className="px-4 sm:px-8 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs">
              <div className="flex gap-4 sm:gap-6 flex-wrap">
                <p className="text-slate-600">Receipt No: <span className="font-bold text-toloba-dark text-xs sm:text-sm">{selectedReceipt.receipt_no}</span></p>
                <p className="text-slate-600">Date: <span className="font-bold text-slate-800">{formatTreasuryDate(receiptDate(selectedReceipt))}</span></p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedReceipt.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                {selectedReceipt.status === 'void' ? 'VOIDED' : 'OFFICIAL RECEIPT'}
              </span>
            </div>

            {/* Receipt Body */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 relative z-10">
              
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

export default memo(ReceiptsManager);
