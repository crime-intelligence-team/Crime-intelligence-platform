/**
 * Skeleton loading components — shimmering placeholders that match
 * the exact shape of the real content they replace.
 */

function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-hover rounded animate-pulse ${className}`} />
  )
}

// ── Row skeleton (for table / list items) ─────────────────────────────────────
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-border">
      <Shimmer className="w-2 h-2 rounded-full shrink-0" />
      {Array.from({ length: cols }).map((_, i) => (
        <Shimmer key={i} className={`h-3 rounded flex-1 ${i === 0 ? 'max-w-[80px]' : i === 1 ? 'max-w-[200px]' : ''}`} />
      ))}
    </div>
  )
}

// ── Card skeleton ─────────────────────────────────────────────────────────────
export function SkeletonCard({ height = 'h-32' }: { height?: string }) {
  return (
    <div className={`bg-surface-card border border-surface-border rounded-xl p-5 ${height}`}>
      <Shimmer className="h-3 w-24 mb-3" />
      <Shimmer className="h-7 w-16 mb-2" />
      <Shimmer className="h-2 w-32" />
    </div>
  )
}

// ── Map skeleton ──────────────────────────────────────────────────────────────
export function SkeletonMap() {
  return (
    <div className="w-full h-full bg-surface-base flex items-center justify-center relative">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-raised to-surface-base" />
      <div className="relative z-10 flex flex-col items-center gap-3 text-sentinel-600">
        <div className="w-12 h-12 rounded-full border-2 border-surface-border border-t-sentinel-400 animate-spin" />
        <p className="text-[11px] tracking-wider uppercase">Loading map layer...</p>
      </div>
    </div>
  )
}

// ── Chart skeleton ────────────────────────────────────────────────────────────
export function SkeletonChart({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`w-full ${height} flex items-end gap-1.5 px-2 pb-2`}>
      {Array.from({ length: 12 }).map((_, i) => {
        const h = [40, 55, 45, 70, 60, 80, 90, 65, 50, 75, 55, 45][i]
        return (
          <div key={i} className="flex-1 rounded-sm bg-surface-hover animate-pulse" style={{ height: `${h}%` }} />
        )
      })}
    </div>
  )
}

// ── Stat row skeleton ─────────────────────────────────────────────────────────
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-3`}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} height="h-24" />)}
    </div>
  )
}

// ── Table skeleton ────────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

// ── Graph / network skeleton ──────────────────────────────────────────────────
export function SkeletonGraph() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-base dot-grid relative">
      <div className="flex flex-col items-center gap-3 text-sentinel-600 z-10">
        <div className="flex gap-4">
          {[0,1,2].map(i => (
            <div key={i} className="w-12 h-12 rounded-lg bg-surface-card border border-surface-border animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <div className="w-32 h-px bg-surface-border" />
        <p className="text-[11px] tracking-wider uppercase">Rendering graph...</p>
      </div>
    </div>
  )
}
