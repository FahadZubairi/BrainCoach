'use client'

import AppShell from '../components/AppShell'
import { ActiveView } from './ActiveView'
import { SetupView } from './SetupView'
import { SummaryView } from './SummaryView'
import { useSessionController } from './useSessionController'

// /session — setup → active → summary. State and rules live in useSessionController / lib/sessionEngine.
export default function SessionPage() {
  return (
    <AppShell width="default">
      <SessionFlow />
    </AppShell>
  )
}

function SessionFlow() {
  const c = useSessionController()
  if (c.phase === 'ended' && c.summary) return <SummaryView summary={c.summary} onAgain={c.reset} />
  if (c.phase === 'active' && c.session) return <ActiveView c={c} session={c.session} />
  return <SetupView c={c} />
}
