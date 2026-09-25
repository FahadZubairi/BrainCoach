'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ComponentProps, useLayoutEffect } from 'react'

// Page transitions via the browser's View Transitions API.
//
// We drive it ourselves rather than through React's <ViewTransition>, because that only animates
// when the route commit lands in a transition lane, which Next's navigation here doesn't guarantee.
// Flow: snapshot old page → router.push → resolve once the new page has committed → browser animates.

const ORDER = ['/dashboard', '/session', '/habits', '/history', '/insights']

let resolvePending: (() => void) | null = null

function direction(from: string, to: string) {
  const a = ORDER.indexOf(from)
  const b = ORDER.indexOf(to)
  if (a === -1 || b === -1 || a === b) return 'fade'
  return b > a ? 'forward' : 'back'
}

export function navigateWithTransition(router: ReturnType<typeof useRouter>, from: string, to: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced || from === to) {
    router.push(to)
    return
  }
  const root = document.documentElement
  root.dataset.nav = direction(from, to)
  const vt = document.startViewTransition(() => new Promise<void>(resolve => {
    resolvePending = resolve
    router.push(to)
    setTimeout(resolve, 2000) // never leave the page frozen if the route is slow
  }))
  vt.finished.finally(() => { delete root.dataset.nav })
}

// Mounted once per page (inside AppShell): tells a pending transition the new page is in the DOM.
export function usePageTransitionCommit() {
  const pathname = usePathname()
  useLayoutEffect(() => {
    resolvePending?.()
    resolvePending = null
  }, [pathname])
}

export default function NavLink({ href, onNavigate, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <Link
      href={href}
      onNavigate={e => {
        onNavigate?.(e)
        e.preventDefault()
        navigateWithTransition(router, pathname, href)
      }}
      {...props}
    />
  )
}
