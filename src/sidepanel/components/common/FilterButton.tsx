interface FilterButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  isError?: boolean
}

export function FilterButton({
  active,
  onClick,
  children,
  count,
  isError,
}: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
        active
          ? 'bg-accent text-white'
          : 'text-text-muted hover:text-text hover:bg-hover'
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
          active
            ? 'bg-white/20'
            : isError
              ? 'bg-red-100 text-red-600'
              : 'bg-hover'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}
