import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users, 
  Download, 
  PlusCircle, 
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  CalendarCheck,
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { exportToExcel } from '../../lib/exportUtils';

const COLORS = ['#105c38', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

export default function DashboardOverview({ receipts = [], expenses = [], members = [], events = [], invoices = [], setActiveTab, canWrite }) {
  // Financial Calculations
  const totalIncome = receipts.filter(r => r.status !== 'void').reduce((acc, r) => acc + parseFloat(r.amount || 0), 0);
  const totalExpense = expenses.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0);
  const netSurplus = totalIncome - totalExpense;

  const cashIncome = receipts.filter(r => r.payment_mode === 'Cash' && r.status !== 'void').reduce((acc, r) => acc + parseFloat(r.amount || 0), 0);
  const upiIncome = receipts.filter(r => r.payment_mode === 'UPI' && r.status !== 'void').reduce((acc, r) => acc + parseFloat(r.amount || 0), 0);

  // Invoices & Receivables
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue');
  const totalPendingReceivables = unpaidInvoices.reduce((acc, i) => acc + parseFloat(i.amount || 0), 0);

  // Group receipts by month for Area/Bar Chart
  const monthlyDataMap = {};
  
  // Initialize last 6 months to ensure chart looks good even if empty
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mStr = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    monthlyDataMap[mStr] = { month: mStr, Income: 0, Expense: 0 };
  }

  receipts.filter(r => r.status !== 'void').forEach(r => {
    const date = new Date(r.created_at);
    const month = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    if (!monthlyDataMap[month]) monthlyDataMap[month] = { month, Income: 0, Expense: 0 };
    monthlyDataMap[month].Income += parseFloat(r.amount || 0);
  });

  expenses.forEach(e => {
    const date = new Date(e.created_at);
    const month = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    if (!monthlyDataMap[month]) monthlyDataMap[month] = { month, Income: 0, Expense: 0 };
    monthlyDataMap[month].Expense += parseFloat(e.amount || 0);
  });

  const chartData = Object.values(monthlyDataMap).slice(-6);

  // Expense Category Pie Chart Data
  const categoryMap = {};
  expenses.forEach(e => {
    const cat = e.category || 'Miscellaneous';
    categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(e.amount || 0);
  });

  const pieData = Object.keys(categoryMap).map(key => ({
    name: key,
    value: categoryMap[key]
  })).sort((a, b) => b.value - a.value);

  // Activity Feed (Merge receipts and expenses)
  const combinedActivity = [
    ...receipts.filter(r => r.status !== 'void').map(r => ({
      ...r, type: 'income', date: new Date(r.created_at), title: r.members?.name || 'Member', ref: r.receipt_no
    })),
    ...expenses.map(e => ({
      ...e, type: 'expense', date: new Date(e.created_at), title: e.vendor_name || 'Vendor', ref: e.voucher_no || 'EXP'
    }))
  ].sort((a, b) => b.date - a.date).slice(0, 8);


  const handleExportFullLedger = () => {
    const ledgerData = receipts.map(r => ({
      'Receipt No': r.receipt_no,
      'Member Name': r.members?.name || 'N/A',
      'ITS Number': r.members?.its_number || 'N/A',
      'Type': 'Income (Receipt)',
      'Amount (₹)': r.amount,
      'Mode': r.payment_mode,
      'Transaction / UTR': r.transaction_id || 'N/A',
      'Period': `${r.period_month} ${r.period_year}`,
      'Date': new Date(r.created_at).toLocaleDateString('en-GB')
    }));

    expenses.forEach(e => {
      ledgerData.push({
        'Receipt No': e.voucher_no || 'EXPENSE',
        'Member Name': e.vendor_name || 'Vendor',
        'ITS Number': 'N/A',
        'Type': `Expense (${e.category})`,
        'Amount (₹)': -e.amount,
        'Mode': e.payment_mode,
        'Transaction / UTR': 'N/A',
        'Period': 'N/A',
        'Date': new Date(e.created_at).toLocaleDateString('en-GB')
      });
    });

    exportToExcel(ledgerData, 'Toloba_General_Ledger');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* ===== METRIC CARDS ROW 1 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Total Income */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Revenue</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-2">₹{totalIncome.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 border-t border-slate-100 pt-3">
            <span className="text-emerald-600 font-bold">Cash: ₹{cashIncome.toLocaleString('en-IN')}</span>
            <span>•</span>
            <span className="text-blue-600 font-bold">UPI: ₹{upiIncome.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-red-200 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Total Outflow</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-2">₹{totalExpense.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span>{expenses.length} Vouchers Logged</span>
          </div>
        </div>

        {/* Net Surplus / Balance */}
        <div className="bg-white p-6 rounded-2xl border border-toloba/30 bg-gradient-to-br from-white to-emerald-50/50 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold uppercase text-toloba-dark tracking-wider">Net Fund Surplus</p>
              <h3 className="text-2xl font-extrabold text-toloba-dark mt-2">₹{netSurplus.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-10 h-10 bg-toloba rounded-xl flex items-center justify-center text-white shadow-lg shadow-toloba/30 group-hover:rotate-12 transition-transform">
              <Wallet size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-[11px] text-toloba font-bold border-t border-toloba/10 pt-3">
            <span className="uppercase tracking-wider">Treasury Status: {netSurplus >= 0 ? 'Healthy' : 'Deficit'}</span>
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Pending Receivables</p>
              <h3 className="text-2xl font-extrabold text-amber-600 mt-2">₹{totalPendingReceivables.toLocaleString('en-IN')}</h3>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-slate-500 border-t border-slate-100 pt-3">
            <span className="text-amber-600 uppercase tracking-wider">{unpaidInvoices.length} Unpaid Invoices</span>
            {unpaidInvoices.length > 0 && <AlertCircle size={14} className="text-amber-500" />}
          </div>
        </div>

      </div>

      {/* ===== ACTION BAR ===== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quick Actions:</span>
          {canWrite && (
            <>
              <button onClick={() => setActiveTab('receipts')} className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 rounded-xl shadow-md">
                <PlusCircle size={14} /> Collect Fee
              </button>
              <button onClick={() => setActiveTab('expenses')} className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md">
                <TrendingDown size={14} /> Log Expense
              </button>
              <button onClick={() => setActiveTab('events')} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md">
                <CalendarCheck size={14} /> Budget Event
              </button>
            </>
          )}
        </div>

        <button 
          onClick={handleExportFullLedger}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
        >
          <FileSpreadsheet size={16} /> Export Full Ledger (.xlsx)
        </button>
      </div>

      {/* ===== CHARTS ROW ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Revenue vs Outflow Trend</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#105c38" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#105c38" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="Income" stroke="#105c38" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="Expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Categories Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Outflow Distribution</h3>
          {pieData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">
              No expenses recorded yet.
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Amount']} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center" 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* ===== RECENT TRANSACTIONS TABLE ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Recent Treasury Activity</h3>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Latest income collections & committee expenses</p>
          </div>
          <button onClick={() => setActiveTab('audit')} className="text-toloba hover:underline text-xs font-bold bg-toloba/10 px-3 py-1.5 rounded-lg transition-colors hover:bg-toloba/20">
            View Full Audit Trail →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                <th className="py-4 px-6 font-bold">Ref No</th>
                <th className="py-4 px-6 font-bold">Party / Member</th>
                <th className="py-4 px-6 font-bold">Type</th>
                <th className="py-4 px-6 font-bold">Amount</th>
                <th className="py-4 px-6 font-bold">Mode</th>
                <th className="py-4 px-6 font-bold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {combinedActivity.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-sm">No recent activity found.</td>
                </tr>
              ) : (
                combinedActivity.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3.5 px-6 font-bold text-slate-600 font-mono text-xs">{item.ref}</td>
                    <td className="py-3.5 px-6">
                      <p className="font-bold text-slate-800">{item.title}</p>
                      {item.type === 'income' && <p className="text-[10px] text-slate-400 font-mono mt-0.5">ITS: {item.members?.its_number || '---'}</p>}
                      {item.type === 'expense' && <p className="text-[10px] text-slate-400 uppercase mt-0.5">{item.category}</p>}
                    </td>
                    <td className="py-3.5 px-6">
                      {item.type === 'income' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                          <ArrowUpRight size={12} /> Income
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                          <ArrowDownRight size={12} /> Expense
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 font-extrabold text-slate-800">₹{parseFloat(item.amount).toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-6">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-extrabold border ${
                        item.payment_mode === 'Cash' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {item.payment_mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 text-xs font-medium">{item.date.toLocaleDateString('en-GB')}</td>
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
