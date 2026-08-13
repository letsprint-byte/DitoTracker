import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const emptyForm = { name: '', email: '', password: '', role: 'agent', phone: '' };

export default function Agents() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/users', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setForm(emptyForm);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.error || 'Failed to create user'),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/api/users/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Manage Agents</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 md:col-span-2">{error}</div>}
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={createMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:col-span-2 disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Create User'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-700">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2 capitalize text-slate-600">{u.role}</td>
                <td className="px-4 py-2 text-slate-500">{u.phone || '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleStatus.mutate({ id: u.id, status: u.status === 'active' ? 'inactive' : 'active' })}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    {u.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
