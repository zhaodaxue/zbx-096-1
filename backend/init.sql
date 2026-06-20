CREATE TABLE IF NOT EXISTS residents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pain_records (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  time_slot INTEGER NOT NULL CHECK (time_slot IN (0, 1, 2, 3)),
  pain_level INTEGER NOT NULL CHECK (pain_level >= 0 AND pain_level <= 10),
  used_slow_release BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resident_id, record_date, time_slot)
);

CREATE TABLE IF NOT EXISTS med_adjustment_days (
  id SERIAL PRIMARY KEY,
  resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  adjust_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resident_id, adjust_date)
);

INSERT INTO residents (name, room_number, is_archived) VALUES
  ('张大爷', '101', FALSE),
  ('李奶奶', '102', FALSE),
  ('王爷爷', '103', TRUE)
ON CONFLICT DO NOTHING;
