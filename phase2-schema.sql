-- ================================================
-- MANIFEST PHASE 2 SCHEMA
-- Run this in Supabase SQL Editor (adds to existing schema)
-- ================================================

-- ── FRIENDSHIPS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester, addressee)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own friendships" ON friendships FOR ALL USING (auth.uid() = requester OR auth.uid() = addressee);

-- ── DIRECT MESSAGES ──────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content      TEXT NOT NULL,
  read         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own DMs" ON direct_messages FOR ALL USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- ── GOAL HISTORY (for completed/extended goals) ──
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS extended_from TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS original_timeline TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS vision_board_last_generated TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS vision_board_regenerations INTEGER DEFAULT 0;

-- ── DYNAMIC HERO STORIES ─────────────────────────
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

-- ── NOTIFICATIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL, -- 'friend_request','goal_completed','streak_milestone','dm'
  content     TEXT NOT NULL,
  link        TEXT,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Enable realtime for DMs and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
