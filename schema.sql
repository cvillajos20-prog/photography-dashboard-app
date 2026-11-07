-- Run this in the Supabase SQL Editor (the server also creates it automatically on startup)
CREATE TABLE IF NOT EXISTS packages (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120)  NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) CHECK (price >= 0),
  status      VARCHAR(20)   NOT NULL DEFAULT 'Active',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photographers (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(120)  NOT NULL,
  bio              TEXT,
  specialty        VARCHAR(120),
  experience       INTEGER CHECK (experience >= 0),
  location         VARCHAR(120),
  style            VARCHAR(120),
  services         TEXT,
  price            NUMERIC(10,2) CHECK (price >= 0),
  availability     VARCHAR(20)   NOT NULL DEFAULT 'Available',
  profile_image    TEXT,
  portfolio_images TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL,
  phone         VARCHAR(40),
  package_name  VARCHAR(120) NOT NULL,
  photographer  VARCHAR(120),
  booking_date  DATE         NOT NULL,
  booking_time  TIME,
  location      VARCHAR(200),
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
