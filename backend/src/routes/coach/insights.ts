import { Router, Response } from 'express'
import { desc, eq } from 'drizzle-orm'
import { SchemaType } from '@google/generative-ai'
import { z } from 'zod'
import type { ErrorResponse, InsightsResponse } from '../../../../shared/api'
import { db } from '../../db'
import { patterns, sessions } from '../../db/schema'
import { AuthRequest } from '../../middleware/auth'
import { COACH_VOICE, generateJson } from '../../services/gemini'

// AI pattern analysis over the user's recent finished sessions.
const router = Router()

const MIN_SESSIONS = 3

const Analysis = z.object({
  strengths: z.string(),
  weaknesses: z.string(),
  exercise_impact: z.string(),
  recommendation: z.string(),
  coach_message: z.string(),
})

router.get('/insights', async (req: AuthRequest, res: Response<InsightsResponse | ErrorResponse>) => {
  const userId = req.user!.userId

  const recent = await db.select().from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.startedAt))
    .limit(20)

  const finished = recent.filter(s => s.status !== 'active')
  if (finished.length < MIN_SESSIONS) {
    res.json({ remaining: MIN_SESSIONS - finished.length, patterns: null })
    return
  }

  const data = finished.map(s => {
    const mins = s.endedAt && s.startedAt ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60000) : 0
    const hour = s.startedAt ? s.startedAt.getHours() : 'unknown'
    return `Task: "${s.taskDescription}", Energy: ${s.energyLevel}/5, Exercised: ${s.exercisedToday}, Focus: ${s.focusScore}/100, `
      + `Status: ${s.status}, Duration: ${mins} min${s.plannedMinutes ? ` of ${s.plannedMinutes} planned` : ''}, Start hour: ${hour}`
      + `${s.outcome ? `, Self-reported: ${s.outcome}` : ''}${s.reflection ? ` ("${s.reflection}")` : ''}`
  }).join('\n')

  const raw = await generateJson(`${COACH_VOICE}

Session history (most recent first):
${data}

Analyse these sessions. Each field is 1-2 sentences and must reference concrete patterns in the data
(times of day, energy, exercise, task types, completion). coach_message is a one-sentence summary.`, {
    type: SchemaType.OBJECT,
    properties: {
      strengths: { type: SchemaType.STRING },
      weaknesses: { type: SchemaType.STRING },
      exercise_impact: { type: SchemaType.STRING },
      recommendation: { type: SchemaType.STRING },
      coach_message: { type: SchemaType.STRING },
    },
    required: ['strengths', 'weaknesses', 'exercise_impact', 'recommendation', 'coach_message'],
  })

  // Model output is untrusted input too: validate its shape before storing or returning it.
  const analysis = Analysis.safeParse(raw)
  if (!analysis.success) {
    res.status(503).json({ error: 'The coach is unavailable right now. Please try again in a minute.' })
    return
  }

  await db.insert(patterns).values({
    userId,
    analysis: analysis.data.coach_message,
    keyInsights: JSON.stringify(analysis.data),
  })

  res.json({ remaining: 0, patterns: analysis.data })
})

export default router
