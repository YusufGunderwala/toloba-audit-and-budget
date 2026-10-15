import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export default function CustomSelect({ 
  value, 
  onChange, 
  options = [], 
  className = 'input-field',
  placeholder = 'Select...',
  searchable = undefined
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options to array of { value, label }
  const normalizedOptions = options.map(opt => 
    typeof opt === 'object' && opt !== null 
      ? opt 
      : { value: opt, label: String(opt) }
  );

  const selectedOption = normalizedOptions.find(o => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || 'Select...');

  // Auto-enable search bar for lists with more than 8 options
  const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length > 8;

  // Filter options based on search query
  const filteredOptions = isSearchable && searchQuery.trim()
    ? normalizedOptions.filter(o => 
        String(o.label).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(o.value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : normalizedOptions;

  // Click & Touch outside + Escape key handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      if (isSearchable) {
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSearchable]);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        className={`${className} flex justify-between items-center text-left cursor-pointer transition-all duration-150 select-none active:scale-[0.99]`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setSearchQuery('');
        }}
      >
        <span className={`block truncate ${!selectedOption && placeholder ? 'text-slate-400 font-normal' : ''}`}>
          {displayLabel}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180 text-toloba' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full min-w-[170px] mt-1.5 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/15 py-1.5 px-1 max-h-64 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
          
          {/* Quick Search Header if > 8 options */}
          {isSearchable && (
            <div className="p-1 pb-1.5 border-b border-slate-100 flex items-center gap-1.5 px-2">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder-slate-400 font-medium"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto max-h-52 custom-scrollbar py-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-center text-slate-400 font-medium">
                No matching options
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-between group active:scale-[0.98] ${
                      isSelected
                        ? 'bg-toloba text-white shadow-xs font-bold'
                        : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
                    }`}
                    onClick={() => {
                      onChange({ target: { value: option.value } });
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check size={14} className="shrink-0 ml-2 text-emerald-200 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
