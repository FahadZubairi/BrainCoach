import type { FocusEventRecord, FocusEventType, SessionOutcome, SessionRecord, SessionStatus } from '../../shared/api'
import { focusEvents, sessions } from './db/schema'

// Database rows → the exact shapes promised in shared/api.ts. The DB allows some nulls and free-text
// enums; the API contract doesn't, so normalisation happens once, here, at the boundary.

type SessionRow = typeof sessions.$inferSelect
type EventRow = typeof focusEvents.$inferSelect

const STATUSES: SessionStatus[] = ['active', 'completed', 'abandoned']
const OUTCOMES: SessionOutcome[] = ['done', 'partly', 'not_done']
const EVENT_TYPES: FocusEventType[] = ['focused', 'lost_focus', 'break']

const oneOf = <T extends string>(allowed: T[], value: string | null, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export function toSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    taskDescription: row.taskDescription,
    energyLevel: row.energyLevel,
    exercisedToday: row.exercisedToday ?? false,
    focusScore: row.focusScore ?? 0,
    status: oneOf(STATUSES, row.status, 'completed'),
    startedAt: (row.startedAt ?? new Date(0)).toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    plannedMinutes: row.plannedMinutes,
    intention: row.intention,
    outcome: row.outcome && OUTCOMES.includes(row.outcome as SessionOutcome) ? (row.outcome as SessionOutcome) : null,
    reflection: row.reflection,
  }
}

export function toEventRecord(row: EventRow): FocusEventRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    type: oneOf(EVENT_TYPES, row.type, 'focused'),
    timestamp: (row.timestamp ?? new Date(0)).toISOString(),
    notes: row.notes,
  }
}
