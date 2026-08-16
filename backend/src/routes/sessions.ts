import { Router, Response } from 'express';
import { db } from '../db';
import { sessions, focusEvents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { StringDecoder } from 'node:string_decoder';
const router = Router();
router.use(requireAuth)

// start a new session
router.post('/start', async (req: AuthRequest, res: Response) => {
    const { taskDescription, energyLevel, exercisedToday } = req.body
    if (!taskDescription || !energyLevel){
        res.status(400).json({error: 'Task Description and energy level required' })
        return
    }

    if (energyLevel < 1 || energyLevel > 5){
        res.status(400).json({error: 'Energy level must be between 1 and 5'})
        return 
    }
    const [session] = await db.insert(sessions).values({
        userId: req.user!.userId,
        taskDescription,
        energyLevel,
        exercisedToday: exercisedToday || false,
        status: 'active',
    }).returning()
    res.status(201).json({ session })
})

// Log a focus event 
router.post('/:sessionId/event', async (req: AuthRequest, res: Response) =>{
    const sessionId = parseInt(req.params.sessionId as string)
    const { type, notes } = req.body
    const [session] = await db.select().from(sessions)
    .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, req.user!.userId)
    ))
    if (!session){
        res.status(404).json({error: 'Session not found'})
        return 

    }
    const [event] = await db.insert(focusEvents).values({
        sessionId,
        type,
        notes: notes || null,
    }).returning()
    res.status(201).json({event})
})

// End a session
router.patch('/sessionId/end', async (req: AuthRequest, res: Response) => {
    const sessionId = parseInt(req.params.sessionId as string)
    const { status } = req.body
    const events = await db.select().from(focusEvents)
    .where(eq(focusEvents.sessionId, sessionId))

    const FocusedCount = events.filter(e => e.type == 'focused').length 
    const lostCount = events.filter(e => e.type == 'lost_focus').length
    const total = FocusedCount + lostCount
    const focusScore = total > 0 ? Math.round((FocusedCount/total)*100) : 50 
    
    const [updated] = await db.update(sessions).set({
        status: status || 'completed',
        endedAt: new Date(),
        focusScore
    })
    .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, req.user!.userId)
    )).returning()
    res.json({ session: updated })
})

//get session history 
router.get('/history', async (req: AuthRequest, res: Response) =>{
    const userSessions = await db.select().from(sessions)
    .where(eq(sessions.userId, req.user!.userId))
    .orderBy(sessions.startedAt)
    .limit(20)
    res.json({ sessions: userSessions })

})
export default router