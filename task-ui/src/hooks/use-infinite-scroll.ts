import { useEffect, type RefObject } from 'react'

/**
 * Calls `onLoadMore` when `sentinelRef` scrolls within range of the bottom of `rootRef`'s
 * own scroll box. Drives per-container infinite scroll (a Kanban column, a table body)
 * without a page-level scroll listener.
 */
export function useInfiniteScrollSentinel(
  rootRef: RefObject<HTMLDivElement | null>,
  sentinelRef: RefObject<HTMLDivElement | null>,
  onLoadMore: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const root = rootRef.current
    const target = sentinelRef.current
    if (!root || !target) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [rootRef, sentinelRef, onLoadMore, enabled])
}
