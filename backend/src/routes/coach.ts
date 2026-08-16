import { Router, Response } from 'express'
import { db } from '../db'
import { sessions, focusEvents, patterns } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const router = Router()
router.use(requireAuth)

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Pre-session coach message
router.post('/pre-session', async (req: AuthRequest, res: Response) => {
  const { taskDescription, energyLevel, exercisedToday } = req.body

  try {
    const recentSessions = await db.select().from(sessions)
      .where(eq(sessions.userId, req.user!.userId))
      .orderBy(desc(sessions.startedAt))
      .limit(5)

    const sessionSummary = recentSessions.length > 0
      ? recentSessions.map(s =>
          `Task: ${s.taskDescription}, Energy: ${s.energyLevel}/5, Focus Score: ${s.focusScore}/100, Status: ${s.status}`
        ).join('\n')
      : 'No previous sessions yet — this is their first session.'

    const prompt = `You are an anime-style fitness coach AI named Coach Kai. 
You're hyped, direct, and genuinely care about the user's performance.
Keep responses SHORT (2-3 sentences max). Use sports/training metaphors.

User's recent session history:
${sessionSummary}

They're about to start a session with:
- Task: ${taskDescription}
- Energy level: ${energyLevel}/5
- Exercised today: ${exercisedToday}

Give them a personalized pre-session pep talk based on their history and current state.
If energy is low (1-2), acknowledge it and give tactical advice.
If they exercised, hype that up.
Be specific to their task, not generic.`

    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)
    const message = result.response.text()

    res.json({ message })
  } catch (error) {
    console.error('Gemini API Error:', error)
    res.status(500).json({ error: 'Failed to generate coach message' })
  }
})

// Pattern analysis with Schema Validation
router.get('/insights', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId

  try {
    const allSessions = await db.select().from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.startedAt))
      .limit(20)

    if (allSessions.length < 3) {
      res.json({
        message: "Complete at least 3 sessions and I'll start identifying your patterns.",
        patterns: null
      })
      return
    }

    const sessionData = allSessions.map(s =>
      `Task: "${s.taskDescription}", Energy: ${s.energyLevel}/5, Exercised: ${s.exercisedToday}, Score: ${s.focusScore}/100, Status: ${s.status}, Duration: ${s.endedAt && s.startedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000) : 0} mins`
    ).join('\n')

    const prompt = `You are Coach Kai, an AI productivity coach analyzing a user's focus patterns.

Session history (most recent first):
${sessionData}

Analyze these sessions and identify strengths, weaknesses, exercise impact, a specific recommendation, and a coach summary message.`

    // Enforce JSON schema directly with Gemini SDK
    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            strengths: { type: SchemaType.STRING },
            weaknesses: { type: SchemaType.STRING },
            exercise_impact: { type: SchemaType.STRING },
            recommendation: { type: SchemaType.STRING },
            coach_message: { type: SchemaType.STRING },
          },
          required: ["strengths", "weaknesses", "exercise_impact", "recommendation", "coach_message"]
        }
      }
    })

    const result = await model.generateContent(prompt)
    const analysis = JSON.parse(result.response.text())

    await db.insert(patterns).values({
      userId,
      analysis: analysis.coach_message,
      keyInsights: JSON.stringify(analysis),
    })

    res.json({ message: analysis.coach_message, patterns: analysis })
  } catch (error) {
    console.error('Insights Error:', error)
    res.status(500).json({ message: "Failed to generate insights.", patterns: null })
  }
})

export default router