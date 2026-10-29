CREATE TABLE IF NOT EXISTS daily_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  page_path TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, page_path, source, target)
);

CREATE INDEX IF NOT EXISTS daily_counts_day_idx ON daily_counts(day);
