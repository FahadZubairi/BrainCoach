import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRouter from './routes/auth'
import sessionsRouter from './routes/sessions'
import coachRouter from './routes/coach'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)
app.use('/sessions', sessionsRouter)
app.use('/coach', coachRouter)

app.get('/health', (req, res) => {
  res.json({ status: 'BrainCoach API running' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})