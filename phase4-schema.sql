-- ================================================
-- MANIFEST PHASE 4 SCHEMA
-- Run this ENTIRE block in Supabase SQL Editor
-- ================================================

-- Fix profiles RLS to allow avatar_url updates
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- Add missing profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_range TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ethnicity TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_trial_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS friend_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_rewards INTEGER DEFAULT 0;

-- Update plan constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check 
  CHECK (plan IN ('free','pro','pro_trial','elite'));

-- Fix Supabase Storage RLS for avatars bucket
-- (Run this separately if needed: create bucket 'avatars' as PUBLIC in Supabase dashboard)

-- Add goal display title (AI-generated smart title)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS display_title TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase1_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase1_completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase2_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase2_completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase3_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS phase3_completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_gender TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_age_range TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_ethnicity TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS vision_art_prompt TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS coach_style TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS motivator TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS best_time TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS success_looks TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS vision_board_last_generated TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS vision_board_regenerations INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completion_public BOOLEAN DEFAULT TRUE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS original_timeline TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS extended_from TEXT;

-- Chat usage
CREATE TABLE IF NOT EXISTS chat_usage (
  id       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date     DATE NOT NULL DEFAULT CURRENT_DATE,
  count    INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own chat usage" ON chat_usage;
CREATE POLICY "Users manage own chat usage" ON chat_usage FOR ALL USING (auth.uid() = user_id);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  goal_id     UUID REFERENCES goals(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  emoji       TEXT DEFAULT '🏅',
  earned_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own rewards" ON rewards;
CREATE POLICY "Users view own rewards" ON rewards FOR ALL USING (auth.uid() = user_id);

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status    TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester, addressee)
);
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own friendships" ON friendships;
CREATE POLICY "Users manage own friendships" ON friendships 
  FOR ALL USING (auth.uid() = requester OR auth.uid() = addressee);

-- Direct messages
CREATE TABLE IF NOT EXISTS direct_messages (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content      TEXT NOT NULL,
  read         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own DMs" ON direct_messages;
CREATE POLICY "Users see own DMs" ON direct_messages 
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Enhanced circles with admin + privacy
DROP TABLE IF EXISTS circle_messages CASCADE;
DROP TABLE IF EXISTS circle_members CASCADE;

CREATE TABLE IF NOT EXISTS circles (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  goal_description TEXT NOT NULL,
  member_count     INTEGER DEFAULT 0,
  streak           INTEGER DEFAULT 0,
  next_checkin     TEXT,
  is_public        BOOLEAN DEFAULT TRUE,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ai_verified      BOOLEAN DEFAULT FALSE,
  invite_only      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view circles" ON circles;
CREATE POLICY "Anyone can view public circles" ON circles FOR SELECT USING (is_public = TRUE OR created_by = auth.uid());
CREATE POLICY "Creators can update circles" ON circles FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Authenticated users can create circles" ON circles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Circle members with ranking score
CREATE TABLE circle_members (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id  UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       TEXT DEFAULT 'member' CHECK (role IN ('admin','member')),
  score      INTEGER DEFAULT 0,
  rank       INTEGER DEFAULT 0,
  checkin_count INTEGER DEFAULT 0,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memberships" ON circle_members FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Members can view circle memberships" ON circle_members FOR SELECT USING (TRUE);

-- Circle join requests (for private circles)
CREATE TABLE IF NOT EXISTS circle_requests (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status    TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);
ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own requests" ON circle_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Circle admins see requests" ON circle_requests FOR SELECT USING (
  EXISTS(SELECT 1 FROM circle_members WHERE circle_id = circle_requests.circle_id AND user_id = auth.uid() AND role = 'admin')
);

-- Circle invitations
CREATE TABLE IF NOT EXISTS circle_invitations (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  circle_id   UUID REFERENCES circles(id) ON DELETE CASCADE NOT NULL,
  invited_by  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invited_user UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, invited_user)
);
ALTER TABLE circle_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own invitations" ON circle_invitations 
  FOR ALL USING (auth.uid() = invited_user OR auth.uid() = invited_by);

-- Circle messages
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
CREATE POLICY "Circle messages readable by all" ON circle_messages FOR SELECT USING (TRUE);
CREATE POLICY "Auth users can insert messages" ON circle_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR is_ai = TRUE);

-- Success stories
CREATE TABLE IF NOT EXISTS success_stories (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  goal_title  TEXT NOT NULL,
  quote       TEXT NOT NULL,
  is_public   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public stories visible to all" ON success_stories FOR SELECT USING (is_public = TRUE);
CREATE POLICY "Users manage own stories" ON success_stories FOR ALL USING (auth.uid() = user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL,
  content    TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Seed default public circles
INSERT INTO circles (name, category, goal_description, member_count, streak, next_checkin, is_public, ai_verified) VALUES
  ('Marathon Runners Circle',  'Health & fitness',   'Complete first marathon under 4 hours', 5, 14, 'Tomorrow 8am', TRUE, TRUE),
  ('First-Time Founders',      'Career & business',  'Launch an MVP and get first 10 customers', 4, 7, 'Friday 6pm', TRUE, TRUE),
  ('Financial Freedom Club',   'Financial freedom',  'Save first $50,000 emergency fund', 6, 21, 'Sunday 7pm', TRUE, TRUE),
  ('Creative Writers Cohort',  'Creative work',      'Write and finish a full novel or memoir', 5, 5, 'Wednesday 9pm', TRUE, TRUE),
  ('Weight Loss Warriors',     'Health & fitness',   'Lose 30 lbs sustainably, keep it off', 6, 30, 'Monday 7am', TRUE, TRUE),
  ('Career Changers',          'Personal growth',    'Successfully transition into a new career', 4, 12, 'Thursday 8pm', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Function to compute circle rank
CREATE OR REPLACE FUNCTION update_circle_ranks(p_circle_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE circle_members
  SET rank = r.rank
  FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY score DESC) as rank
    FROM circle_members
    WHERE circle_id = p_circle_id
  ) r
  WHERE circle_members.circle_id = p_circle_id 
    AND circle_members.user_id = r.user_id;
END;
$$;

-- Function to increment chat usage
CREATE OR REPLACE FUNCTION increment_chat_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_count INTEGER;
BEGIN
  INSERT INTO chat_usage (user_id, date, count) VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) DO UPDATE SET count = chat_usage.count + 1
  RETURNING count INTO current_count;
  RETURN current_count;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE circle_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
