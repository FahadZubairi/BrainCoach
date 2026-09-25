import { Router, Response } from 'express'
import { desc, eq } from 'drizzle-orm'
import type { MessageResponse } from '../../../../shared/api'
import { db } from '../../db'
import { sessions } from '../../db/schema'
import { parse } from '../../http'
import { AuthRequest } from '../../middleware/auth'
import { DailyCheckin, PreSession } from '../../schemas'
import { COACH_VOICE, generateText } from '../../services/gemini'

// Short coach messages: before a session, and the daily energy check-in.
const router = Router()

router.post('/pre-session', async (req: AuthRequest, res: Response<MessageResponse>) => {
  const body = parse(PreSession, req.body, res)
  if (!body) return

  const recent = await db.select().from(sessions)
    .where(eq(sessions.userId, req.user!.userId))
    .orderBy(desc(sessions.startedAt))
    .limit(5)

  const history = recent.length
    ? recent.map(s => `Task: ${s.taskDescription}, Energy: ${s.energyLevel}/5, Focus: ${s.focusScore}/100, Status: ${s.status}`).join('\n')
    : 'No previous sessions yet.'

  const message = await generateText(`${COACH_VOICE}

Recent sessions:
${history}

They are about to start:
- Task: ${body.taskDescription}
- Energy: ${body.energyLevel}/5
- Exercised today: ${body.exercisedToday}

In at most 2 short sentences, give one concrete, tactical suggestion for this session
based on their history and energy. Be specific to the task.`)

  res.json({
    message: message ?? (body.energyLevel <= 2
      ? 'Energy is low, so keep the scope small: pick one concrete deliverable and stop when it is done.'
      : 'Close everything unrelated, define what done looks like, and start with the hardest part.'),
  })
})

const CHECKIN_FALLBACK: Record<number, string> = {
  1: 'Protect what little energy you have: one 20-minute session on the easiest meaningful task, then rest.',
  2: 'Go short and specific today. Two 25-minute sessions with a real break between them.',
  3: 'A steady day. Plan two 45-minute sessions and decide the first task before you start.',
  4: 'Good energy. Put your hardest task in the first block while it lasts.',
  5: 'This is a deep-work day. Block 90 minutes for the task that matters most and silence everything else.',
}

router.post('/daily-checkin', async (req: AuthRequest, res: Response<MessageResponse>) => {
  const body = parse(DailyCheckin, req.body, res)
  if (!body) return

  const message = await generateText(`${COACH_VOICE}

User today:
- Energy: ${body.energyLevel}/5
- Sessions started today: ${body.sessionsToday}
- Sessions completed overall: ${body.completedSessions}
- Average focus score: ${body.avgFocusScore}%

In at most 2 short sentences, suggest a plan for today that fits their energy.
Low energy (1-2): fewer, shorter sessions. High energy (4-5): one long deep-work block.
If average focus is below 60%, name one concrete way to protect attention.`)

  res.json({ message: message ?? CHECKIN_FALLBACK[body.energyLevel] })
})

export default router
