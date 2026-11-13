import { PAGE_SIZE } from '../../lib/useVisibleRows';

export function ShowMoreRows({ remaining, onClick }) {
  if (!remaining) return null;
  return (
    <div className="flex justify-center py-3">
      <button type="button" onClick={onClick}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} remaining)
      </button>
    </div>
  );
}
