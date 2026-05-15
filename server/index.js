require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

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
    if (!to) return res.status(400).json({ error: 'Missing recipient (to)' });

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to,
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

app.get('/', (req, res) => res.send('E-Receipts email API'));

app.listen(PORT, () => console.log(`E-Receipts server listening on ${PORT}`));
