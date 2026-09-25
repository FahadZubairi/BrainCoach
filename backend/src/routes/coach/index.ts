import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import briefings from './briefings'
import insights from './insights'
import tracking from './tracking'

// /coach/* — AI-assisted endpoints. All require a signed-in user.
const router = Router()
router.use(requireAuth)
router.use(briefings)
router.use(insights)
router.use(tracking)

export default router
