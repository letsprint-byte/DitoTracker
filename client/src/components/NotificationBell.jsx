import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/api/notifications/unread-count').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications').then((r) => r.data),
    enabled: open,
  });

  const markRead = async (id) => {
    await api.patch(`/api/notifications/${id}/read`);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = async () => {
    await api.patch('/api/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unread?.count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
            {unread.count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="font-medium text-slate-700">Notifications</span>
            <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(notifications || []).length === 0 && (
              <div className="p-4 text-sm text-slate-400">No notifications</div>
            )}
            {(notifications || []).map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`block w-full border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  n.is_read ? 'text-slate-400' : 'text-slate-800 font-medium'
                }`}
              >
                {n.message}
                <div className="text-xs font-normal text-slate-400">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
