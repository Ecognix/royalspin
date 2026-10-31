                        -- Supabase Schema for Royal Spin
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  balance DECIMAL(15,2) DEFAULT 0,
  vault_balance DECIMAL(15,2) DEFAULT 0,
  bonus_balance DECIMAL(15,2) DEFAULT 0,
  bonus_needed DECIMAL(15,2) DEFAULT 0,
  total_wagered DECIMAL(15,2) DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_bets INT DEFAULT 0,
  pnl DECIMAL(15,2) DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  hide_balance BOOLEAN DEFAULT FALSE,
  welcome_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bets table
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  win_amount DECIMAL(15,2) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deposit/Withdrawal requests
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'deposit' or 'withdraw'
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  upi_id VARCHAR(100),
  utr VARCHAR(100),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game config
CREATE TABLE game_config (
  id INT PRIMARY KEY DEFAULT 1,
  edge JSONB NOT NULL DEFAULT '{"dice": 1, "limbo": 1, "mines": 1, "keno": 10, "flip": 2, "crash": 1, "color": 5}',
  enabled JSONB NOT NULL DEFAULT '{"dice": true, "limbo": true, "mines": true, "keno": true, "flip": true, "crash": true, "color": true}',
  min_bet DECIMAL(15,2) DEFAULT 1,
  max_bet DECIMAL(15,2) DEFAULT 100000,
  upi_id VARCHAR(100) DEFAULT '8812862976@ybl',
  welcome_bonus DECIMAL(15,2) DEFAULT 0,
  min_deposit DECIMAL(15,2) DEFAULT 50,
  wager_requirement INT DEFAULT 2,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Color trading bets (current period bets)
CREATE TABLE color_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  period_id BIGINT NOT NULL,
  bet_type VARCHAR(20) NOT NULL, -- 'color', 'num', 'size'
  bet_value VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  settled BOOLEAN DEFAULT FALSE,
  win_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crash bets
CREATE TABLE crash_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  round_id BIGINT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  cashed_out BOOLEAN DEFAULT FALSE,
  cashout_multiplier DECIMAL(10,2),
  win_amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users (predefined)
INSERT INTO users (phone, username, password_hash, name, is_admin, balance) VALUES
('9999999999', 'admin1', '$2a$10$dummyhash1', 'Admin One', TRUE, 1000000),
('8888888888', 'admin2', '$2a$10$dummyhash2', 'Admin Two', TRUE, 1000000),
('7777777777', 'admin3', '$2a$10$dummyhash3', 'Admin Three', TRUE, 1000000),
('6666666666', 'admin4', '$2a$10$dummyhash4', 'Admin Four', TRUE, 1000000)
ON CONFLICT (phone) DO NOTHING;

-- Insert default game config
INSERT INTO game_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_created_at ON bets(created_at DESC);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_requests_user_id ON requests(user_id);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_color_bets_user_period ON color_bets(user_id, period_id);
CREATE INDEX idx_crash_bets_user_round ON crash_bets(user_id, round_id);

-- Public referral validation exposes only the non-admin referrer's UUID.
CREATE OR REPLACE FUNCTION public.get_referrer_id(referral_code UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE id = referral_code AND is_admin = FALSE
$$;
GRANT EXECUTE ON FUNCTION public.get_referrer_id(UUID) TO anon, authenticated;

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_config ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own data
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Bets policies
CREATE POLICY "Users can read own bets" ON bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bets" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all bets" ON bets FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Transactions policies
CREATE POLICY "Users can read own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all transactions" ON transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Requests policies
CREATE POLICY "Users can read own requests" ON requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own requests" ON requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all requests" ON requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins can update requests" ON requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Color bets policies
CREATE POLICY "Users can read own color bets" ON color_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own color bets" ON color_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own color bets" ON color_bets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all color bets" ON color_bets FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Crash bets policies
CREATE POLICY "Users can read own crash bets" ON crash_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crash bets" ON crash_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own crash bets" ON crash_bets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all crash bets" ON crash_bets FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Game config - only admins can update
CREATE POLICY "Anyone can read game config" ON game_config FOR SELECT USING (TRUE);
CREATE POLICY "Admins can update game config" ON game_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);