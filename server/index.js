require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

if (!process.env.BREVO_API_KEY || !process.env.FROM_EMAIL) {
  console.warn('Warning: BREVO_API_KEY or FROM_EMAIL not set. Emails will fail until these are provided.');
}

// Send email via Brevo HTTP API (avoids SMTP port blocking on Render)
async function sendEmail({ to, subject, html, text }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: process.env.FROM_NAME || 'E-Receipts',
        email: process.env.FROM_EMAIL
      },
      to: [{ email: to.trim() }],
      subject: subject || 'Receipt',
      htmlContent: html || undefined,
      textContent: text || undefined
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

app.post('/api/send', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || typeof to !== 'string' || !to.trim()) {
      return res.status(400).json({ error: 'Missing recipient (to)' });
    }

    if (!process.env.BREVO_API_KEY || !process.env.FROM_EMAIL) {
      return res.status(500).json({ error: 'Email credentials are not configured' });
    }

    const data = await sendEmail({ to, subject, html, text });
    res.json({ ok: true, data });
  } catch (err) {
    console.error('Send error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    emailConfigured: Boolean(process.env.BREVO_API_KEY && process.env.FROM_EMAIL)
  });
});

// Database-backed receipts API
app.post('/api/receipts', async (req, res) => {
  if (!db.available) return res.status(501).json({ error: 'Database not configured' });
  try {
    const row = await db.addReceipt(req.body);
    res.json(row);
  } catch (err) {
    console.error('DB add error', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/receipts', async (req, res) => {
  if (!db.available) return res.status(501).json({ error: 'Database not configured' });
  try {
    const { from, to } = req.query;
    const rows = await db.getReceipts(from, to);
    res.json(rows);
  } catch (err) {
    console.error('DB list error', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/receipts/:id', async (req, res) => {
  if (!db.available) return res.status(501).json({ error: 'Database not configured' });
  try {
    const row = await db.getReceiptById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('DB get error', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/receipts/:id', async (req, res) => {
  if (!db.available) return res.status(501).json({ error: 'Database not configured' });
  try {
    const row = await db.updateReceipt(req.params.id, req.body);
    res.json(row);
  } catch (err) {
    console.error('DB update error', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/receipts/:id', async (req, res) => {
  if (!db.available) return res.status(501).json({ error: 'Database not configured' });
  try {
    await db.deleteReceipt(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DB delete error', err);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(__dirname + '/../'));
app.get('/', (req, res) => res.sendFile(__dirname + '/../index.html'));

app.listen(PORT, () => console.log(`E-Receipts server listening on ${PORT}`));

db.init().then(() => {
  if (db.available) console.log('Database ready');
}).catch(err => console.error('DB init error', err));