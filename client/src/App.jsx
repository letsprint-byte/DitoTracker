import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Retailers from './pages/Retailers';
import RetailerDetail from './pages/RetailerDetail';
import Sales from './pages/Sales';
import LoadRequests from './pages/LoadRequests';
import Payments from './pages/Payments';
import Inventory from './pages/Inventory';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import Agents from './pages/Agents';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/retailers" element={<Retailers />} />
        <Route path="/retailers/:id" element={<RetailerDetail />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/load-requests" element={<LoadRequests />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/agents"
          element={
            <ProtectedRoute adminOnly>
              <Agents />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
