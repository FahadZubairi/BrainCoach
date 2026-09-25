// Grabs one frame from a screen-share track as a downscaled JPEG data URL.
//
// Why ImageCapture: a <video> element playing the stream is throttled by Chrome while the BrainCoach tab
// is in the background, so drawing it to a canvas returns a stale frame (often the BrainCoach page itself,
// which then gets judged "on task"). ImageCapture.grabFrame() reads the live frame from the track.

const FRAME_WIDTH = 960
const JPEG_QUALITY = 0.6

interface ImageCaptureLike {
  grabFrame(): Promise<ImageBitmap>
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike

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

async function viaImageCapture(track: MediaStreamTrack): Promise<string | null> {
  const Ctor = (globalThis as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture
  if (!Ctor) return null
  const bitmap = await new Ctor(track).grabFrame()
  try {
    return toJpeg(bitmap, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

// Fallback for browsers without ImageCapture (e.g. Firefox): a short-lived <video>, awaited until it has
// a frame. Less reliable in background tabs, which is why it's only the fallback.
async function viaVideo(track: MediaStreamTrack): Promise<string | null> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream([track])
  try {
    await video.play()
    if (video.readyState < 2) await new Promise(resolve => video.addEventListener('loadeddata', resolve, { once: true }))
    return toJpeg(video, video.videoWidth, video.videoHeight)
  } finally {
    video.pause()
    video.srcObject = null
  }
}

export async function grabFrame(track: MediaStreamTrack): Promise<string | null> {
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
