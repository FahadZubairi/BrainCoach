import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  coachName: text('coach_name').default('Coach'),
  totalSessions: integer('total_sessions').default(0),
  longestStreak: integer('longest_streak').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  taskDescription: text('task_description').notNull(),
  energyLevel: integer('energy_level').notNull(),
  exercisedToday: boolean('exercised_today').default(false),
  focusScore: integer('focus_score').default(0),
  status: text('status').default('active'), // active / completed / abandoned
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
})

export const focusEvents = pgTable('focus_events', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull(),
  type: text('type').notNull(), // focused / lost_focus / break
  timestamp: timestamp('timestamp').defaultNow(),
  notes: text('notes'),
})

export const patterns = pgTable('patterns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  analysis: text('analysis').notNull(),
  keyInsights: text('key_insights').notNull(), // JSON string
  generatedAt: timestamp('generated_at').defaultNow(),
})