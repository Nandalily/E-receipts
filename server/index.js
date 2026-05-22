require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.FROM_EMAIL) {
  console.warn('Warning: SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL) not set. The server will fail to send emails until these are provided.');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.post('/api/send', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    if (!to || typeof to !== 'string' || !to.trim()) {
      return res.status(400).json({ error: 'Missing recipient (to)' });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.FROM_EMAIL) {
      return res.status(500).json({ error: 'SMTP credentials are not configured' });
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: to.trim(),
      subject: subject || 'Receipt',
      text: text || undefined,
      html: html || undefined
    };

    const info = await transporter.sendMail(mailOptions);
    res.json({ ok: true, info });
  } catch (err) {
    console.error('Send error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.FROM_EMAIL)
  });
});

// Database-backed receipts API (requires DATABASE_URL)
app.post('/api/receipts', async (req, res) => {
  if (!db.available) return res.status(501).json({ error: 'Database not configured' });
  try {
    const rec = req.body;
    const row = await db.addReceipt(rec);
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

// app.get('/', (req, res) => res.send('E-Receipts email API'));

// app.use(express.static(__dirname + '/../'));
// app.get('/', (req, res) => res.sendFile(__dirname + '/../index.html'));

app.use(express.static(__dirname + '/../'));
app.get('/', (req, res) => res.sendFile(__dirname + '/../index.html'));

app.listen(PORT, () => console.log(`E-Receipts server listening on ${PORT}`));

// Initialize DB (if configured)
db.init().then(() => {
  if (db.available) console.log('Database ready');
}).catch(err => console.error('DB init error', err));
