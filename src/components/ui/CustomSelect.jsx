import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({ value, onChange, options, className = 'input-field' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0];

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        className={`${className} flex justify-between items-center text-left cursor-pointer`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="block truncate">{selectedOption?.label || 'Select...'}</span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto py-1">
          {options.map((option, idx) => (
            <button
              key={idx}
              type="button"
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 hover:text-toloba transition-colors ${
                String(option.value) === String(value) ? 'bg-toloba/5 text-toloba font-semibold' : 'text-slate-700'
              }`}
              onClick={() => {
                onChange({ target: { value: option.value } });
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
