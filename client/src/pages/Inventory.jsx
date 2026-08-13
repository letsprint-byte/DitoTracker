import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';

export default function Inventory() {
  const { user, isAdmin } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState(isAdmin ? '' : user.id);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ product_id: '', to_id: '', quantity: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: main } = useQuery({
    queryKey: ['inventory-main'],
    queryFn: () => api.get('/api/inventory/main').then((r) => r.data),
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/api/users').then((r) => r.data.filter((u) => u.role === 'agent')),
    enabled: isAdmin,
  });

  const { data: agentStock } = useQuery({
    queryKey: ['inventory-agent', selectedAgent],
    queryFn: () => api.get(`/api/inventory/agent/${selectedAgent}`).then((r) => r.data),
    enabled: !!selectedAgent,
  });

  const { data: transfers } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => api.get('/api/inventory/transfers').then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
    enabled: showForm,
  });

  const transferMutation = useMutation({
    mutationFn: (payload) => api.post('/api/inventory/transfer', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-main'] });
      qc.invalidateQueries({ queryKey: ['inventory-agent'] });
      qc.invalidateQueries({ queryKey: ['transfers'] });
      setShowForm(false);
      setForm({ product_id: '', to_id: '', quantity: '' });
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Transfer failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    transferMutation.mutate({
      product_id: form.product_id,
      from_type: 'main',
      from_id: 0,
      to_type: 'agent',
      to_id: form.to_id,
      quantity: Number(form.quantity),
    });
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Inventory</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Main (HQ) Stock</h2>
            {isAdmin && (
              <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                {showForm ? 'Cancel' : '+ Transfer to Agent'}
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-4 grid gap-2 rounded-lg border border-slate-100 p-3">
              {error && <div className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">{error}</div>}
              <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">Product...</option>
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select required value={form.to_id} onChange={(e) => setForm({ ...form, to_id: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                <option value="">Agent...</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="number" min="1" required placeholder="Quantity" value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              <button type="submit" disabled={transferMutation.isPending}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
              </button>
            </form>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">Qty on hand</th>
              </tr>
            </thead>
            <tbody>
              {main?.map((m) => (
                <tr key={m.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{m.product_name}</td>
                  <td className={`py-2 font-medium ${m.quantity_on_hand <= m.low_stock_threshold ? 'text-amber-600' : 'text-slate-800'}`}>
                    {m.quantity_on_hand}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Agent Stock</h2>
            {isAdmin && (
              <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                <option value="">Select agent...</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">Qty on hand</th>
              </tr>
            </thead>
            <tbody>
              {(!agentStock || agentStock.length === 0) && (
                <tr><td colSpan={2} className="py-4 text-center text-slate-400">No stock records.</td></tr>
              )}
              {agentStock?.map((s) => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{s.product_name}</td>
                  <td className="py-2 font-medium text-slate-800">{s.quantity_on_hand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-700">Stock Movement Log</h2>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="pb-2">Date</th>
                <th className="pb-2">Product</th>
                <th className="pb-2">From</th>
                <th className="pb-2">To</th>
                <th className="pb-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {transfers?.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-500">{formatDate(t.transferred_at)}</td>
                  <td className="py-2 text-slate-700">{t.product_name}</td>
                  <td className="py-2 text-slate-500 capitalize">{t.from_type}</td>
                  <td className="py-2 text-slate-500 capitalize">{t.to_type} #{t.to_id}</td>
                  <td className="py-2 font-medium text-slate-800">{t.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
