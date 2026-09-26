'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState = 'off' | 'starting' | 'present' | 'absent' | 'denied' | 'unavailable' | 'error'

const CHECK_EVERY_MS = 1000
// A single missed frame (turning your head, bad lighting) shouldn't count as leaving.
const MISSES_BEFORE_ABSENT = 3

type FaceApi = typeof import('face-api.js')
type Options = InstanceType<FaceApi['TinyFaceDetectorOptions']>
let modelPromise: Promise<FaceApi> | null = null

// face-api.js pulls in TensorFlow.js, so load it lazily and only once.
function loadFaceApi() {
  if (!modelPromise) {
    modelPromise = import('face-api.js').then(async faceapi => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      return faceapi
    })
    modelPromise.catch(() => { modelPromise = null })
  }
  return modelPromise
}

// Anywhere in the frame: the whole frame is checked first. The tiny detector shrinks it to ~416 px, so a
// face that's small, far away or near an edge can vanish; if nothing is found, overlapping tiles (each
// ~2/3 of the frame, enlarged) are checked too, which catches faces in corners and at the edges.
const TILES = [
  [0, 0], [1 / 3, 0], [0, 1 / 3], [1 / 3, 1 / 3], [1 / 6, 1 / 6],
] as const
const TILE_SIZE = 2 / 3
let tileCanvas: HTMLCanvasElement | null = null

async function faceInFrame(faceapi: FaceApi, video: HTMLVideoElement, full: Options, tile: Options) {
  if (await faceapi.detectSingleFace(video, full)) return true
  const w = video.videoWidth
  const h = video.videoHeight
  tileCanvas ??= document.createElement('canvas')
  tileCanvas.width = Math.round(w * TILE_SIZE)
  tileCanvas.height = Math.round(h * TILE_SIZE)
  const ctx = tileCanvas.getContext('2d')
  if (!ctx) return false
  for (const [x, y] of TILES) {
    ctx.drawImage(video, x * w, y * h, w * TILE_SIZE, h * TILE_SIZE, 0, 0, tileCanvas.width, tileCanvas.height)
    if (await faceapi.detectSingleFace(tileCanvas, tile)) return true
  }
  return false
}

export function useFaceTracker(enabled: boolean) {
  const [state, setState] = useState<CameraState>('off')
  const [absentSince, setAbsentSince] = useState<number | null>(null)
  const videoEl = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Callback ref: the preview <video> moves between screens (setup → active), so re-attach the
  // live stream to whichever element is currently mounted.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoEl.current = el
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current
      el.play().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let misses = 0

    async function start() {
      setState('starting')
      setAbsentSince(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // 640×480 keeps small or distant faces detectable; frames never leave the device.
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
      } catch (err) {
        const name = (err as DOMException)?.name
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'unavailable' : 'error')
        return
      }
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      streamRef.current = stream
      if (videoEl.current) {
        videoEl.current.srcObject = stream
        videoEl.current.play().catch(() => {})
      }

      let faceapi: FaceApi
      try {
        faceapi = await loadFaceApi()
      } catch (err) {
        console.error('Could not load face detection model:', err)
        if (!cancelled) setState('error')
        return
      }
      if (cancelled) return

      const full = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 })
      const tile = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })

      const tick = async () => {
        if (cancelled) return
        const video = videoEl.current
        if (video && video.readyState >= 2 && video.videoWidth > 0) {
          try {
            const found = await faceInFrame(faceapi, video, full, tile)
            if (cancelled) return
            if (found) {
              misses = 0
              setState('present')
              setAbsentSince(null)
            } else if (++misses >= MISSES_BEFORE_ABSENT) {
              setState('absent')
              setAbsentSince(prev => prev ?? Date.now() - misses * CHECK_EVERY_MS)
            }
          } catch (err) {
            console.warn('Face detection frame failed:', err)
          }
        }
        timer = setTimeout(tick, CHECK_EVERY_MS)
      }
      tick()
    }

    start()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoEl.current) videoEl.current.srcObject = null
    }
  }, [enabled])

  // When disabled the effect is idle, so report 'off' rather than whatever the last live state was.
  return enabled
    ? { state, absentSince, attachVideo }
    : { state: 'off' as CameraState, absentSince: null, attachVideo }
}
