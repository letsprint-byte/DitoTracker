import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import retailersRoutes from './routes/retailers.js';
import productsRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import loadRequestsRoutes from './routes/loadRequests.js';
import salesRoutes from './routes/sales.js';
import paymentsRoutes from './routes/payments.js';
import remindersRoutes, { generateReminders } from './routes/reminders.js';
import notificationsRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/retailers', retailersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/load-requests', loadRequestsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`DitoTracker API listening on port ${PORT}`);
});

// Run once at startup, then daily at 6am — generates monthly load reminders
generateReminders().then((n) => console.log(`Generated ${n} reminders on startup`));
cron.schedule('0 6 * * *', async () => {
  const n = await generateReminders();
  console.log(`Generated ${n} reminders (scheduled run)`);
});
