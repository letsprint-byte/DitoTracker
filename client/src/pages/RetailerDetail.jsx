import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { peso, formatDate } from '../utils/format';

export default function RetailerDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const { data: retailer, isLoading } = useQuery({
    queryKey: ['retailer', id],
    queryFn: () => api.get(`/api/retailers/${id}`).then((r) => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['retailer-history', id],
    queryFn: () => api.get(`/api/retailers/${id}/history`).then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => api.patch(`/api/retailers/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retailer', id] });
      qc.invalidateQueries({ queryKey: ['retailers'] });
      setEditing(false);
    },
  });

  if (isLoading || !retailer) return <div className="text-slate-400">Loading...</div>;

  const startEdit = () => {
    setForm({
      business_name: retailer.business_name,
      contact_person: retailer.contact_person || '',
      phone: retailer.phone || '',
      address: retailer.address || '',
      status: retailer.status,
      expected_monthly_load_amount: retailer.expected_monthly_load_amount,
      notes: retailer.notes || '',
    });
    setEditing(true);
  };

  const timeline = [
    ...(history?.sales || []).map((s) => ({ type: 'sale', date: s.sale_date, ...s })),
    ...(history?.payments || []).map((p) => ({ type: 'payment', date: p.payment_date, ...p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <Link to="/retailers" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">← Back to Retailers</Link>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{retailer.business_name}</h1>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${retailer.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {retailer.status}
            </span>
          </div>
          <button onClick={startEdit} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Edit
          </button>
        </div>

        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(form); }}
            className="grid gap-3 md:grid-cols-2"
          >
            <input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Business name" />
            <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Contact person" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Address" />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <input type="number" step="0.01" value={form.expected_monthly_load_amount}
              onChange={(e) => setForm({ ...form, expected_monthly_load_amount: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Expected monthly load" />
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Notes" />
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div><span className="text-slate-400">Contact:</span> <span className="text-slate-700">{retailer.contact_person || '—'}</span></div>
            <div><span className="text-slate-400">Phone:</span> <span className="text-slate-700">{retailer.phone || '—'}</span></div>
            <div><span className="text-slate-400">Address:</span> <span className="text-slate-700">{retailer.address || '—'}</span></div>
            <div><span className="text-slate-400">Agent:</span> <span className="text-slate-700">{retailer.agent_name}</span></div>
            <div><span className="text-slate-400">Recruited:</span> <span className="text-slate-700">{formatDate(retailer.date_recruited)}</span></div>
            <div><span className="text-slate-400">Last purchase:</span> <span className="text-slate-700">{formatDate(retailer.last_purchase_date)}</span></div>
            <div><span className="text-slate-400">Expected monthly load:</span> <span className="text-slate-700">{peso(retailer.expected_monthly_load_amount)}</span></div>
            <div><span className="text-slate-400">Current balance:</span> <span className={`font-medium ${Number(retailer.current_balance) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{peso(retailer.current_balance)}</span></div>
            {retailer.notes && <div className="md:col-span-3"><span className="text-slate-400">Notes:</span> <span className="text-slate-700">{retailer.notes}</span></div>}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-700">Purchase History</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-400">No sales or payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {timeline.map((t, idx) => (
              <li key={`${t.type}-${t.id}-${idx}`} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${t.type === 'sale' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {t.type === 'sale' ? 'Sale' : 'Payment'}
                  </span>
                  <span className="text-slate-700">
                    {t.type === 'sale' ? `${t.product_name} x${t.quantity}` : `${t.payment_method} payment`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{formatDate(t.date)}</span>
                  <span className="font-medium text-slate-800">{peso(t.type === 'sale' ? t.total_amount : t.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
