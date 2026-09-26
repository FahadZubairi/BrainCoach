import type { ReactNode } from 'react'
import { Icon, StatusDot } from '../components/ui'
import type { TabStatus } from '../lib/extension'
import type { CameraState } from '../lib/useFaceTracker'
import type { ScreenState, SharedSurface } from '../lib/useScreenCheck'
import { elapsedLabel } from './constants'

type Tone = 'accent' | 'warn' | 'danger' | 'muted'

function StatusRow({ icon, title, tone, detail, pulse }: { icon: 'camera' | 'browser'; title: string; tone: Tone; detail: ReactNode; pulse?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-bg px-4 py-3">
      <Icon name={icon} className="mt-0.5 text-fg-3" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm text-fg">
          <StatusDot tone={tone} pulse={pulse} />
          {title}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-fg-3">{detail}</p>
      </div>
    </div>
  )
}

const Link = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="cursor-pointer text-accent underline-offset-2 hover:underline">{label}</button>
)

/** The camera preview. Takes the tracker's attach callback so the parent never touches it as a ref. */
export function CameraVideo({ attach, className }: { attach: (el: HTMLVideoElement | null) => void; className?: string }) {
  return <video ref={attach} autoPlay muted playsInline className={className} />
}

export function cameraMessage(state: CameraState) {
  switch (state) {
    case 'starting': return 'Starting camera…'
    case 'denied': return 'Camera access was blocked. Allow it from the camera icon in the address bar, then toggle this off and on.'
    case 'unavailable': return 'No camera found on this device.'
    case 'error': return 'The camera started but face detection failed to load. Try reloading the page.'
    default: return ''
  }
}

export function CameraStatus({ state, enabled, paused, absentSince, now, onEnable }: {
  state: CameraState; enabled: boolean; paused: boolean; absentSince: number | null; now: number; onEnable: () => void
}) {
  if (!enabled) return <StatusRow icon="camera" title="Camera off" tone="muted" detail={<Link label="Turn on presence tracking" onClick={onEnable} />} />
  if (paused) return <StatusRow icon="camera" title="Camera paused" tone="muted" detail="Turned off during your break" />
  if (state === 'present') return <StatusRow icon="camera" title="At your desk" tone="accent" detail="Face detected" pulse />
  if (state === 'absent') return <StatusRow icon="camera" title="Away" tone="warn" detail={`For ${elapsedLabel(absentSince, now)}`} />
  const short: Partial<Record<CameraState, string>> = {
    denied: 'Access blocked — allow it in the address bar',
    unavailable: 'No camera found',
    error: 'Face detection failed to load',
  }
  return <StatusRow icon="camera" title={state === 'starting' ? 'Camera starting' : 'Camera unavailable'} tone="muted" detail={short[state] || 'Starting…'} />
}

export function TrackerStatus({ mode, connected, status, screenState, surface, paused, now, onShareScreen, onSetupExtension }: {
  mode: 'extension' | 'screen' | 'off'
  connected: boolean
  status: TabStatus | null
  screenState: ScreenState
  surface: SharedSurface
  paused: boolean
  now: number
  onShareScreen: () => void
  onSetupExtension: () => void
}) {
  if (mode === 'off') return <StatusRow icon="browser" title="Tab tracking off" tone="muted" detail="Choose a method in session setup" />
  if (mode === 'extension' && !connected) {
    return <StatusRow icon="browser" title="Extension not connected" tone="muted" detail={<Link label="Set up the extension" onClick={onSetupExtension} />} />
  }
  if (mode === 'screen' && !connected) {
    const detail = screenState === 'requesting' ? 'Waiting for you to pick a screen…'
      : screenState === 'unsupported' ? 'Not supported in this browser'
      : <Link label={screenState === 'stopped' ? 'Sharing stopped — share again' : 'Share your screen'} onClick={onShareScreen} />
    return <StatusRow icon="browser" title="Screen check paused" tone="warn" detail={detail} />
  }
  if (paused) return <StatusRow icon="browser" title="Tracking paused" tone="muted" detail="Resumes with your session" />
  if (mode === 'screen' && (surface === 'browser' || surface === 'window')) {
    return (
      <StatusRow icon="browser" title="Only one window is shared" tone="warn" detail={
        <Link label="Share your entire screen instead" onClick={onShareScreen} />
      } />
    )
  }

  const tab = status?.tab
  if (!tab) {
    return mode === 'screen'
      ? <StatusRow icon="browser" title="Screen check on" tone="accent" detail="Checks every 5 s while you’re on another tab" />
      : <StatusRow icon="browser" title="Watching tabs" tone="accent" detail="Switch tabs to see it react" />
  }
  if (tab.pending) return <StatusRow icon="browser" title="Checking…" tone="muted" detail={tab.host} pulse />
  if (tab.relevant) {
    const detail = tab.neutral ? tab.reason : `${tab.host}${tab.reason && tab.reason !== tab.host ? ` · ${tab.reason}` : ''}`
    return <StatusRow icon="browser" title={tab.neutral ? 'On task' : 'On-topic'} tone="accent" detail={detail} />
  }
  return <StatusRow icon="browser" title="Off-topic" tone="danger" detail={`${tab.host} · ${elapsedLabel(status?.offTaskSince ?? null, now)}`} />
}
