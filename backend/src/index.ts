import { config } from './config' // first: validates the environment before anything else loads
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import sessionsRouter from './routes/sessions'
import coachRouter from './routes/coach'
import { errorHandler, notFound } from './middleware/errors'

const app = express()
app.disable('x-powered-by')
if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY)

// Only the web app may call the API from a web page. The BrainCoach extension doesn't need CORS
// (its host_permissions bypass it), and allowing chrome-extension:// origins would let *other*
// extensions make cookie-authenticated requests. Requests without an Origin still need a valid credential.
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, false)
    }
  },
  credentials: true, // the web app authenticates with an httpOnly cookie
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}))

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

// Screen-check frames are small JPEGs (~50–150 KB as base64); every other body stays tiny.
app.use('/coach/evaluate-screen', express.json({ limit: '1mb' }))
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'BrainCoach API running' })
})

app.use('/auth', authRouter)
app.use('/sessions', sessionsRouter)
app.use('/coach', coachRouter)

app.use(notFound)
app.use(errorHandler)

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`)
})
