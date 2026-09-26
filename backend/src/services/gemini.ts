import { GoogleGenerativeAI, ResponseSchema } from '@google/generative-ai'
import { config } from '../config'

// Thin wrapper around Gemini. Every call returns null on failure so callers can fall back to safe
// defaults: an AI outage must never block a session or penalise the user.

const genai = config.GEMINI_API_KEY ? new GoogleGenerativeAI(config.GEMINI_API_KEY) : null

export const aiAvailable = () => genai !== null

export const COACH_VOICE = `You are Kai, a calm, perceptive focus coach. You speak plainly and briefly,
like a good mentor: specific, warm, never hype, no emojis, no exclamation marks.`

export async function generateText(prompt: string): Promise<string | null> {
  if (!genai) return null
  try {
    const model = genai.getGenerativeModel({ model: config.GEMINI_MODEL })
    const result = await model.generateContent(prompt)
    return result.response.text().trim() || null
  } catch (error) {
    console.error('Gemini text error:', error)
    return null
  }
}

/** Structured output. `image` (base64 JPEG, no data: prefix) makes it a vision call. */
export async function generateJson(prompt: string, schema: ResponseSchema, image?: string, fast = false): Promise<unknown | null> {
  if (!genai) return null
  try {
    const model = genai.getGenerativeModel({
      model: fast ? config.GEMINI_FAST_MODEL : config.GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    })
    const parts = image ? [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: image } }] : prompt
    const result = await model.generateContent(parts)
    return JSON.parse(result.response.text()) as unknown
  } catch (error) {
    console.error('Gemini JSON error:', error)
    return null
  }
}
