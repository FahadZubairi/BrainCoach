// Daily focus goal: limits and a forgiving parser for what people type.

export const GOAL_OPTIONS = [60, 90, 120, 180, 240]
export const GOAL_MIN = 10
export const GOAL_MAX = 16 * 60

// Accepts "6.5", "6.5h", "6h 30m", "6:30", "390m". A bare number up to 16 is hours, above that minutes.
export function parseGoal(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!s) return null
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{1,2}):([0-5]\d)$/))) return +m[1] * 60 + +m[2]
  if ((m = s.match(/^(\d+(?:\.\d+)?) ?h(?:r|rs|our|ours)? ?(\d+) ?m(?:in|ins|inute|inutes)?$/))) return Math.round(parseFloat(m[1]) * 60) + +m[2]
  if ((m = s.match(/^(\d+(?:\.\d+)?) ?h(?:r|rs|our|ours)?$/))) return Math.round(parseFloat(m[1]) * 60)
  if ((m = s.match(/^(\d+) ?m(?:in|ins|inute|inutes)?$/))) return +m[1]
  if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) {
    const n = parseFloat(m[1])
    return n <= 16 ? Math.round(n * 60) : Math.round(n)
  }
  return null
}
