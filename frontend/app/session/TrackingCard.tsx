import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavLink from '../components/NavLink'
import { PrivacyConsent } from '../components/PrivacyConsent'
import { Card, Eyebrow, Segmented, StatusDot, Switch } from '../components/ui'
import type { Prefs, Tracker } from '../lib/prefs'
import { CameraVideo, cameraMessage } from './StatusRows'
import type { SessionController } from './useSessionController'

// Setup: choose the optional tracking signals (camera presence, tab tracking method).
export function TrackingCard({ c }: { c: SessionController }) {
  const router = useRouter()
  const { face, ext, screen, prefs, updatePrefs, tracking } = c
  const toExtensionSetup = () => router.push('/extension?from=session')
  const [asking, setAsking] = useState<{ tracker: Tracker; apply: () => void } | null>(null)

  // First use of each tracker explains exactly what it does with your data; nothing starts until you agree.
  const withConsent = (tracker: Tracker, apply: () => void) => {
    if (prefs.consent[tracker]) apply()
    else setAsking({ tracker, apply })
  }
  const chooseTracking = (v: Prefs['tracking']) => {
    updatePrefs({ tracking: v })
    // Choosing the extension without it installed takes you straight to guided setup.
    if (v === 'extension' && !ext.connected) toExtensionSetup()
  }

  return (
    <Card className="flex flex-col gap-6 p-6 sm:p-8">
      <div>
        <Eyebrow>Tracking</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-3">
          Optional, and off until you choose. Each signal makes your focus score more honest.{' '}
          <NavLink href="/privacy" className="text-accent underline-offset-4 hover:underline">How your data is handled</NavLink>
        </p>
      </div>

      <div>
        <Switch checked={c.cameraOn} onChange={on => (on ? withConsent('camera', () => c.toggleCamera(true)) : c.toggleCamera(false))} label="Presence via camera" description="Notices when you step away. Processed on-device." />
        {c.cameraOn && (
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-bg">
            <div className="relative aspect-[4/3]">
              <CameraVideo attach={face.attachVideo} className="h-full w-full -scale-x-100 object-cover" />
              {face.state !== 'present' && face.state !== 'absent' && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-fg-3">{cameraMessage(face.state)}</div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px]">
              <StatusDot tone={face.state === 'present' ? 'accent' : face.state === 'absent' ? 'warn' : 'muted'} />
              <span className="text-fg-2">{face.state === 'present' ? 'Face detected — you’re set' : face.state === 'absent' ? 'No face in frame' : 'Camera check'}</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line pt-6">
        <span className="block text-sm text-fg">Tab tracking</span>
        <span className="mt-0.5 block text-[13px] text-fg-3">Notices when you drift to off-topic sites.</span>
        <div className="mt-3">
          <Segmented
            label="How to track tabs"
            options={[{ value: 'extension', label: 'Extension' }, { value: 'screen', label: 'Screen check' }, { value: 'off', label: 'Off' }]}
            value={tracking}
            onChange={v => {
              const next = v as Prefs['tracking']
              if (next === 'off') chooseTracking(next)
              else withConsent(next, () => chooseTracking(next))
            }}
          />
        </div>

        {tracking === 'extension' && (
          <div className="slide-down mt-4">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-bg px-4 py-3 text-[13px]">
              <span className="flex items-center gap-2 text-fg-2">
                <StatusDot tone={ext.connected ? 'accent' : 'muted'} />
                {ext.connected ? 'Extension connected' : 'Extension not connected'}
              </span>
              {!ext.connected && (
                <button type="button" onClick={toExtensionSetup} className="cursor-pointer text-accent underline-offset-4 hover:underline">Set it up</button>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-fg-3">Most accurate. Judges each site the moment you open it, shows ON/OFF on its toolbar icon, and can pause distracting sites.</p>
            {ext.connected && (
              <div className="mt-4">
                <Switch
                  checked={prefs.strictMode} onChange={v => updatePrefs({ strictMode: v })} label="Pause distracting sites"
                  description="Off-topic sites show a 10-second breathing pause first. A moment of friction is often enough to change your mind."
                />
              </div>
            )}
          </div>
        )}

        {tracking === 'screen' && (
          <div className="slide-down mt-4 space-y-3">
            {screen.supported ? (
              <>
                <p className="text-[13px] leading-relaxed text-fg-2">
                  No install needed. When the session starts, choose <span className="text-fg">Entire screen</span> in the sharing dialog so it can see the tabs and apps you switch to.
                </p>
                <div className="rounded-xl border border-line bg-bg px-4 py-3 text-xs leading-relaxed text-fg-3">
                  <p className="mb-1 font-medium text-fg-2">Privacy</p>
                  While you&apos;re on another tab, a low-resolution snapshot is taken every 5 seconds and sent to BrainCoach&apos;s AI only when your screen has changed.
                  Snapshots are analysed and immediately discarded, never saved. Only the verdict (e.g. &ldquo;YouTube · off task&rdquo;) is kept.
                  Your browser shows a sharing indicator the whole time, and you can stop at any moment.
                </div>
              </>
            ) : (
              <p className="rounded-xl bg-bg px-4 py-3 text-[13px] text-fg-3">This browser can&apos;t share its screen (most phones can&apos;t). Use a desktop browser, or pick the extension.</p>
            )}
          </div>
        )}
      </div>
      {asking && (
        <PrivacyConsent
          tracker={asking.tracker}
          onCancel={() => setAsking(null)}
          onAllow={() => {
            updatePrefs({ consent: { ...prefs.consent, [asking.tracker]: true } })
            asking.apply()
            setAsking(null)
          }}
        />
      )}
    </Card>
  )
}
