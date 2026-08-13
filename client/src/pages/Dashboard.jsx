import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { peso, formatDate } from '../utils/format';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/api/dashboard/summary').then((r) => r.data),
  });

  if (isLoading || !data) return <div className="text-slate-400">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">
        {isAdmin ? 'Admin Dashboard' : 'My Dashboard'}
      </h1>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Sales (period)" value={peso(data.total_sales)} accent="text-indigo-600" />
            <StatCard label="Collections (period)" value={peso(data.total_collections)} accent="text-emerald-600" />
            <StatCard label="Outstanding" value={peso(data.total_outstanding)} accent="text-rose-600" />
            <StatCard label="Active Retailers" value={data.active_retailers} />
            <StatCard label="Pending Load Requests" value={data.pending_load_requests} />
            <StatCard label="Low Stock Items" value={data.low_stock.length} accent={data.low_stock.length ? 'text-amber-600' : 'text-slate-800'} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-700">Agent Performance</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400">
                    <th className="pb-2">Agent</th>
                    <th className="pb-2">Sales</th>
                    <th className="pb-2">Collections</th>
                    <th className="pb-2">Outstanding</th>
                    <th className="pb-2">Retailers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.per_agent.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-700">{a.name}</td>
                      <td className="py-2">{peso(a.sales_total)}</td>
                      <td className="py-2">{peso(a.collections_total)}</td>
                      <td className="py-2 text-rose-600">{peso(a.outstanding)}</td>
                      <td className="py-2">{a.retailer_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-700">Low Stock Alerts</h2>
              {data.low_stock.length === 0 ? (
                <p className="text-sm text-slate-400">All stock levels healthy.</p>
              ) : (
                <ul className="space-y-2">
                  {data.low_stock.map((item, idx) => (
                    <li key={idx} className="flex justify-between rounded-md bg-amber-50 px-3 py-2 text-sm">
                      <span className="text-amber-800">{item.name}</span>
                      <span className="font-medium text-amber-700">{item.quantity_on_hand} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="My Sales (period)" value={peso(data.total_sales)} accent="text-indigo-600" />
            <StatCard label="My Collections (period)" value={peso(data.total_collections)} accent="text-emerald-600" />
            <StatCard label="My Outstanding" value={peso(data.total_outstanding)} accent="text-rose-600" />
            <StatCard label="Assigned Retailers" value={data.assigned_retailers} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-700">Upcoming Reminders</h2>
              {data.upcoming_reminders.length === 0 ? (
                <p className="text-sm text-slate-400">No pending reminders.</p>
              ) : (
                <ul className="space-y-2">
                  {data.upcoming_reminders.map((r) => (
                    <li key={r.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700">{r.retailer_name}</span>
                      <span className="text-slate-400">{formatDate(r.due_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/reminders" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
                View all reminders →
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-700">Load Request Status</h2>
              <ul className="space-y-2">
                {data.load_request_status.length === 0 && <p className="text-sm text-slate-400">No load requests yet.</p>}
                {data.load_request_status.map((s) => (
                  <li key={s.status} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm capitalize">
                    <span className="text-slate-700">{s.status}</span>
                    <span className="font-medium text-slate-800">{s.count}</span>
                  </li>
                ))}
              </ul>
              <Link to="/load-requests" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
                View load requests →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
