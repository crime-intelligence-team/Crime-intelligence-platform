import { useEffect, useRef } from 'react'
import { useAppContext } from '../context/AppContext'

const INCIDENT_POOL = [
  { severity: 'critical' as const, title: 'Anomalous Login — OP-774A', description: 'Credential replay attack detected on admin interface. Blocking and alerting.' },
  { severity: 'elevated' as const, title: 'Latent Link Activated — EXT-PROXY-99', description: 'Previously dormant external proxy now transmitting. Correlated to BLR-SRV-01.' },
  { severity: 'elevated' as const, title: 'Integrity Scan Mismatch — ND-GAMMA-12', description: 'Config checksum differs from baseline snapshot. Automated remediation initiated.' },
  { severity: 'low'      as const, title: 'Clearance Expiry — HUB-OP-18', description: 'Operator clearance expires in 24h. Renewal queued.' },
  { severity: 'critical' as const, title: 'Border Sensor Triggered — MNG Sector 3', description: 'Movement vector matching Pattern Alpha-7 detected.' },
  { severity: 'elevated' as const, title: 'Policy Drift — DIR-2023-11C', description: 'Sector 7 telemetry retention compliance dropped below 60%.' },
]

/**
 * useRealtimeAlerts
 * Simulates real-time alert ingestion in the absence of a live WebSocket.
 * When VITE_API_WS_URL is set, this hook should be replaced with a proper
 * WebSocket client connecting to that endpoint.
 */
export function useRealtimeAlerts(intervalMs = 30_000) {
  const { addAlert } = useAppContext()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Check for real WS endpoint first
    const wsUrl = import.meta.env.VITE_API_WS_URL
    if (wsUrl) {
      const ws = new WebSocket(wsUrl)
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data)
          addAlert(payload)
        } catch {
          console.warn('[WS] Invalid alert payload', ev.data)
        }
      }
      return () => ws.close()
    }

    // Simulation fallback — fires a random alert every `intervalMs`
    timerRef.current = setInterval(() => {
      const alert = INCIDENT_POOL[Math.floor(Math.random() * INCIDENT_POOL.length)]
      addAlert(alert)
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [addAlert, intervalMs])
}
