-- Run this in Supabase Dashboard > SQL Editor BEFORE deploying the new code.
-- Creates the canonical color_results table used to store settled period results.

CREATE TABLE IF NOT EXISTS color_results (
  period_id BIGINT PRIMARY KEY,
  winning_number INT NOT NULL,
  total_bets DECIMAL(15,2) DEFAULT 0,
  total_payout DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE color_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read color results"
  ON color_results FOR SELECT USING (true);

CREATE POLICY "Anyone can insert color results"
  ON color_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update color results"
  ON color_results FOR UPDATE USING (true);
