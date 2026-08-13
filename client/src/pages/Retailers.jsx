import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { peso, formatDate } from '../utils/format';

const emptyForm = {
  business_name: '', contact_person: '', phone: '', address: '', expected_monthly_load_amount: '', notes: '', agent_id: '',
};

export default function Retailers() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: retailers, isLoading } = useQuery({
    queryKey: ['retailers', search, status],
    queryFn: () =>
      api.get('/api/retailers', { params: { search: search || undefined, status: status || undefined } }).then((r) => r.data),
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/api/users').then((r) => r.data.filter((u) => u.role === 'agent')),
    enabled: isAdmin && showForm,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/retailers', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retailers'] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      agent_id: form.agent_id || undefined,
      expected_monthly_load_amount: Number(form.expected_monthly_load_amount) || 0,
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Retailers</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Add Retailer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <input required placeholder="Business name" value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          {isAdmin && (
            <select required value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Assign to agent...</option>
              {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <input placeholder="Contact person" value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Address" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" step="0.01" placeholder="Expected monthly load amount" value={form.expected_monthly_load_amount}
            onChange={(e) => setForm({ ...form, expected_monthly_load_amount: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={createMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:col-span-2 disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Save Retailer'}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder="Search business, contact, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2">Business</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Balance</th>
              <th className="px-4 py-2">Last Purchase</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>
            )}
            {retailers?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No retailers found.</td></tr>
            )}
            {retailers?.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link to={`/retailers/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                    {r.business_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{r.agent_name}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {r.status}
                  </span>
                </td>
                <td className={`px-4 py-2 font-medium ${Number(r.current_balance) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {peso(r.current_balance)}
                </td>
                <td className="px-4 py-2 text-slate-500">{formatDate(r.last_purchase_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
