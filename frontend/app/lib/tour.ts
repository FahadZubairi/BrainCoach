// The welcome tour is for brand-new accounts only: sign-up marks it pending, and finishing or skipping
// clears it. Existing users who log in never see it. Stored locally; if storage is unavailable the tour
// simply doesn't show, which is the safe side.

const KEY = 'braincoach:tour-pending'

export function markTourPending() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Private mode or blocked storage: skip the tour rather than fail sign-up.
  }
}

export function isTourPending() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function clearTour() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear if storage is blocked.
  }
}
