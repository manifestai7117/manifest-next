-- ================================================
-- MANIFEST DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────
CREATE TABLE profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','elite')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── GOALS ─────────────────────────────────────────
CREATE TABLE goals (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title            TEXT NOT NULL,
  category         TEXT NOT NULL,
  timeline         TEXT NOT NULL,
  why              TEXT NOT NULL,
  obstacles        TEXT,
  aesthetic        TEXT NOT NULL DEFAULT 'Minimal & clean',
  art_title        TEXT,
  art_description  TEXT,
  affirmation      TEXT,
  milestone_30     TEXT,
  milestone_60     TEXT,
  milestone_90     TEXT,
  coach_opening    TEXT,
  today_action     TEXT,
  streak           INTEGER DEFAULT 0,
  longest_streak   INTEGER DEFAULT 0,
  progress         INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  last_checkin     DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON goals FOR ALL USING (auth.uid() = user_id);

-- ── CHECK-INS ─────────────────────────────────────
CREATE TABLE checkins (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id    UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  note       TEXT,
  mood       INTEGER DEFAULT 3 CHECK (mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own checkins" ON checkins FOR ALL USING (auth.uid() = user_id);

-- ── COACH CONVERSATIONS ───────────────────────────
CREATE TABLE coach_messages (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  goal_id    UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own coach messages" ON coach_messages FOR ALL USING (auth.uid() = user_id);

-- ── CIRCLES ───────────────────────────────────────
CREATE TABLE circles (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  goal_description TEXT NOT NULL,
  member_count     INTEGER DEFAULT 0,
  streak           INTEGER DEFAULT 0,
  next_checkin     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view circles" ON circles FOR SELECT USING (TRUE);

-- ── CIRCLE MEMBERSHIPS ────────────────────────────
CREATE TABLE circle_members (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id  UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memberships" ON circle_members FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Members can view circle memberships" ON circle_members FOR SELECT USING (TRUE);

-- ── CIRCLE MESSAGES ───────────────────────────────
CREATE TABLE circle_messages (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id    UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id),
  sender_name  TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_ai        BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE circle_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Circle members can read messages" ON circle_messages FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can insert messages" ON circle_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR is_ai = TRUE);

-- ── SEED CIRCLES ─────────────────────────────────
INSERT INTO circles (name, category, goal_description, member_count, streak, next_checkin) VALUES
  ('Marathon Runners Circle',  'Health & fitness',   'Complete first marathon under 4 hours', 5, 14, 'Tomorrow 8am'),
  ('First-Time Founders',      'Career & business',  'Launch an MVP and get first 10 customers', 4, 7, 'Friday 6pm'),
  ('Financial Freedom Club',   'Financial freedom',  'Save first $50,000 emergency fund', 6, 21, 'Sunday 7pm'),
  ('Creative Writers Cohort',  'Creative work',      'Write and finish a full novel or memoir', 5, 5, 'Wednesday 9pm'),
  ('Weight Loss Warriors',     'Health & fitness',   'Lose 30 lbs sustainably, keep it off', 6, 30, 'Monday 7am'),
  ('Career Changers',          'Personal growth',    'Successfully transition into a new career', 4, 12, 'Thursday 8pm');

-- ── ENABLE REALTIME ───────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE circle_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE checkins;

-- ── UPDATE TIMESTAMPS TRIGGER ─────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
