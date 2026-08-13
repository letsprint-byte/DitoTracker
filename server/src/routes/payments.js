import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyAdmins } from '../utils/notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { agent_id, retailer_id, method, date_from, date_to } = req.query;
  const values = [];
  let i = 1;
  let where = 'WHERE 1=1';
  if (req.user.role === 'agent') {
    where += ` AND p.agent_id = $${i++}`;
    values.push(req.user.id);
  } else if (agent_id) {
    where += ` AND p.agent_id = $${i++}`;
    values.push(agent_id);
  }
  if (retailer_id) { where += ` AND p.retailer_id = $${i++}`; values.push(retailer_id); }
  if (method) { where += ` AND p.payment_method = $${i++}`; values.push(method); }
  if (date_from) { where += ` AND p.payment_date >= $${i++}`; values.push(date_from); }
  if (date_to) { where += ` AND p.payment_date <= $${i++}`; values.push(date_to); }

  const { rows } = await pool.query(
    `SELECT p.*, r.business_name AS retailer_name, u.name AS agent_name
     FROM payments p
     JOIN retailers r ON r.id = p.retailer_id
     JOIN users u ON u.id = p.agent_id
     ${where}
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    values
  );
  res.json(rows);
});

router.post('/', upload.single('proof_image'), async (req, res) => {
  const { sale_id, retailer_id, amount, payment_method, payment_date, notes } = req.body;
  if (!retailer_id || !amount || !payment_method) {
    return res.status(400).json({ error: 'retailer_id, amount, payment_method are required' });
  }

  const { rows: retailerRows } = await pool.query('SELECT * FROM retailers WHERE id = $1', [retailer_id]);
  const retailer = retailerRows[0];
  if (!retailer) return res.status(404).json({ error: 'Retailer not found' });
  if (req.user.role === 'agent' && retailer.agent_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const agentId = retailer.agent_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO payments (sale_id, retailer_id, agent_id, amount, payment_method, proof_image_url, payment_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8) RETURNING *`,
      [sale_id || null, retailer_id, agentId, amount, payment_method, proofUrl, payment_date || null, notes || null]
    );

    await client.query('UPDATE retailers SET current_balance = current_balance - $1 WHERE id = $2', [amount, retailer_id]);

    if (sale_id) {
      const { rows: saleRows } = await client.query('SELECT * FROM sales WHERE id = $1', [sale_id]);
      const sale = saleRows[0];
      if (sale) {
        const { rows: paidRows } = await client.query(
          'SELECT COALESCE(SUM(amount),0) AS total_paid FROM payments WHERE sale_id = $1',
          [sale_id]
        );
        const totalPaid = Number(paidRows[0].total_paid);
        const newStatus = totalPaid >= Number(sale.total_amount) ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
        await client.query('UPDATE sales SET payment_status = $1 WHERE id = $2', [newStatus, sale_id]);
      }
    }

    await client.query('COMMIT');
    await notifyAdmins('payment', `${req.user.name} recorded a payment of ${amount} from ${retailer.business_name}`, 'payment', rows[0].id);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
