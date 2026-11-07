require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool, types } = require('pg');

types.setTypeParser(1082, (v) => v); // return DATE columns as 'YYYY-MM-DD' strings

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- resources: [column, type, required, enum options] ----
const RESOURCES = {
  bookings: {
    order: 'booking_date DESC, id DESC',
    search: ['customer_name', 'email', 'package_name', 'photographer', 'location'],
    fields: [
      ['customer_name', 'text', true], ['email', 'email', true], ['phone', 'text'],
      ['package_name', 'text', true], ['photographer', 'text'],
      ['booking_date', 'date', true], ['booking_time', 'time'],
      ['location', 'text'], ['notes', 'text'],
    ],
  },
  photographers: {
    order: 'name ASC',
    search: ['name', 'specialty', 'location', 'style'],
    fields: [
      ['name', 'text', true], ['specialty', 'text'], ['experience', 'int'], ['price', 'num'],
      ['location', 'text'], ['style', 'text'], ['services', 'text'],
      ['availability', 'enum', false, ['Available', 'Unavailable', 'On leave']],
      ['bio', 'text'], ['profile_image', 'text'], ['portfolio_images', 'text'],
    ],
  },
  packages: {
    order: 'name ASC',
    search: ['name', 'description'],
    fields: [
      ['name', 'text', true], ['description', 'text'], ['price', 'num'],
      ['status', 'enum', false, ['Active', 'Inactive']],
    ],
  },
};

// ---- validation helper ----
function validate(resource, body) {
  const value = {};
  for (const [col, type, required, options] of RESOURCES[resource].fields) {
    const label = col.replace(/_/g, ' ');
    const raw = String(body[col] ?? '').trim();
    if (!raw) {
      if (required) return { error: `${label} is required` };
      value[col] = type === 'enum' ? options[0] : null;
      continue;
    }
    if (raw.length > 4000) return { error: `${label} is too long` };
    if (type === 'email' && !/^\S+@\S+\.\S+$/.test(raw)) return { error: 'Enter a valid email address' };
    if (type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || isNaN(Date.parse(raw)))) return { error: 'Enter a valid date' };
    if (type === 'time' && !/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return { error: 'Enter a valid time' };
    if (type === 'int' && !(Number.isInteger(Number(raw)) && Number(raw) >= 0)) return { error: `${label} must be a whole number, 0 or more` };
    if (type === 'num' && !(Number.isFinite(Number(raw)) && Number(raw) >= 0)) return { error: `${label} must be 0 or more` };
    if (type === 'enum' && !options.includes(raw)) return { error: `Invalid ${label}` };
    value[col] = type === 'int' || type === 'num' ? Number(raw) : raw;
  }
  return { value };
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

// ---- READ: dashboard stats ----
app.get('/api/stats', wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT (SELECT COUNT(*) FROM bookings)::int AS total_bookings,
           (SELECT COUNT(*) FROM bookings WHERE booking_date >= CURRENT_DATE)::int AS upcoming_bookings,
           (SELECT COUNT(*) FROM photographers)::int AS photographers,
           (SELECT COUNT(*) FROM packages)::int AS packages`);
  const pk = await pool.query(
    `SELECT package_name, COUNT(*)::int AS count FROM bookings GROUP BY package_name ORDER BY count DESC`);
  res.json({ ...rows[0], by_package: pk.rows });
}));

// ---- shared checks for /api/:resource routes ----
app.use('/api/:resource', (req, res, next) => {
  if (!RESOURCES[req.params.resource]) return res.status(404).json({ error: 'Unknown resource' });
  next();
});
app.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid id' });
  next();
});

// ---- READ: list (with optional search) ----
app.get('/api/:resource', wrap(async (req, res) => {
  const { order, search } = RESOURCES[req.params.resource];
  const q = (req.query.q || '').trim();
  const table = req.params.resource;
  const { rows } = q
    ? await pool.query(
        `SELECT * FROM ${table} WHERE ${search.map((c) => `${c} ILIKE $1`).join(' OR ')} ORDER BY ${order}`,
        [`%${q}%`])
    : await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
  res.json(rows);
}));

// ---- READ: one ----
app.get('/api/:resource/:id', wrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM ${req.params.resource} WHERE id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

// ---- CREATE ----
app.post('/api/:resource', wrap(async (req, res) => {
  const table = req.params.resource;
  const { error, value } = validate(table, req.body);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  const { rows } = await pool.query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    Object.values(value));
  res.status(201).json(rows[0]);
}));

// ---- UPDATE ----
app.put('/api/:resource/:id', wrap(async (req, res) => {
  const table = req.params.resource;
  const { error, value } = validate(table, req.body);
  if (error) return res.status(400).json({ error });
  const cols = Object.keys(value);
  const { rows } = await pool.query(
    `UPDATE ${table} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_at=NOW()
     WHERE id=$${cols.length + 1} RETURNING *`,
    [...Object.values(value), req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

// ---- DELETE ----
app.delete('/api/:resource/:id', wrap(async (req, res) => {
  const { rowCount } = await pool.query(`DELETE FROM ${req.params.resource} WHERE id=$1`, [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
}));

// ---- startup ----
async function init() {
  await pool.query(require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Dashboard running at http://localhost:${port}`));
}
init().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
