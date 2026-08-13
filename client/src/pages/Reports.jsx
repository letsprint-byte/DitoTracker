import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'collections', label: 'Collections Report' },
  { value: 'retailers', label: 'Retailer Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'agent-performance', label: 'Agent Performance Report' },
];

export default function Reports() {
  const { isAdmin } = useAuth();
  const [type, setType] = useState('sales');
  const [filters, setFilters] = useState({ date_from: '', date_to: '' });

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ['report', type, filters],
    queryFn: () =>
      api.get(`/api/reports/${type}`, {
        params: { date_from: filters.date_from || undefined, date_to: filters.date_to || undefined },
      }).then((r) => r.data),
  });

  const handleExport = async () => {
    const res = await api.get(`/api/reports/${type}`, {
      params: { date_from: filters.date_from || undefined, date_to: filters.date_to || undefined, format: 'csv' },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}-report.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Reports</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(type === 'sales' || type === 'collections' || type === 'agent-performance') && (
          <>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </>
        )}
        <button onClick={() => refetch()} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Refresh
        </button>
        <button onClick={handleExport} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              {columns.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2 capitalize">{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-6 text-center text-slate-400">Loading...</td></tr>}
            {rows?.length === 0 && <tr><td className="px-4 py-6 text-center text-slate-400">No data for this report.</td></tr>}
            {rows?.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                {columns.map((c) => <td key={c} className="whitespace-nowrap px-4 py-2 text-slate-700">{String(row[c] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
