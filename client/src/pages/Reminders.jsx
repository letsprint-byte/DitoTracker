import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate } from '../utils/format';

export default function Reminders() {
  const [status, setStatus] = useState('pending');
  const qc = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders', status],
    queryFn: () => api.get('/api/reminders', { params: { status: status || undefined } }).then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/api/reminders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Reminders</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="pending">Pending</option>
          <option value="snoozed">Snoozed</option>
          <option value="done">Done</option>
          <option value="dismissed">Dismissed</option>
          <option value="">All</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-2">Retailer</th>
              <th className="px-4 py-2">Agent</th>
              <th className="px-4 py-2">Due Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {reminders?.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No reminders.</td></tr>}
            {reminders?.map((r) => (
              <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50 ${r.is_overdue ? 'bg-rose-50/50' : ''}`}>
                <td className="px-4 py-2">
                  <Link to={`/retailers/${r.retailer_id}`} className="font-medium text-indigo-600 hover:underline">{r.retailer_name}</Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{r.agent_name}</td>
                <td className={`px-4 py-2 ${r.is_overdue ? 'font-medium text-rose-600' : 'text-slate-600'}`}>
                  {formatDate(r.due_date)} {r.is_overdue && '(overdue)'}
                </td>
                <td className="px-4 py-2 capitalize text-slate-600">{r.status}</td>
                <td className="px-4 py-2">
                  {r.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'done' })}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700">Done</button>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'snoozed' })}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700">Snooze</button>
                      <button onClick={() => updateMutation.mutate({ id: r.id, status: 'dismissed' })}
                        className="rounded bg-slate-400 px-2 py-1 text-xs text-white hover:bg-slate-500">Dismiss</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
