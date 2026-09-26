// Grabs one frame from a screen-share track as a downscaled JPEG data URL.
//
// Why ImageCapture: a <video> element playing the stream is throttled by Chrome while the BrainCoach tab
// is in the background, so drawing it to a canvas returns a stale frame (often the BrainCoach page itself,
// which then gets judged "on task"). ImageCapture.grabFrame() reads the live frame from the track.

const FRAME_WIDTH = 768 // enough to read an app or site name; smaller uploads answer faster
const JPEG_QUALITY = 0.6
// A 32×18 greyscale thumbnail, compared locally so an unchanged screen isn't re-sent to the AI.
const PRINT_W = 32
const PRINT_H = 18

export interface Frame {
  image: string // JPEG data URL
  print: Uint8ClampedArray
}

interface ImageCaptureLike {
  grabFrame(): Promise<ImageBitmap>
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike

function fingerprint(source: CanvasImageSource): Uint8ClampedArray | null {
  const canvas = document.createElement('canvas')
  canvas.width = PRINT_W
  canvas.height = PRINT_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, PRINT_W, PRINT_H)
  const rgba = ctx.getImageData(0, 0, PRINT_W, PRINT_H).data
  const grey = new Uint8ClampedArray(PRINT_W * PRINT_H)
  for (let i = 0; i < grey.length; i++) grey[i] = (rgba[i * 4] * 3 + rgba[i * 4 + 1] * 6 + rgba[i * 4 + 2]) / 10
  return grey
}

/** Mean per-pixel difference between two fingerprints, 0 (identical) to 255. */
export function frameDistance(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

function toFrame(source: CanvasImageSource, width: number, height: number): Frame | null {
  const image = toJpeg(source, width, height)
  const print = image ? fingerprint(source) : null
  return image && print ? { image, print } : null
}

function toJpeg(source: CanvasImageSource, width: number, height: number): string | null {
  if (!width || !height) return null
  const scale = Math.min(1, FRAME_WIDTH / width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

async function viaImageCapture(track: MediaStreamTrack): Promise<Frame | null> {
  const Ctor = (globalThis as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture
  if (!Ctor) return null
  const bitmap = await new Ctor(track).grabFrame()
  try {
    return toFrame(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

// Fallback for browsers without ImageCapture (e.g. Firefox): a short-lived <video>, awaited until it has
// a frame. Less reliable in background tabs, which is why it's only the fallback.
async function viaVideo(track: MediaStreamTrack): Promise<Frame | null> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream([track])
  try {
    await video.play()
    if (video.readyState < 2) await new Promise(resolve => video.addEventListener('loadeddata', resolve, { once: true }))
    return toFrame(video, video.videoWidth, video.videoHeight)
  } finally {
    video.pause()
    video.srcObject = null
  }
}

export async function grabFrame(track: MediaStreamTrack): Promise<Frame | null> {
  if (track.readyState !== 'live') return null
  try {
    return (await viaImageCapture(track)) ?? (await viaVideo(track))
  } catch {
    try {
      return await viaVideo(track)
    } catch {
      return null
    }
  }
}
