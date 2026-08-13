import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/retailers', label: 'Retailers' },
  { to: '/sales', label: 'Sales' },
  { to: '/load-requests', label: 'Load Requests' },
  { to: '/payments', label: 'Collections' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/reminders', label: 'Reminders' },
  { to: '/reports', label: 'Reports' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-indigo-600">DitoTracker</span>
            <nav className="hidden gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {isAdmin && (
                <NavLink
                  to="/agents"
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  Agents
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="text-right text-sm">
              <div className="font-medium text-slate-700">{user?.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-1 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
