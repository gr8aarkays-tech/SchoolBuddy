# SchoolBuddy Backend

Express + LibSQL REST API that powers the SchoolBuddy PWA.

## Quick start (local dev)

```bash
cd backend
npm install
node src/index.js       # starts on http://localhost:3001
```

No env vars needed for local dev — the database creates itself at `backend/data/sanjuclass1.db` and seeds sample data automatically on first run.

## Database

The backend uses **[LibSQL](https://github.com/tursodatabase/libsql)** (a SQLite fork) via `@libsql/client`.

### Local mode (default)
A SQLite file at `backend/data/sanjuclass1.db`. Fine for local development. **Not suitable for Render free tier** — the disk is wiped on every redeploy.

### Turso cloud mode (production)

[Turso](https://turso.tech) hosts the LibSQL database persistently in the cloud. The free tier gives you **500 MB storage** and **1 billion row reads/month** — more than enough for this app.

**One-time setup (5 minutes):**

1. **Create a free account** at [turso.tech](https://turso.tech) — no credit card needed.

2. **Install the Turso CLI** (macOS/Linux):
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
   Windows: download from [github.com/tursodatabase/turso-cli/releases](https://github.com/tursodatabase/turso-cli/releases)

3. **Log in:**
   ```bash
   turso auth login
   ```

4. **Create the database:**
   ```bash
   turso db create schoolbuddy
   ```

5. **Get the URL:**
   ```bash
   turso db show schoolbuddy --url
   # → libsql://schoolbuddy-<your-org>.turso.io
   ```

6. **Create an auth token:**
   ```bash
   turso db tokens create schoolbuddy
   # → a long JWT string
   ```

7. **Add to Render environment variables** (Dashboard → schoolbuddy-backend → Environment):

   | Key | Value |
   |---|---|
   | `TURSO_DB_URL` | `libsql://schoolbuddy-<your-org>.turso.io` |
   | `TURSO_DB_TOKEN` | `<the JWT from step 6>` |

8. **Trigger a redeploy** on Render — the backend will now connect to Turso on startup and log:
   ```
   DB: Turso cloud → libsql://schoolbuddy-<your-org>.turso.io
   ```

That's it. All data is now stored durably in Turso and survives Render service restarts, redeploys, and sleep cycles.

### How it works

The `@libsql/client` library transparently supports both `file:` (local) and `libsql://` (Turso) URLs — the SQL schema, queries, and `db.batch()` calls in [`src/db.js`](src/db.js) and [`src/routes.js`](src/routes.js) are **identical** for both modes. No query changes needed.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/children` | List / create children |
| PUT/DELETE | `/api/children/:id` | Update / delete child |
| GET/POST | `/api/subjects` | List / create subjects |
| PUT/DELETE | `/api/subjects/:id` | Update / delete subject |
| GET/POST | `/api/chapters` | List / create chapters |
| PUT/DELETE | `/api/chapters/:id` | Update / delete chapter |
| GET/POST | `/api/topics` | List / create topics |
| PUT/DELETE | `/api/topics/:id` | Update / delete topic |
| GET/POST | `/api/exams` | List / create exams |
| PUT/DELETE | `/api/exams/:id` | Update / delete exam |
| GET/POST | `/api/materials` | List / create materials |
| PUT/DELETE | `/api/materials/:id` | Update / delete material |
| GET/POST | `/api/weekly-lessons` | List / create weekly lessons |
| PUT/DELETE | `/api/weekly-lessons/:id` | Update / delete lesson |
| GET/POST | `/api/question-papers` | List / create question papers |
| DELETE | `/api/question-papers/:id` | Delete question paper |
| GET/POST | `/api/practice-attempts` | List / create practice attempts |
