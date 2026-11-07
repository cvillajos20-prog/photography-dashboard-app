# Photography Dashboard (Express.js + Supabase)

Dashboard with full CRUD for bookings, photographers and packages: stat cards, bookings-by-package summary, search, add/edit modal, delete.
Backend: Express.js. Database: Supabase (PostgreSQL) via `pg`.

## 1. Create the Supabase database
1. Go to https://supabase.com and create a free project (save the database password).
2. Open **Project Settings > Database > Connection string > URI** and copy it
   (the pooler URI on port 6543 works well).
3. (Optional) Run `schema.sql` in the **SQL Editor**. The server also creates the tables on startup.

## 2. Run the app
```bash
npm install
cp .env.example .env     # paste your Supabase URI, replacing [YOUR-PASSWORD]
npm start
```
Open http://localhost:3000

## REST API
`:resource` is one of `bookings`, `photographers`, `packages`.

| Method | Endpoint                | Purpose              |
|--------|-------------------------|----------------------|
| GET    | /api/:resource?q=       | List / search        |
| GET    | /api/:resource/:id      | Get one record       |
| POST   | /api/:resource          | Create               |
| PUT    | /api/:resource/:id      | Update               |
| DELETE | /api/:resource/:id      | Delete               |
| GET    | /api/stats              | Dashboard statistics |

Booking body: `{ "customer_name": "Ana Cruz", "email": "ana@mail.com", "package_name": "Wedding", "photographer": "Leo", "booking_date": "2026-12-05", "booking_time": "09:00" }`

## Notes
- Keep `.env` private; never commit it.
- Special characters in your DB password must be URL-encoded in the URI (e.g. `@` → `%40`).
- This version has no admin login. Add one before putting it on the public internet.
- Photographer images are stored as URLs (profile image, and comma-separated portfolio URLs).
