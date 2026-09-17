require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || null;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

function personFromRow(row, extra) {
  const labels = extra || {};
  return {
    contact: row.contact || labels.contact || '',
    fellowship: row.fellowship || labels.fellowship || ''
  };
}

function withPersonFields(rec) {
  const extra = { ...(rec.extraLabels || rec.extra_labels || {}) };
  const contact = rec.contact || extra.contact || '';
  const fellowship = rec.fellowship || extra.fellowship || '';
  extra.contact = contact;
  extra.fellowship = fellowship;
  return { ...rec, contact, fellowship, extraLabels: extra };
}

function rowToReceipt(row) {
  if (!row) return null;
  const extraLabels = row.extra_labels || {};
  const person = personFromRow(row, extraLabels);
  return {
    id: row.id,
    name: row.name,
    date: row.date ? (row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date)) : null,
    treasurer: row.treasurer,
    email: row.email,
    contact: person.contact,
    fellowship: person.fellowship,
    projects: row.projects || {},
    total: Number(row.total || 0),
    extraLabels,
    savedAt: row.saved_at || '',
    savedBy: row.saved_by || '',
    updatedAt: row.updated_at || '',
    sent: Boolean(row.sent),
    sentAt: row.sent_at || ''
  };
}

function isMissingColumnError(err) {
  return /column .* does not exist/i.test(err && err.message ? err.message : '');
}

async function init() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      treasurer TEXT,
      email TEXT,
      contact TEXT,
      fellowship TEXT,
      projects JSONB NOT NULL,
      total NUMERIC NOT NULL,
      extra_labels JSONB,
      saved_at TIMESTAMPTZ DEFAULT now(),
      saved_by TEXT,
      updated_at TIMESTAMPTZ,
      sent BOOLEAN NOT NULL DEFAULT false,
      sent_at TIMESTAMPTZ
    )
  `);
  await pool.query('ALTER TABLE receipts ADD COLUMN IF NOT EXISTS contact TEXT');
  await pool.query('ALTER TABLE receipts ADD COLUMN IF NOT EXISTS fellowship TEXT');
}

async function addReceipt(rec) {
  if (!pool) throw new Error('Database not configured');
  rec = withPersonFields(rec);
  try {
    const q = `INSERT INTO receipts (name,date,treasurer,email,contact,fellowship,projects,total,extra_labels,saved_by,saved_at,updated_at,sent,sent_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`;
    const vals = [
      rec.name,
      rec.date,
      rec.treasurer || null,
      rec.email || null,
      rec.contact || null,
      rec.fellowship || null,
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
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
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
}

async function getReceipts(from, to) {
  if (!pool) throw new Error('Database not configured');
  if (from && to) {
    const q = 'SELECT * FROM receipts WHERE date BETWEEN $1 AND $2 ORDER BY date DESC, id DESC';
    const { rows } = await pool.query(q, [from, to]);
    return rows.map(rowToReceipt);
  }
  const { rows } = await pool.query('SELECT * FROM receipts ORDER BY id DESC');
  return rows.map(rowToReceipt);
}

async function getReceiptById(id) {
  if (!pool) throw new Error('Database not configured');
  const { rows } = await pool.query('SELECT * FROM receipts WHERE id = $1', [id]);
  return rowToReceipt(rows[0] || null);
}

async function updateReceipt(id, rec) {
  if (!pool) throw new Error('Database not configured');
  rec = withPersonFields(rec);
  try {
    const q = `UPDATE receipts SET name=$1,date=$2,treasurer=$3,email=$4,contact=$5,fellowship=$6,projects=$7,total=$8,extra_labels=$9,updated_at=$10,sent=$11,sent_at=$12 WHERE id=$13 RETURNING *`;
    const vals = [
      rec.name,
      rec.date,
      rec.treasurer || null,
      rec.email || null,
      rec.contact || null,
      rec.fellowship || null,
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
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
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
}

async function deleteReceipt(id) {
  if (!pool) throw new Error('Database not configured');
  await pool.query('DELETE FROM receipts WHERE id = $1', [id]);
}

function mapPerson(row) {
  const extra = row.extra_labels || {};
  const person = personFromRow(row, extra);
  return {
    name: row.name || '',
    email: row.email || '',
    contact: person.contact,
    fellowship: person.fellowship
  };
}

async function searchPeople(q) {
  if (!pool) throw new Error('Database not configured');
  const term = String(q || '').trim();
  if (term.length < 3) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (LOWER(TRIM(name))) *
     FROM receipts
     WHERE name ILIKE $1
     ORDER BY LOWER(TRIM(name)), id DESC
     LIMIT 15`,
    [term + '%']
  );
  return rows.map(mapPerson);
}

async function listPeople() {
  if (!pool) throw new Error('Database not configured');
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (LOWER(TRIM(name))) *
     FROM receipts
     WHERE name IS NOT NULL AND TRIM(name) <> ''
     ORDER BY LOWER(TRIM(name)), id DESC
     LIMIT 500`
  );
  return rows.map(mapPerson);
}

module.exports = {
  available: Boolean(pool),
  init,
  addReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  deleteReceipt,
  searchPeople,
  listPeople
};
