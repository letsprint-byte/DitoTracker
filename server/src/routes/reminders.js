import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { status, agent_id } = req.query;
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  if (req.user.role === 'agent') {
    where += ` AND rm.agent_id = $${i++}`;
    values.push(req.user.id);
  } else if (agent_id) {
    where += ` AND rm.agent_id = $${i++}`;
    values.push(agent_id);
  }
  if (status) { where += ` AND rm.status = $${i++}`; values.push(status); }

  const { rows } = await pool.query(
    `SELECT rm.*, r.business_name AS retailer_name, u.name AS agent_name,
            (rm.due_date < CURRENT_DATE AND rm.status = 'pending') AS is_overdue
     FROM reminders rm
     JOIN retailers r ON r.id = rm.retailer_id
     JOIN users u ON u.id = rm.agent_id
     ${where}
     ORDER BY rm.due_date ASC`,
    values
  );
  res.json(rows);
});

router.patch('/:id', async (req, res) => {
  const { status, due_date } = req.body;
  const { rows: existing } = await pool.query('SELECT * FROM reminders WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'agent' && existing[0].agent_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const fields = [];
  const values = [];
  let i = 1;
  if (status !== undefined) {
    if (!['pending', 'done', 'snoozed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    fields.push(`status = $${i++}`);
    values.push(status);
  }
  if (due_date !== undefined) { fields.push(`due_date = $${i++}`); values.push(due_date); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);
  const { rows } = await pool.query(`UPDATE reminders SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
  res.json(rows[0]);
});

// Generate monthly reminders: for each active retailer with expected_monthly_load_amount > 0,
// if 30+ days have passed since last_purchase_date (or never purchased since recruited),
// and no pending/snoozed reminder already exists, create one.
export async function generateReminders() {
  const { rows: retailers } = await pool.query(
    `SELECT * FROM retailers WHERE status = 'active' AND expected_monthly_load_amount > 0`
  );
  let created = 0;
  for (const retailer of retailers) {
    const baseline = retailer.last_purchase_date || retailer.date_recruited;
    if (!baseline) continue;
    const { rows: existing } = await pool.query(
      `SELECT id FROM reminders WHERE retailer_id = $1 AND reminder_type = 'monthly_load' AND status IN ('pending','snoozed')`,
      [retailer.id]
    );
    if (existing.length > 0) continue;

    const { rows: dueCheck } = await pool.query(
      `SELECT ($1::date + INTERVAL '30 days') <= CURRENT_DATE AS due, ($1::date + INTERVAL '30 days')::date AS due_date`,
      [baseline]
    );
    if (dueCheck[0].due) {
      await pool.query(
        `INSERT INTO reminders (retailer_id, agent_id, due_date, reminder_type) VALUES ($1,$2,$3,'monthly_load')`,
        [retailer.id, retailer.agent_id, dueCheck[0].due_date]
      );
      created++;
    }
  }
  return created;
}

router.post('/generate', async (req, res) => {
  const created = await generateReminders();
  res.json({ created });
});

export default router;
