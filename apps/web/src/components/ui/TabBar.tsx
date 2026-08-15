interface TabBarProps {
  tabs: string[]
  active: string
  onChange: (tab: string) => void
  className?: string
}

export function TabBar({ tabs, active, onChange, className = '' }: TabBarProps) {
  return (
    <div className={`flex items-center border-b border-surface-border ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === tab
              ? 'border-accent-blue text-accent-blue'
              : 'border-transparent text-sentinel-400 hover:text-sentinel-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
