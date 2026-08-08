import { useState } from 'react'
import { TabBar } from '../components/ui/TabBar'
import { EntityRegistryTable } from '../components/network/EntityRegistryTable'

export default function NodeRegistry() {
  const [activeTab, setActiveTab] = useState('Entity Registry')

  return (
    <div className="flex flex-col h-full">
      <TabBar tabs={['Interactive Graph', 'Entity Registry']} active={activeTab} onChange={setActiveTab}
        className="px-6 bg-surface-raised shrink-0" />

      <div className="flex-1 flex flex-col overflow-hidden p-0">
        <EntityRegistryTable />
      </div>
    </div>
  )
}
