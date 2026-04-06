export type Profile = {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  plan: 'free' | 'pro' | 'elite'
  created_at: string
}

export type Goal = {
  id: string
  user_id: string
  title: string
  category: string
  timeline: string
  why: string
  obstacles?: string
  aesthetic: string
  art_title?: string
  art_description?: string
  affirmation?: string
  milestone_30?: string
  milestone_60?: string
  milestone_90?: string
  coach_opening?: string
  today_action?: string
  streak: number
  longest_streak: number
  progress: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CheckIn = {
  id: string
  goal_id: string
  user_id: string
  note?: string
  mood: number
  created_at: string
}

export type Circle = {
  id: string
  name: string
  category: string
  goal_description: string
  member_count: number
  streak: number
  next_checkin?: string
  created_at: string
}

export type CircleMessage = {
  id: string
  circle_id: string
  user_id: string
  content: string
  is_ai: boolean
  sender_name: string
  created_at: string
}

export type CoachMessage = {
  role: 'user' | 'assistant'
  content: string
}
