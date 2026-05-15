Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Create a `.env` file in `server/` with SMTP credentials (example in `.env.example`).

3. Start the server:

```bash
npm start
```

Endpoints
- `POST /api/send` { to, subject, text, html } — sends an email using configured SMTP credentials.

Security
- Do not commit your SMTP credentials. Use environment variables.
