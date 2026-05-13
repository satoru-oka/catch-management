'use client'

import { useRouter, usePathname } from 'next/navigation'

const tabs = [
  { label: 'ホーム', icon: '🏠', path: '/' },
  { label: '記録', icon: '✏️', path: '/sessions/new' },
  { label: '地図', icon: '📍', path: '/spots' },
  { label: '統計', icon: '📊', path: '/stats' },
  { label: '設定', icon: '⚙️', path: '/settings' },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-2xl mx-auto flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={isActive ? 'font-bold' : ''}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
