import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { peso, formatDate } from '../utils/format';

const STATUSES = ['pending', 'approved', 'released', 'received', 'rejected'];
const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-50 text-blue-700',
  released: 'bg-amber-50 text-amber-700',
  received: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
};

export default function LoadRequests() {
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ requested_amount: '', product_id: '', quantity: 1, notes: '' });
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['load-requests'],
    queryFn: () => api.get('/api/load-requests').then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
    enabled: showForm,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/load-requests', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['load-requests'] });
      setShowForm(false);
      setForm({ requested_amount: '', product_id: '', quantity: 1, notes: '' });
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => api.patch(`/api/load-requests/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['load-requests'] }),
    onError: (err) => alert(err.response?.data?.error || 'Action failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      requested_amount: Number(form.requested_amount),
      product_id: form.product_id || undefined,
      quantity: Number(form.quantity) || 1,
      notes: form.notes || undefined,
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Load Requests</h1>
        {!isAdmin && (
          <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {showForm ? 'Cancel' : '+ New Request'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <input type="number" step="0.01" required placeholder="Requested amount"
            value={form.requested_amount} onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Generic load (no specific product)</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min="1" placeholder="Quantity" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={createMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:col-span-2 disabled:opacity-50">
            {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {STATUSES.map((status) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className={`mb-3 rounded-md px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[status]}`}>
                {status} ({requests?.filter((r) => r.status === status).length || 0})
              </h2>
              <div className="space-y-2">
                {requests?.filter((r) => r.status === status).map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                    <div className="font-medium text-slate-700">{peso(r.requested_amount)}</div>
                    {r.product_name && <div className="text-xs text-slate-500">{r.product_name} x{r.quantity}</div>}
                    <div className="text-xs text-slate-400">{r.agent_name} · {formatDate(r.requested_at)}</div>
                    {r.notes && <div className="mt-1 text-xs text-slate-500 italic">{r.notes}</div>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {isAdmin && status === 'pending' && (
                        <>
                          <button onClick={() => actionMutation.mutate({ id: r.id, action: 'approve' })}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">Approve</button>
                          <button onClick={() => actionMutation.mutate({ id: r.id, action: 'reject' })}
                            className="rounded bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">Reject</button>
                        </>
                      )}
                      {isAdmin && status === 'approved' && (
                        <button onClick={() => actionMutation.mutate({ id: r.id, action: 'release' })}
                          className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700">Release Stock</button>
                      )}
                      {!isAdmin && status === 'released' && (
                        <button onClick={() => actionMutation.mutate({ id: r.id, action: 'receive' })}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Confirm Receipt</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
