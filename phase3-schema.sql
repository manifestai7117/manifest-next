-- ================================================
-- MANIFEST PHASE 3 SCHEMA
-- Run this in Supabase SQL Editor
-- ================================================

-- Profile photo support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_range TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ethnicity TEXT;

-- Plan upgrade fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_trial_started_at TIMESTAMPTZ;

-- Update plan constraint to allow pro_trial
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pro','pro_trial','elite'));

-- Daily chat usage tracking
CREATE TABLE IF NOT EXISTS chat_usage (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  count       INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat usage" ON chat_usage FOR ALL USING (auth.uid() = user_id);

-- Phase completion tracking
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase1_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase1_completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase2_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase2_completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase3_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase3_completed_at TIMESTAMPTZ;

-- Add user personalization to goals (for vision art)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_gender TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_age_range TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_ethnicity TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS vision_art_prompt TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS coach_style TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS motivator TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS best_time TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS success_looks TEXT;

-- Rewards / badges
CREATE TABLE IF NOT EXISTS rewards (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  goal_id     UUID REFERENCES goals(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- 'streak_7','streak_30','phase_complete','goal_complete','first_checkin'
  title       TEXT NOT NULL,
  description TEXT,
  earned_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rewards" ON rewards FOR ALL USING (auth.uid() = user_id);

-- Supabase storage bucket for avatars (create via dashboard too)
-- Storage: create a bucket called "avatars" set to public

-- Function to check/increment chat usage
CREATE OR REPLACE FUNCTION increment_chat_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  INSERT INTO chat_usage (user_id, date, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = chat_usage.count + 1
  RETURNING count INTO current_count;
  RETURN current_count;
END;
$$;

-- Function to get today's chat count
CREATE OR REPLACE FUNCTION get_chat_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT count INTO current_count
  FROM chat_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  RETURN COALESCE(current_count, 0);
END;
$$;
