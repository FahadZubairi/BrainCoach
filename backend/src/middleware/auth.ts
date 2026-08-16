import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'


export interface AuthRequest extends Request {
  user?: { userId: number; email: string }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Get token from Authorization header
  // Frontend sends: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  const token = authHeader.split(' ')[1] // Extract token after "Bearer "

  try {
    // Verify the token using our secret key
    // If token was tampered with or expired, this throws an error
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
      email: string
    }

    // Attach user data to request so route handlers can use it
    req.user = payload
    next() // Continue to the actual route handler
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}