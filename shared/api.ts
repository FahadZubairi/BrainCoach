// Shared API contract between backend/ and frontend/. The single source of truth for what crosses
// the wire. Import with `import type` only: this file must stay free of runtime code so neither
// build has to bundle it.

// ── Auth ──
export interface PublicUser {
  id: number
  email: string
}

export interface AuthResponse {
  user: PublicUser
}

export interface ExtensionTokenResponse {
  token: string
  expiresInSeconds: number
}

// ── Sessions ──
export type SessionStatus = 'active' | 'completed' | 'abandoned'
export type SessionOutcome = 'done' | 'partly' | 'not_done'
export type FocusEventType = 'focused' | 'lost_focus' | 'break'

export interface SessionRecord {
  id: number
  userId: number
  taskDescription: string
  energyLevel: number
  exercisedToday: boolean
  focusScore: number
  status: SessionStatus
  startedAt: string
  endedAt: string | null
  plannedMinutes: number | null
  intention: string | null
  outcome: SessionOutcome | null
  reflection: string | null
}

export interface FocusEventRecord {
  id: number
  sessionId: number
  type: FocusEventType
  timestamp: string
  notes: string | null
}

export interface StartSessionRequest {
  taskDescription: string
  energyLevel: number
  exercisedToday?: boolean
  plannedMinutes?: number | null
  intention?: string | null
}

export interface SessionResponse {
  session: SessionRecord
}

export interface HistoryResponse {
  sessions: SessionRecord[]
}

export interface EventsResponse {
  events: FocusEventRecord[]
}

export interface StatsResponse {
  sessionsToday: number
  totalSessions: number
  avgFocusScore: number
  completedSessions: number
  focusMinutesToday: number
}

export interface DailyResponse {
  year: number
  years: number[]
  days: Record<string, { minutes: number; sessions: number }>
}

// ── Coach ──
export interface MessageResponse {
  message: string
}

export interface InsightAnalysis {
  strengths: string
  weaknesses: string
  exercise_impact: string
  recommendation: string
  coach_message: string
}

export interface InsightsResponse {
  remaining: number
  patterns: InsightAnalysis | null
}

export interface SessionProfile {
  sessionType?: string
  allowedKeywords: string[]
  forbiddenCategories: string[]
  strictness?: string
  taskSummary?: string
}

export interface SessionProfileResponse {
  profile: SessionProfile
}

export interface TabVerdict {
  relevant: boolean
  reason: string
}

export interface TabRules {
  alwaysRelevant: string[]
  distracting: string[]
  stopwords: string[]
}

export interface ScreenVerdict {
  relevant: boolean
  activity: string
  app: string
  /** true when the AI couldn't analyse the frame; the client treats it as neutral */
  unavailable?: boolean
}

export interface ErrorResponse {
  error: string
}
