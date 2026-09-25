import { z } from 'zod'

// Runtime schemas for every request body, param and query the API accepts.
// Limits are generous for real use but cap abuse (huge strings, out-of-range numbers).

const text = (max: number) => z.string().trim().max(max)
// For data we don't control the size of (tab URLs/titles, AI keyword lists): accept and truncate
// rather than reject, so one long Google URL can't break tab tracking.
const clamped = (max: number) => z.string().transform(s => s.trim().slice(0, max))
const clampedList = (maxItems: number, maxLen: number) =>
  z.array(z.unknown()).transform(items => items.filter((i): i is string => typeof i === 'string').slice(0, maxItems).map(i => i.slice(0, maxLen)))

export const Credentials = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string().min(1, 'Password is required').max(200),
})

export const Signup = Credentials.extend({
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

export const SessionIdParams = z.object({
  sessionId: z.coerce.number().int().positive(),
})

export const StartSession = z.object({
  taskDescription: text(200).min(1, 'Task description is required'),
  energyLevel: z.number().int().min(1).max(5),
  exercisedToday: z.boolean().optional().default(false),
  plannedMinutes: z.number().int().min(1).max(600).nullish(),
  intention: text(200).nullish(),
})

export const EventType = z.enum(['focused', 'lost_focus', 'break'])

export const LogEvent = z.object({
  type: EventType,
  notes: text(500).nullish(),
})

export const EndSession = z.object({
  status: z.enum(['completed', 'abandoned']).default('completed'),
  focusScore: z.number().finite().min(0).max(100).optional(),
})

export const Reflection = z.object({
  outcome: z.enum(['done', 'partly', 'not_done']),
  reflection: text(500).nullish(),
})

export const DailyQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  // Browser getTimezoneOffset(): minutes, within ±14h
  tz: z.coerce.number().int().min(-840).max(840).optional().default(0),
})

export const PreSession = z.object({
  taskDescription: text(200).min(1),
  energyLevel: z.number().int().min(1).max(5),
  exercisedToday: z.boolean().optional().default(false),
})

export const DailyCheckin = z.object({
  energyLevel: z.number().int().min(1).max(5),
  sessionsToday: z.number().int().min(0).max(1000).default(0),
  avgFocusScore: z.number().min(0).max(100).default(0),
  completedSessions: z.number().int().min(0).max(100000).default(0),
})

export const SessionProfileRequest = z.object({
  taskDescription: text(200).min(1),
})

export const SessionProfile = z.object({
  sessionType: clamped(40).optional(),
  allowedKeywords: clampedList(80, 80).default([]),
  forbiddenCategories: clampedList(80, 80).default([]),
  strictness: clamped(20).optional(),
  taskSummary: clamped(300).optional(),
})

export const EvaluateTab = z.object({
  tabTitle: clamped(500).default(''),
  tabUrl: clamped(2048).default(''),
  taskDescription: clamped(200).default(''),
  // A malformed profile shouldn't block classification; fall back to no profile.
  sessionProfile: SessionProfile.nullish().catch(null),
})

export const EvaluateScreen = z.object({
  // ~1 MB body limit is set in index.ts; this also pins the format.
  image: z.string().startsWith('data:image/jpeg;base64,', 'image must be a JPEG data URL').max(1_400_000),
  taskDescription: text(200).default(''),
})
