export function Spinner({ label = '読み込み中' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-gray-500">
      <svg
        className="animate-spin h-5 w-5 text-blue-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span className="text-sm">{label}...</span>
    </div>
  )
}

export function FullScreenSpinner({ label = '読み込み中' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner label={label} />
    </div>
  )
}
