/**
 * Lightweight hash-based router with view-transition integration.
 *
 * Why hash and not pathname / History API for paths? The app is served from
 * a non-root subpath on GitHub Pages (`/<repo-name>/`) AND from `/` in the
 * standalone binary AND from `/` in local dev — using `history.pushState`
 * with real paths would require base-path juggling everywhere. The hash is
 * origin-agnostic, doesn't hit the server on reload, and survives any base.
 *
 * Format:
 *     #<tab>           → `{ tab }`
 *     #<tab>/<sub>     → `{ tab, sub }`
 *
 * Examples: `#Overview`, `#Analytics/Forecast`, `#Config/Account`.
 *
 * The hook swallows the `TABS` array so invalid hashes fall back to the
 * caller's default instead of rendering nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Route<T extends string> {
  tab: T
  sub?: string
}

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean
  /** Skip the view transition animation (used for programmatic redirects). */
  skipAnimation?: boolean
}

function parseHash<T extends string>(validTabs: readonly T[], fallback: T): Route<T> {
  if (typeof window === 'undefined') return { tab: fallback }
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return { tab: fallback }

  const [rawTab, rawSub] = hash.split('/', 2)
  const decodedTab = decodeURIComponent(rawTab)
  const decodedSub = rawSub ? decodeURIComponent(rawSub) : undefined

  const tab = validTabs.includes(decodedTab as T) ? (decodedTab as T) : fallback
  return { tab, sub: decodedSub }
}

function formatHash<T extends string>(route: Route<T>): string {
  const encodedTab = encodeURIComponent(route.tab)
  if (!route.sub) return `#${encodedTab}`
  return `#${encodedTab}/${encodeURIComponent(route.sub)}`
}

/**
 * Controlled hash-route hook.
 *
 * Returns `[route, navigate]` where `navigate(next)` pushes a new history
 * entry (or replaces) and updates state in a view-transition animation when
 * the browser supports it. The `popstate` listener syncs state on back/forward
 * so the animation direction tracks correctly.
 */
export function useHashRoute<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
): [Route<T>, (next: Route<T>, options?: NavigateOptions) => void] {
  const [route, setRoute] = useState<Route<T>>(() => parseHash(validTabs, defaultTab))

  // Track the last tab index so we can compute the slide-animation direction.
  // Only the top-level tab participates in the view transition — sub-tab
  // changes just swap content without sliding.
  const lastTabIdx = useRef(validTabs.indexOf(route.tab))

  const applyRoute = useCallback((next: Route<T>, skipAnimation = false) => {
    const nextIdx = validTabs.indexOf(next.tab)
    const shouldAnimate =
      !skipAnimation &&
      nextIdx !== -1 &&
      nextIdx !== lastTabIdx.current &&
      'startViewTransition' in document

    if (nextIdx !== -1 && nextIdx !== lastTabIdx.current) {
      document.documentElement.style.setProperty(
        '--vt-dir',
        String(nextIdx >= lastTabIdx.current ? 1 : -1),
      )
      lastTabIdx.current = nextIdx
    }

    const commit = () => setRoute(next)
    if (shouldAnimate) {
      document.startViewTransition(commit)
    } else {
      commit()
    }
  }, [validTabs])

  useEffect(() => {
    const onPopState = () => {
      applyRoute(parseHash(validTabs, defaultTab))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [applyRoute, validTabs, defaultTab])

  // If the first paint's hash was invalid or empty, the stored state already
  // reflects the fallback — but we also want the URL to match so reloads
  // land on the same place. Replace the history entry silently on mount.
  useEffect(() => {
    const current = window.location.hash.replace(/^#/, '')
    const desired = formatHash(route).replace(/^#/, '')
    if (current !== desired) {
      window.history.replaceState(null, '', formatHash(route))
    }
    // Run only once on mount — subsequent updates go through `navigate`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigate = useCallback(
    (next: Route<T>, options: NavigateOptions = {}) => {
      const hash = formatHash(next)
      if (window.location.hash !== hash) {
        if (options.replace) {
          window.history.replaceState(null, '', hash)
        } else {
          window.history.pushState(null, '', hash)
        }
      }
      applyRoute(next, options.skipAnimation)
    },
    [applyRoute],
  )

  return [route, navigate]
}
