import { pool } from '../db/pool.js';

export async function notify(userId, type, message, relatedEntityType = null, relatedEntityId = null) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, message, related_entity_type, related_entity_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, message, relatedEntityType, relatedEntityId]
  );
}

export async function notifyAdmins(type, message, relatedEntityType = null, relatedEntityId = null) {
  const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'admin' AND status = 'active'`);
  for (const row of rows) {
    await notify(row.id, type, message, relatedEntityType, relatedEntityId);
  }
}
