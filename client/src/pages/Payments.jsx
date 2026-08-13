import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { peso, formatDate } from '../utils/format';

const emptyForm = { retailer_id: '', amount: '', payment_method: 'cash', payment_date: '', notes: '' };

export default function Payments() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', method: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () =>
      api.get('/api/payments', {
        params: {
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          method: filters.method || undefined,
        },
      }).then((r) => r.data),
  });

  const { data: retailers } = useQuery({
    queryKey: ['retailers-all'],
    queryFn: () => api.get('/api/retailers').then((r) => r.data),
    enabled: showForm,
  });

  const createMutation = useMutation({
    mutationFn: (formData) => api.post('/api/payments', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['retailers'] });
      setShowForm(false);
      setForm(emptyForm);
      setFile(null);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to record payment'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => v && data.append(k, v));
    if (file) data.append('proof_image', file);
    createMutation.mutate(data);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Collections</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {showForm ? 'Cancel' : '+ Record Payment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 md:col-span-2">{error}</div>}
          <select required value={form.retailer_id} onChange={(e) => setForm({ ...form, retailer_id: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select retailer...</option>
            {retailers?.map((r) => <option key={r.id} value={r.id}>{r.business_name} (Bal: {peso(r.current_balance)})</option>)}
          </select>
          <input type="number" step="0.01" required placeholder="Amount" value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
          <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">Proof of payment (screenshot)</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={createMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:col-span-2 disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Record Payment'}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All methods</option>
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Proof</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {payments?.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No payments recorded.</td></tr>}
            {payments?.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">{formatDate(p.payment_date)}</td>
                <td className="px-4 py-2 font-medium text-slate-700">{p.retailer_name}</td>
                <td className="px-4 py-2 font-medium text-emerald-600">{peso(p.amount)}</td>
                <td className="px-4 py-2 capitalize text-slate-600">{p.payment_method.replace('_', ' ')}</td>
                <td className="px-4 py-2 text-slate-500">{p.agent_name}</td>
                <td className="px-4 py-2">
                  {p.proof_image_url ? (
                    <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${p.proof_image_url}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      View
                    </a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
