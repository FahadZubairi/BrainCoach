import { NextFunction, Request, Response } from 'express'

// Last-resort handlers: always answer JSON, never leak stack traces or internals to the client.

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' ? err.status : 500

  // Malformed JSON from express.json(), or a body over the size limit.
  if (status === 400 || status === 413) {
    res.status(status).json({ error: status === 413 ? 'Request body too large' : 'Malformed JSON body' })
    return
  }

  console.error('Unhandled error:', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
}
