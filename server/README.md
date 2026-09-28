Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Create `server/.env` from `.env.example` and set `DATABASE_URL` to the PostgreSQL connection string from your Supabase project. The server uses the `pg` driver, so no separate Supabase SDK is required.

	Use the Supabase connection pooler URL for a deployed server, and keep `?sslmode=require` at the end. On startup, the server creates the `receipts` table automatically if it does not already exist.

3. Start the server:

```bash
npm start
```

Endpoints
- `POST /api/receipts` — saves a receipt in Supabase.
- `GET /api/receipts` — loads receipts from Supabase.
- `PUT /api/receipts/:id` — updates a receipt in Supabase.
- `DELETE /api/receipts/:id` — deletes a receipt from Supabase.
- `POST /api/send` { to, subject, text, html } — sends an email through Brevo.

Security
- Do not commit `server/.env`, Supabase database passwords, or Brevo API keys. Use environment variables.
