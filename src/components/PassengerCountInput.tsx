import React, { useEffect, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';

interface PassengerCountInputProps {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export const PassengerCountInput: React.FC<PassengerCountInputProps> = ({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 55,
  className = '',
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const [draft, setDraft] = useState<string>(String(clamp(value || min)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(clamp(value || min)));
    }
  }, [value, focused, min, max]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    if (digits === '') {
      setDraft('');
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    if (Number.isNaN(parsed)) {
      setDraft('');
      return;
    }
    if (parsed > max) {
      setDraft(String(max));
      onChange(max);
      return;
    }
    setDraft(digits);
    if (parsed >= min) {
      onChange(parsed);
    }
  };

  const commitDraft = () => {
    setFocused(false);
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? min : clamp(parsed);
    setDraft(String(next));
    onChange(next);
  };

  const step = (delta: number) => {
    const current = Number.parseInt(draft, 10);
    const base = Number.isNaN(current) ? value : current;
    const next = clamp(base + delta);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
      </label>
      <div className="flex items-stretch w-full min-h-[44px] bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2563EB]/30 focus-within:border-[#2563EB] transition-colors">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label="Decrease passengers"
          className="w-10 shrink-0 flex items-center justify-center text-[#102A43] hover:bg-[#F5F7FA] disabled:text-slate-300 disabled:hover:bg-transparent border-r border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <div className="relative flex-1 flex items-center min-w-0">
          <Users className="w-3.5 h-3.5 text-slate-400 ml-2.5 shrink-0 pointer-events-none" />
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={label}
            value={draft}
            onFocus={(e) => {
              setFocused(true);
              e.target.select();
            }}
            onChange={handleInputChange}
            onBlur={commitDraft}
            className="w-full px-2 py-2 text-sm font-medium text-center text-[#102A43] bg-transparent focus:outline-none tabular-nums"
          />
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label="Increase passengers"
          className="w-10 shrink-0 flex items-center justify-center text-[#102A43] hover:bg-[#F5F7FA] disabled:text-slate-300 disabled:hover:bg-transparent border-l border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
