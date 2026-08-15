import { useState, useEffect, useCallback } from 'react'

/**
 * useApi — generic hook for loading async API calls with loading/error state.
 * Automatically refetches when `refetch()` is called.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  const refetch = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetcher()
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  return { data, loading, error, refetch }
}
