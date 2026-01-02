import { Settings, X, Moon, Sun, Type } from 'lucide-react'

export type FontSize = 'small' | 'medium' | 'large'

interface SettingsPanelProps {
  darkMode: boolean
  fontSize: FontSize
  onDarkModeChange: (enabled: boolean) => void
  onFontSizeChange: (size: FontSize) => void
  onClose: () => void
}

export function SettingsPanel({
  darkMode,
  fontSize,
  onDarkModeChange,
  onFontSizeChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Drag Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">Settings</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text rounded hover:bg-hover"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Dark Mode */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            Theme
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onDarkModeChange(false)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                !darkMode
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border hover:bg-hover'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span className="text-sm">Light</span>
            </button>
            <button
              onClick={() => onDarkModeChange(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                darkMode
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border hover:bg-hover'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span className="text-sm">Dark</span>
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Type className="w-4 h-4" />
            Font Size
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onFontSizeChange('small')}
              className={`flex-1 px-3 py-2.5 rounded-lg border transition-colors ${
                fontSize === 'small'
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border hover:bg-hover'
              }`}
            >
              <span className="text-xs">Small</span>
            </button>
            <button
              onClick={() => onFontSizeChange('medium')}
              className={`flex-1 px-3 py-2.5 rounded-lg border transition-colors ${
                fontSize === 'medium'
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border hover:bg-hover'
              }`}
            >
              <span className="text-sm">Medium</span>
            </button>
            <button
              onClick={() => onFontSizeChange('large')}
              className={`flex-1 px-3 py-2.5 rounded-lg border transition-colors ${
                fontSize === 'large'
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border hover:bg-hover'
              }`}
            >
              <span className="text-base">Large</span>
            </button>
          </div>
          <p className="text-[10px] text-text-muted">
            Changes the base font size for the entire panel
          </p>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Preview</div>
          <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
            <p className="text-xs text-text-muted">Sample text (xs)</p>
            <p className="text-sm">Sample text (sm)</p>
            <p className="text-base font-medium">Sample text (base)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
