import { Tabs } from '@base-ui-components/react/tabs'

interface TabButtonProps {
  value: string
  active: boolean
  children: React.ReactNode
}

export function TabButton({ value, active, children }: TabButtonProps) {
  return (
    <Tabs.Tab
      value={value}
      className={`px-4 py-2 text-xs font-medium transition-colors ${
        active
          ? 'text-accent border-b-2 border-accent'
          : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </Tabs.Tab>
  )
}
