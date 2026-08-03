import toast from 'react-hot-toast';
import React, { useState, useMemo } from 'react';
import CustomSelect from '../ui/CustomSelect';
import { 
  CalendarDays, 
  PlusCircle, 
  IndianRupee, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  PieChart as PieChartIcon, 
  TrendingDown, 
  BarChart2, 
  X, 
  FileSpreadsheet, 
  FileText 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';
import { logAuditEvent } from '../../lib/auditLogger';

export default function EventBudgetManager({ events, expenses, receipts, user, canWrite, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState({ show: false, event: null });
  const [selectedAnalyticsEvent, setSelectedAnalyticsEvent] = useState(null);

  const [formData, setFormData] = useState({
    eventName: '',
    budgetAmount: '',
    startDate: '',
    endDate: '',
    status: 'active',
    notes: ''
  });

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('events').insert([
        {
          event_name: formData.eventName,
          budget_amount: parseFloat(formData.budgetAmount),
          start_date: formData.startDate || null,
          end_date: formData.endDate || null,
          status: formData.status,
          notes: formData.notes || null
        }
      ]);

      if (error) throw error;

      await logAuditEvent(user, 'CREATE_EVENT', `Created event "${formData.eventName}" with budget ₹${formData.budgetAmount}`);
      toast.success("Event created successfully!");
      setFormData({ eventName: '', budgetAmount: '', startDate: '', endDate: '', status: 'active', notes: '' });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      toast.error("Error creating event: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = (event) => {
    setDeletePrompt({ show: true, event });
  };

  const confirmDeleteEvent = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.from('events').delete().eq('id', deletePrompt.event.id);
      if (error) throw error;

      await logAuditEvent(user, 'DELETE_EVENT', `Deleted event "${deletePrompt.event.event_name}"`);
      toast.success("Event deleted.");
      setDeletePrompt({ show: false, event: null });
      onRefresh();
    } catch (err) {
      toast.error("Error deleting event: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Event specific analytics calculation
  const eventAnalytics = useMemo(() => {
    const eventExpenses = selectedAnalyticsEvent
      ? expenses.filter(e => e.event_id === selectedAnalyticsEvent.id)
      : [];

    const eventSpentTotal = eventExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const eventBudget = selectedAnalyticsEvent ? parseFloat(selectedAnalyticsEvent.budget_amount || 0) : 0;
    const eventBalance = eventBudget - eventSpentTotal;

    const eventCategoryMap = {};
    eventExpenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      eventCategoryMap[cat] = (eventCategoryMap[cat] || 0) + parseFloat(e.amount || 0);
    });

    return { eventExpenses, eventSpentTotal, eventBudget, eventBalance, eventCategoryMap };
  }, [selectedAnalyticsEvent, expenses]);

  const { eventExpenses, eventSpentTotal, eventBudget, eventBalance, eventCategoryMap } = eventAnalytics;

  const exportEventExcel = () => {
    if (!selectedAnalyticsEvent) return;
    const data = eventExpenses.map(e => ({
      'Event Name': selectedAnalyticsEvent.event_name,
      'Title': e.title,
      'Category': e.category,
      'Amount (₹)': e.amount,
      'Payment Mode': e.payment_mode,
      'Vendor': e.vendor_name || 'N/A',
      'Voucher No': e.voucher_no || 'N/A',
      'Date': new Date(e.created_at).toLocaleDateString('en-GB')
    }));
    exportToExcel(data, `Event_Report_${selectedAnalyticsEvent.event_name.replace(/\s+/g, '_')}`);
  };

  const exportEventPDF = () => {
    if (!selectedAnalyticsEvent) return;
    const cols = ['Title', 'Category', 'Amount (₹)', 'Mode', 'Vendor', 'Date'];
    const rows = eventExpenses.map(e => [
      e.title,
      e.category,
      `₹${parseFloat(e.amount).toLocaleString('en-IN')}`,
      e.payment_mode,
      e.vendor_name || '—',
      new Date(e.created_at).toLocaleDateString('en-GB')
    ]);
    exportToPDF(
      `Event Financial Report: ${selectedAnalyticsEvent.event_name} (Budget: ₹${eventBudget.toLocaleString('en-IN')})`,
      cols,
      rows,
      `Event_Statement_${selectedAnalyticsEvent.event_name.replace(/\s+/g, '_')}`
    );
  };

  const enrichedEvents = useMemo(() => {
    return events.map(ev => {
      const evExpenses = expenses.filter(e => e.event_id === ev.id);
      const actualSpent = evExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      const budget = parseFloat(ev.budget_amount || 0);
      
      let percentUsed = budget > 0 ? (actualSpent / budget) * 100 : 0;
      const isOver = actualSpent > budget;
      if (percentUsed > 100) percentUsed = 100;

      let barColor = 'bg-emerald-500';
      let textColor = 'text-emerald-700';
      
      if (isOver) {
        barColor = 'bg-red-500';
        textColor = 'text-red-700';
      } else if (percentUsed > 80) {
        barColor = 'bg-amber-500';
        textColor = 'text-amber-700';
      }

      return {
        ...ev,
        actualSpent,
        budget,
        percentUsed,
        barColor,
        textColor,
        isOver,
        evExpenses
      };
    });
  }, [events, expenses]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-col md:flex-row gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-base font-bold text-slate-800">Event Budgeting & Cost Control ({events.length})</h2>
          <p className="text-xs text-slate-400">Track allocated budget vs actual spending with event analytics</p>
        </div>

        {canWrite && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="btn-primary text-xs font-bold py-2 px-3.5 flex items-center justify-center gap-1.5 shadow w-full md:w-auto"
          >
            <PlusCircle size={16} /> {showForm ? 'Close Form' : 'Create New Event'}
          </button>
        )}
      </div>

      {/* ===== CREATE EVENT FORM ===== */}
      {showForm && canWrite && (
        <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-xl max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays size={20} className="text-blue-600" /> Create Event Budget
          </h3>

          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Event Name</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  placeholder="e.g. Ashara Mubaraka 1446" 
                  value={formData.eventName} 
                  onChange={e => setFormData({...formData, eventName: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Allocated Budget (₹)</label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    className="input-field pl-9 font-extrabold text-base" 
                    placeholder="50000" 
                    value={formData.budgetAmount} 
                    onChange={e => setFormData({...formData, budgetAmount: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Start Date</label>
                <input 
                  type="date" 
                  className="input-field text-xs" 
                  value={formData.startDate} 
                  onChange={e => setFormData({...formData, startDate: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">End Date</label>
                <input 
                  type="date" 
                  className="input-field text-xs" 
                  value={formData.endDate} 
                  onChange={e => setFormData({...formData, endDate: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Status</label>
                <CustomSelect 
                  className="input-field text-xs font-bold" 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  options={[
                    {value: 'active', label: 'Active'},
                    {value: 'upcoming', label: 'Upcoming'},
                    {value: 'completed', label: 'Completed'}
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Event Notes / Objectives</label>
              <input 
                type="text" 
                className="input-field text-xs" 
                placeholder="Details about food, venue, logistics budget..." 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 size={16} /> {loading ? 'Creating...' : 'Save Event Budget'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== EVENT BUDGET CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {enrichedEvents.length === 0 ? (
          <div className="md:col-span-2 bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            No events created yet. Click "Create New Event" above to start budgeting.
          </div>
        ) : (
          enrichedEvents.map(ev => {
            const { actualSpent, budget, percentUsed, barColor, textColor, isOver, evExpenses } = ev;

            return (
              <div key={ev.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative space-y-4">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{ev.event_name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ev.start_date ? new Date(ev.start_date).toLocaleDateString('en-GB') : 'No Date'} 
                      {ev.notes ? ` • ${ev.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      ev.status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {ev.status?.toUpperCase()}
                    </span>
                    {canWrite && (
                      <button onClick={() => handleDeleteEvent(ev)} className="text-slate-300 hover:text-red-500 p-1">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Numbers Row */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Allocated Budget</p>
                    <p className="text-xl font-extrabold text-slate-800 mt-0.5">₹{budget.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Actual Spent</p>
                    <p className={`text-xl font-extrabold mt-0.5 ${textColor}`}>₹{actualSpent.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                    <span className="text-slate-600">Budget Usage</span>
                    <span className={textColor}>
                      {percentUsed}% {isOver && <span className="inline-flex items-center gap-1"><AlertTriangle size={14} /> OVER BUDGET!</span>}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className={`${barColor} h-full transition-all duration-500 rounded-full`} style={{ width: `${Math.min(percentUsed, 100)}%` }}></div>
                  </div>
                </div>

                {/* Action Row */}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-500">{evExpenses.length} Expense Vouchers</span>
                  <button 
                    onClick={() => setSelectedAnalyticsEvent(ev)} 
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors border border-blue-200"
                  >
                    <BarChart2 size={14} /> View Event Analytics
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* ===== EVENT ANALYTICS MODAL / DRAWER ===== */}
      {selectedAnalyticsEvent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Event Financial Statement</span>
                <h3 className="text-2xl font-bold mt-1">{selectedAnalyticsEvent.event_name}</h3>
                <p className="text-xs text-slate-400 mt-1">Status: <span className="text-white font-bold">{selectedAnalyticsEvent.status?.toUpperCase()}</span></p>
              </div>
              <button onClick={() => setSelectedAnalyticsEvent(null)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-400 font-bold uppercase">Budget Limit</p>
                <p className="text-xl font-extrabold text-slate-900 mt-1">₹{eventBudget.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-400 font-bold uppercase">Total Spent</p>
                <p className="text-xl font-extrabold text-red-600 mt-1">₹{eventSpentTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-400 font-bold uppercase">Surplus / Deficit</p>
                <p className={`text-xl font-extrabold mt-1 ${eventBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  ₹{eventBalance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Export Buttons */}
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-200">
                <p className="text-xs font-bold text-blue-900">Export Event Financial Report</p>
                <div className="flex gap-2">
                  <button onClick={exportEventExcel} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={exportEventPDF} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                    <FileText size={14} /> PDF
                  </button>
                </div>
              </div>

              {/* Category Breakdown */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3">Spending Breakdown by Category</h4>
                <div className="space-y-2">
                  {Object.keys(eventCategoryMap).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No expenses recorded for this event yet.</p>
                  ) : (
                    Object.keys(eventCategoryMap).map(cat => {
                      const amount = eventCategoryMap[cat];
                      const pct = eventSpentTotal > 0 ? Math.round((amount / eventSpentTotal) * 100) : 0;
                      return (
                        <div key={cat} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">{cat} ({pct}%)</span>
                          <span className="font-extrabold text-slate-900">₹{amount.toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Expense Vouchers List */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3">All Tagged Expense Vouchers ({eventExpenses.length})</h4>
                <div className="space-y-2">
                  {eventExpenses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No vouchers found.</p>
                  ) : (
                    eventExpenses.map(e => (
                      <div key={e.id} className="bg-white p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs shadow-sm">
                        <div>
                          <p className="font-bold text-slate-800">{e.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Category: {e.category} • Vendor: {e.vendor_name || 'N/A'} • Mode: {e.payment_mode}
                          </p>
                        </div>
                        <p className="font-extrabold text-red-600 text-sm">₹{parseFloat(e.amount).toLocaleString('en-IN')}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ===== DELETE PROMPT MODAL ===== */}
      {deletePrompt.show && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Event?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete the event <span className="font-semibold">{deletePrompt.event?.event_name}</span>?
              <br/><br/>
              <span className="text-red-500 font-medium">Warning: This action cannot be undone.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeletePrompt({ show: false, event: null })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteEvent}
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
