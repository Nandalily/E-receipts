require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || null;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

function rowToReceipt(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    treasurer: row.treasurer,
    email: row.email,
    projects: row.projects || {},
    total: Number(row.total || 0),
    extraLabels: row.extra_labels || {},
    savedAt: row.saved_at || '',
    savedBy: row.saved_by || '',
    updatedAt: row.updated_at || '',
    sent: Boolean(row.sent),
    sentAt: row.sent_at || ''
  };
}

async function init() {
  if (!pool) return;
  // Create receipts table if it doesn't exist
  const sql = `
    CREATE TABLE IF NOT EXISTS receipts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      treasurer TEXT,
      email TEXT,
      projects JSONB NOT NULL,
      total NUMERIC NOT NULL,
      extra_labels JSONB,
      saved_at TIMESTAMPTZ DEFAULT now(),
      saved_by TEXT,
      updated_at TIMESTAMPTZ,
      sent BOOLEAN NOT NULL DEFAULT false,
      sent_at TIMESTAMPTZ
    );
  `;
  await pool.query(sql);
}



async function addReceipt(rec) {
  if (!pool) throw new Error('Database not configured');
  const q = `INSERT INTO receipts (name,date,treasurer,email,projects,total,extra_labels,saved_by,saved_at,updated_at,sent,sent_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`;
  const vals = [
    rec.name,
    rec.date,
    rec.treasurer || null,
    rec.email || null,
    rec.projects || {},
    rec.total || 0,
    rec.extraLabels || {},
    rec.savedBy || null,
    rec.savedAt || new Date().toISOString(),
    rec.updatedAt || null,
    Boolean(rec.sent),
    rec.sentAt || null
  ];
  const { rows } = await pool.query(q, vals);
  return rowToReceipt(rows[0]);
}

async function getReceipts(from, to) {
  if (!pool) throw new Error('Database not configured');
  if (from && to) {
    const q = 'SELECT * FROM receipts WHERE date BETWEEN $1 AND $2 ORDER BY date DESC';
    const { rows } = await pool.query(q, [from, to]);
    return rows.map(rowToReceipt);
  }
  const { rows } = await pool.query('SELECT * FROM receipts ORDER BY id DESC LIMIT 1000');
  return rows.map(rowToReceipt);
}

async function getReceiptById(id) {
  if (!pool) throw new Error('Database not configured');
  const { rows } = await pool.query('SELECT * FROM receipts WHERE id = $1', [id]);
  return rowToReceipt(rows[0] || null);
}

async function updateReceipt(id, rec) {
  if (!pool) throw new Error('Database not configured');
  const q = `UPDATE receipts SET name=$1,date=$2,treasurer=$3,email=$4,projects=$5,total=$6,extra_labels=$7,updated_at=$8,sent=$9,sent_at=$10 WHERE id=$11 RETURNING *`;
  const vals = [
    rec.name,
    rec.date,
    rec.treasurer || null,
    rec.email || null,
    rec.projects || {},
    rec.total || 0,
    rec.extraLabels || {},
    rec.updatedAt || new Date().toISOString(),
    Boolean(rec.sent),
    rec.sentAt || null,
    id
  ];
  const { rows } = await pool.query(q, vals);
  return rowToReceipt(rows[0] || null);
}

async function deleteReceipt(id) {
  if (!pool) throw new Error('Database not configured');
  await pool.query('DELETE FROM receipts WHERE id = $1', [id]);
}

module.exports = {
  available: Boolean(pool),
  init,
  addReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  deleteReceipt
};
