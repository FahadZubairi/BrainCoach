'use client'

import { useSyncExternalStore } from 'react'

// Browser connectivity (navigator.onLine), kept in sync with the online/offline events.
function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
