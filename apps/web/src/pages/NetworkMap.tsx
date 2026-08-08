import { useState } from 'react'
import { TabBar } from '../components/ui/TabBar'
import { EntityRegistryTable } from '../components/network/EntityRegistryTable'
import { NetworkGraphView, NodeExplorerPanel } from '../components/network/NetworkGraphView'

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NetworkMap() {
  const [activeTab, setActiveTab] = useState('Network Graph')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      <TabBar tabs={['Network Graph', 'Node Explorer']} active={activeTab} onChange={setActiveTab}
        className="px-4 bg-surface-raised shrink-0" />

      {activeTab === 'Node Explorer' ? (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <EntityRegistryTable onSelectEntity={setSelectedId} />
          {selectedId && <NodeExplorerPanel entityId={selectedId} onClose={() => setSelectedId(null)} />}
        </div>
      ) : (
        <NetworkGraphView />
      )}
    </div>
  )
}
