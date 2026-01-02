import { useState } from 'react'
import { Shield, Plus, X, ToggleLeft, ToggleRight, Settings, Trash2 } from 'lucide-react'
import type { MockRule } from '../../types'
import { MockRuleEditor } from './MockRuleEditor'

interface MockManagerProps {
  rules: MockRule[]
  onSave: (rules: MockRule[]) => void
  onClose: () => void
}

export function MockManager({
  rules,
  onSave,
  onClose,
}: MockManagerProps) {
  const [localRules, setLocalRules] = useState<MockRule[]>(rules)
  const [editingRule, setEditingRule] = useState<MockRule | null>(null)

  const addRule = () => {
    const newRule: MockRule = {
      id: crypto.randomUUID(),
      urlPattern: '',
      method: 'ALL',
      status: 200,
      statusText: 'OK',
      responseBody: '{}',
      responseHeaders: {},
      enabled: true,
    }
    setEditingRule(newRule)
  }

  const saveRule = (rule: MockRule) => {
    const exists = localRules.find(r => r.id === rule.id)
    const newRules = exists
      ? localRules.map(r => r.id === rule.id ? rule : r)
      : [...localRules, rule]
    setLocalRules(newRules)
    onSave(newRules)
    setEditingRule(null)
  }

  const deleteRule = (id: string) => {
    const newRules = localRules.filter(r => r.id !== id)
    setLocalRules(newRules)
    onSave(newRules)
  }

  const toggleRule = (id: string) => {
    const newRules = localRules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    )
    setLocalRules(newRules)
    onSave(newRules)
  }

  if (editingRule) {
    return (
      <MockRuleEditor
        rule={editingRule}
        onSave={saveRule}
        onCancel={() => setEditingRule(null)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Mock Rules</span>
          <span className="text-xs text-text-muted">
            ({localRules.filter(r => r.enabled).length} active)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={addRule}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Rule
          </button>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text rounded hover:bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {localRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <Shield className="w-12 h-12 mb-3 opacity-30" strokeWidth={1} />
            <p className="text-sm">No mock rules</p>
            <p className="text-xs mt-1">Add a rule to intercept requests</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {localRules.map(rule => (
              <div key={rule.id} className="px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`transition-colors ${rule.enabled ? 'text-purple-500' : 'text-text-muted'}`}
                >
                  {rule.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-semibold ${
                      rule.method === 'GET' ? 'text-emerald-600' :
                      rule.method === 'POST' ? 'text-blue-600' :
                      rule.method === 'PUT' ? 'text-amber-600' :
                      rule.method === 'DELETE' ? 'text-red-600' :
                      'text-purple-600'
                    }`}>
                      {rule.method}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                      {rule.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-text truncate mt-1">
                    {rule.urlPattern || '(no pattern)'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-1.5 text-text-muted hover:text-text hover:bg-hover rounded"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
