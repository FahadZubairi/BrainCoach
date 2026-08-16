import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

const router = Router()

// ── Signup ──
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body

  // Validate input
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  // Check if email already exists
  const existing = await db.select().from(users).where(eq(users.email, email))
  if (existing.length > 0) {
    res.status(400).json({ error: 'Email already registered' })
    return
  }

  // Hash the password — never store plain text passwords
  // bcrypt adds a "salt" (random data) before hashing
  // so two identical passwords produce different hashes
  const hashedPassword = await bcrypt.hash(password, 10)
  // The 10 is the "salt rounds" — higher = more secure but slower

  // Insert user into database
  const [newUser] = await db.insert(users).values({
    email,
    hashedPassword,
  }).returning()

  // Create JWT token
  // JWT = JSON Web Token — a signed string that proves who the user is
  // It contains: { userId, email } + expiry + signature
  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )

  res.status(201).json({
    token,
    user: { id: newUser.id, email: newUser.email }
  })
})

// ── Login ──
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' })
    return
  }

  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  // Compare provided password with stored hash
  // bcrypt.compare handles the salt automatically
  const passwordMatch = await bcrypt.compare(password, user.hashedPassword)
  if (!passwordMatch) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: { id: user.id, email: user.email }
  })
})

export default router