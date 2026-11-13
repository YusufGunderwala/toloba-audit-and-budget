import { ShowMoreRows } from '../ui/ShowMoreRows';
import { useVisibleRows } from '../../lib/useVisibleRows';
import { useMemo, useState, memo } from 'react';
import toast from 'react-hot-toast';
import { Check, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatTreasuryDate, treasuryDate } from '../../lib/treasuryDates';
import { exportToExcel } from '../../lib/exportUtils';

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
const emptyForm = () => ({ source: '', description: '', amount: '', received_on: treasuryDate(), payment_mode: 'Cash', reference: '' });
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const button = 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toloba disabled:cursor-not-allowed disabled:opacity-50 sm:px-4';
const primary = `${button} border-transparent bg-toloba text-white enabled:hover:bg-toloba-dark`;
const secondary = `${button} border-slate-300 bg-white text-slate-700 enabled:hover:border-slate-400 enabled:hover:bg-slate-50`;
const headings = ['Date received', 'Source', 'Purpose', 'Payment', 'Amount'];

function IncomeManager({ income, canWrite, onRefresh, searchTerm }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const term = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    return term ? income.filter(entry => [entry.source, entry.description, entry.payment_mode, entry.reference]
      .some(value => value?.toLowerCase().includes(term))) : income;
  }, [income, term]);
  const { visibleRows, showMore, remaining } = useVisibleRows(filtered);

  const total = filtered.reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0) / 100;

  const field = name => ({
    value: form[name],
    onChange: event => setForm({ ...form, [name]: event.target.value })
  });

  const saveIncome = async event => {
    event.preventDefault();
    if (saving || !canWrite) return;
    if (!form.source.trim() || !form.description.trim() || !form.received_on || form.received_on > treasuryDate()) {
      toast.error('Enter a source, purpose, and a date through today.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('income').insert({
        ...form, source: form.source.trim(), description: form.description.trim(), reference: form.reference.trim() || null
      });
      if (error) throw error;
      setForm(null);
      toast.success('Income recorded.');
      await onRefresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const exportIncome = () => exportToExcel(filtered.map(entry => ({
    Date: formatTreasuryDate(entry.received_on), Source: entry.source, Purpose: entry.description,
    'Amount (INR)': Number(entry.amount), 'Payment mode': entry.payment_mode, Reference: entry.reference || ''
  })), 'Toloba_Income');

  const deleteIncome = async entry => {
    if (!canWrite || deletingId) return;
    if (!window.confirm(`Delete the ${rupees.format(entry.amount)} income entry from ${entry.source} dated ${formatTreasuryDate(entry.received_on)}? This permanently removes it from income totals.`)) return;

    setDeletingId(entry.id);
    try {
      const { error } = await supabase.from('income').delete().eq('id', entry.id).select('id').single();
      if (error) throw error;
      await onRefresh();
      toast.success('Income entry deleted.');
    } catch (error) {
      toast.error(`Could not delete income. ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-medium text-slate-600">{term ? 'Matching income' : 'Total Toloba income'}</p>
          <p className="mt-1 text-3xl font-bold leading-tight tabular-nums text-toloba-dark">{rupees.format(total)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary} disabled={!filtered.length} onClick={exportIncome}>
            <FileSpreadsheet size={16} className="shrink-0" aria-hidden="true" />
            Export
          </button>
          {canWrite && !form && (
            <button type="button" className={primary} onClick={() => setForm(emptyForm())}>
              <Plus size={16} className="shrink-0" aria-hidden="true" />
              Record income
            </button>
          )}
        </div>
      </div>
      {canWrite && form && (
        <form onSubmit={saveIncome} aria-labelledby="income-form-title" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
          <h2 id="income-form-title" className="text-base font-bold text-slate-900 sm:col-span-2">Record income</h2>
          <label className="text-sm font-semibold">Received from
            <input className="input-field mt-1" required maxLength={255} placeholder="Person or organization" {...field('source')} />
          </label>
          <label className="text-sm font-semibold">Purpose
            <input className="input-field mt-1" required maxLength={255} placeholder="Donation, sponsorship, or other income" {...field('description')} />
          </label>
          <label className="text-sm font-semibold">Amount (₹)
            <input className="input-field mt-1" required type="number" min="0.01" max="9999999999.99" step="0.01" {...field('amount')} />
          </label>
          <label className="text-sm font-semibold">Date received
            <input className="input-field mt-1" required type="date" max={treasuryDate()} {...field('received_on')} />
          </label>
          <label className="text-sm font-semibold">Payment mode
            <select className="input-field mt-1" {...field('payment_mode')}>
              {PAYMENT_MODES.map(mode => <option key={mode}>{mode}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Transaction reference (optional)
            <input className="input-field mt-1" maxLength={100} {...field('reference')} />
          </label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
            <button type="button" className={secondary} disabled={saving} onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" className={primary} disabled={saving}>
              {!saving && <Check size={16} className="shrink-0" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save income'}
            </button>
          </div>
        </form>
      )}
      {!filtered.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800">{term ? 'No matching income records' : 'No income recorded yet'}</p>
          {(term || (canWrite && !form)) && (
            <p className="mt-1 text-sm text-slate-600">
              {term ? 'Try a different source, purpose, or payment reference.' : 'Select Record income to add the first entry.'}
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" role="region" aria-label="Income records" tabIndex={0}>
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                {headings.map(label => (
                  <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 font-semibold sm:px-6 ${label === 'Amount' ? 'text-right' : ''}`}>{label}</th>
                ))}
                {canWrite && <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-6">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(entry => (
                <tr key={entry.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600 sm:px-6">{formatTreasuryDate(entry.received_on)}</td>
                  <td className="break-words px-4 py-3.5 font-semibold sm:px-6">{entry.source}</td>
                  <td className="break-words px-4 py-3.5 text-slate-700 sm:px-6">{entry.description}</td>
                  <td className="break-words px-4 py-3.5 sm:px-6">{entry.payment_mode}{entry.reference && <small className="mt-0.5 block text-slate-600">{entry.reference}</small>}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-toloba-dark sm:px-6">{rupees.format(entry.amount)}</td>
                  {canWrite && (
                    <td className="px-4 py-2 text-right sm:px-6">
                      <button type="button" className={`${button} border-transparent text-rose-700 enabled:hover:bg-rose-50`}
                        disabled={deletingId !== null} onClick={() => deleteIncome(entry)}>
                        <Trash2 size={16} aria-hidden="true" />
                        {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ShowMoreRows remaining={remaining} onClick={showMore} />
    </section>
  );
}

export default memo(IncomeManager);
