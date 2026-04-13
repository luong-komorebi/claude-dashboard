/**
 * PWA integration hooks:
 *   - useInstallPrompt(): exposes the browser's `beforeinstallprompt` event so
 *     we can render our own install button instead of relying on the browser's
 *     (easy-to-miss) address-bar icon.
 *   - useOnlineStatus(): tracks navigator.onLine via online/offline events.
 *   - useIsStandalone(): detects whether we're running as an installed PWA
 *     (i.e. `display-mode: standalone`) so we can hide the install button.
 *
 * The `beforeinstallprompt` event only fires on Chromium browsers and only
 * when the site meets installability criteria (HTTPS, manifest, service
 * worker, engagement signals). On Firefox/Safari the install UI is
 * user-triggered from the browser menu, so the button stays hidden — no harm.
 */

import { useCallback, useEffect, useState } from 'react'

// ─── Global state captured outside React ────────────────────────────────────
// Must listen as early as possible — once a component mounts the event may
// have already fired.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<(available: boolean) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    promptListeners.forEach(l => l(true))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    promptListeners.forEach(l => l(false))
  })
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<boolean> } {
  const [canInstall, setCanInstall] = useState(() => deferredPrompt !== null)

  useEffect(() => {
    const listener = (available: boolean) => setCanInstall(available)
    promptListeners.add(listener)
    return () => { promptListeners.delete(listener) }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return false
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      const accepted = outcome === 'accepted'
      if (accepted) {
        deferredPrompt = null
        promptListeners.forEach(l => l(false))
      }
      return accepted
    } catch {
      return false
    }
  }, [])

  return { canInstall, install }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}

export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)')
    const listener = (e: MediaQueryListEvent) => setStandalone(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  return standalone
}
