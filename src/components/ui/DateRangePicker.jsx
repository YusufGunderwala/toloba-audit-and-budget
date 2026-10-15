import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateRangePicker({ startDate, endDate, onDateChange }) {
  const [activePicker, setActivePicker] = useState(null); // 'start' | 'end' | null
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const containerRef = useRef(null);

  // Set current view to selected date when opening picker
  useEffect(() => {
    if (activePicker === 'start' && startDate) {
      const [y, m] = startDate.split('-').map(Number);
      setCurrentViewDate(new Date(y, m - 1, 1));
    } else if (activePicker === 'end' && endDate) {
      const [y, m] = endDate.split('-').map(Number);
      setCurrentViewDate(new Date(y, m - 1, 1));
    } else {
      setCurrentViewDate(new Date());
    }
  }, [activePicker, startDate, endDate]);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActivePicker(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActivePicker(null);
    };

    if (activePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePicker]);

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Quick Preset Actions
  const handlePreset = (type) => {
    const today = new Date();
    if (type === 'today') {
      const iso = toISODate(today);
      onDateChange({ startDate: iso, endDate: iso });
    } else if (type === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const iso = toISODate(yest);
      onDateChange({ startDate: iso, endDate: iso });
    } else if (type === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      onDateChange({ startDate: toISODate(start), endDate: toISODate(today) });
    } else if (type === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      onDateChange({ startDate: toISODate(start), endDate: toISODate(end) });
    } else if (type === 'last_30_days') {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      onDateChange({ startDate: toISODate(start), endDate: toISODate(today) });
    }
    setActivePicker(null);
  };

  // Calendar calculations
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCurrentViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCurrentViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day) => {
    const selected = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (activePicker === 'start') {
      if (endDate && selected > endDate) {
        onDateChange({ startDate: selected, endDate: selected });
      } else {
        onDateChange({ startDate: selected, endDate });
      }
      setActivePicker('end'); // Smoothly switch to selecting end date!
    } else if (activePicker === 'end') {
      if (startDate && selected < startDate) {
        onDateChange({ startDate: selected, endDate: selected });
      } else {
        onDateChange({ startDate, endDate: selected });
      }
      setActivePicker(null); // Finish selection!
    }
  };

  const todayISO = toISODate(new Date());

  return (
    <div className="relative w-full space-y-2.5" ref={containerRef}>
      
      {/* Quick Presets Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <span className="text-[10px] font-bold text-toloba-dark uppercase tracking-wider shrink-0 mr-1">
          Presets:
        </span>
        {[
          { id: 'today', label: 'Today' },
          { id: 'this_month', label: 'This Month' },
          { id: 'last_month', label: 'Last Month' },
          { id: 'last_30_days', label: 'Last 30 Days' },
        ].map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePreset(p.id)}
            className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-toloba border border-emerald-200/80 rounded-lg text-[11px] font-bold text-slate-700 transition-all shadow-2xs whitespace-nowrap active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Symmetrical Date Cards (From & To) */}
      <div className="grid grid-cols-2 gap-2 relative">
        
        {/* FROM CARD */}
        <button
          type="button"
          onClick={() => setActivePicker(activePicker === 'start' ? null : 'start')}
          className={`text-left p-2.5 bg-white border rounded-xl transition-all shadow-xs relative active:scale-[0.99] flex flex-col justify-between ${
            activePicker === 'start' 
              ? 'border-toloba ring-2 ring-toloba/20 shadow-sm' 
              : 'border-emerald-200/90 hover:border-toloba'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-toloba-dark uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-toloba" />
              <span>From Date</span>
            </span>
            {startDate && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  onDateChange({ startDate: '', endDate });
                }}
                className="hover:text-rose-600 p-0.5 rounded"
                title="Clear From date"
              >
                <X size={11} />
              </span>
            )}
          </div>
          <div className="text-xs sm:text-sm font-extrabold truncate text-slate-800">
            {startDate ? formatDateDisplay(startDate) : (
              <span className="text-slate-400 font-semibold text-xs">Start Date...</span>
            )}
          </div>
        </button>

        {/* TO CARD */}
        <button
          type="button"
          onClick={() => setActivePicker(activePicker === 'end' ? null : 'end')}
          className={`text-left p-2.5 bg-white border rounded-xl transition-all shadow-xs relative active:scale-[0.99] flex flex-col justify-between ${
            activePicker === 'end' 
              ? 'border-toloba ring-2 ring-toloba/20 shadow-sm' 
              : 'border-emerald-200/90 hover:border-toloba'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-toloba-dark uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-toloba" />
              <span>To Date</span>
            </span>
            {endDate && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  onDateChange({ startDate, endDate: '' });
                }}
                className="hover:text-rose-600 p-0.5 rounded"
                title="Clear To date"
              >
                <X size={11} />
              </span>
            )}
          </div>
          <div className="text-xs sm:text-sm font-extrabold truncate text-slate-800">
            {endDate ? formatDateDisplay(endDate) : (
              <span className="text-slate-400 font-semibold text-xs">Today (End)...</span>
            )}
          </div>
        </button>
      </div>

      {/* Floating Interactive Calendar Popover */}
      {activePicker && (
        <div className="absolute top-full left-0 right-0 sm:left-auto sm:w-80 mt-2 z-50 bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/20 p-3.5 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header: Month / Year with Navigation */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors active:scale-95"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="text-center">
              <span className="font-extrabold text-sm text-slate-800 tracking-tight">
                {MONTH_NAMES[month]} {year}
              </span>
              <span className="block text-[10px] font-bold text-toloba uppercase tracking-wider">
                Selecting {activePicker === 'start' ? 'Start Date' : 'End Date'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors active:scale-95"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map(d => (
              <span key={d} className="text-[10px] font-bold text-slate-400 py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 w-8" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelectedStart = startDate === dateISO;
              const isSelectedEnd = endDate === dateISO;
              const isSelected = isSelectedStart || isSelectedEnd;
              const inRange = startDate && endDate && dateISO > startDate && dateISO < endDate;
              const isToday = dateISO === todayISO;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto rounded-xl text-xs font-bold transition-all flex items-center justify-center active:scale-90 ${
                    isSelected
                      ? 'bg-toloba text-white shadow-md shadow-emerald-950/25 scale-105'
                      : inRange
                        ? 'bg-emerald-100/70 text-toloba-dark font-extrabold rounded-none first-of-type:rounded-l-xl last-of-type:rounded-r-xl'
                        : isToday
                          ? 'border border-toloba text-toloba font-extrabold hover:bg-emerald-50'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Popover Footer Shortcuts */}
          <div className="flex items-center justify-between pt-3 mt-2.5 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => {
                if (activePicker === 'start') onDateChange({ startDate: todayISO, endDate });
                else onDateChange({ startDate, endDate: todayISO });
                setActivePicker(null);
              }}
              className="text-[11px] font-bold text-toloba hover:underline"
            >
              Set Today
            </button>

            <button
              type="button"
              onClick={() => setActivePicker(null)}
              className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all active:scale-95"
            >
              Done
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
