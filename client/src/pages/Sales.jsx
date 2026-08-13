import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { peso, formatDate } from '../utils/format';

const emptyForm = { retailer_id: '', product_id: '', quantity: 1, unit_price: '', sale_date: '', payment_status: 'unpaid' };

export default function Sales() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', payment_status: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', filters],
    queryFn: () =>
      api.get('/api/sales', {
        params: {
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          payment_status: filters.payment_status || undefined,
        },
      }).then((r) => r.data),
  });

  const { data: retailers } = useQuery({
    queryKey: ['retailers-all'],
    queryFn: () => api.get('/api/retailers').then((r) => r.data),
    enabled: showForm,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
    enabled: showForm,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/sales', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      setShowForm(false);
      setForm(emptyForm);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to record sale'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      quantity: Number(form.quantity),
      unit_price: form.unit_price ? Number(form.unit_price) : undefined,
      sale_date: form.sale_date || undefined,
    });
  };

  const selectedProduct = products?.find((p) => String(p.id) === String(form.product_id));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Sales</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {showForm ? 'Cancel' : '+ Record Sale'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 md:col-span-2">{error}</div>}
          <select required value={form.retailer_id} onChange={(e) => setForm({ ...form, retailer_id: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select retailer...</option>
            {retailers?.map((r) => <option key={r.id} value={r.id}>{r.business_name}</option>)}
          </select>
          <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select product...</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({peso(p.unit_price)})</option>)}
          </select>
          <input type="number" min="1" required value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Quantity" />
          <input type="number" step="0.01" value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            placeholder={selectedProduct ? `Unit price (default ${peso(selectedProduct.unit_price)})` : 'Unit price'}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
          <button type="submit" disabled={createMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:col-span-2 disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Record Sale'}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={filters.payment_status} onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All payment statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {sales?.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No sales recorded.</td></tr>}
            {sales?.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">{formatDate(s.sale_date)}</td>
                <td className="px-4 py-2 font-medium text-slate-700">{s.retailer_name}</td>
                <td className="px-4 py-2 text-slate-600">{s.product_name}</td>
                <td className="px-4 py-2">{s.quantity}</td>
                <td className="px-4 py-2 font-medium">{peso(s.total_amount)}</td>
                <td className="px-4 py-2 text-slate-500">{s.agent_name}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    s.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                    s.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {s.payment_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
