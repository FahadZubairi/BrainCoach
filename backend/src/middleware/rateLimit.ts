import { NextFunction, Request, Response } from 'express'

/**
 * Small fixed-window, in-memory rate limiter keyed by client IP.
 * Good enough for one server instance; use a shared store (e.g. Redis) if the API is ever scaled out.
 */
export function rateLimit({ windowMs, max, message }: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>()

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const key = req.ip ?? 'unknown'
    const entry = hits.get(key)

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      }
      return next()
    }

    entry.count++
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
      res.status(429).json({ error: message })
      return
    }
    next()
  }
}
