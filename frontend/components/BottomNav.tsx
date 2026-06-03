'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'ホーム', icon: '🏠', path: '/', activePaths: ['/'] },
  { label: '記録', icon: '✏️', path: '/sessions/new', activePaths: ['/sessions'] },
  { label: '地図', icon: '📍', path: '/spots', activePaths: ['/spots'] },
  { label: '統計', icon: '📊', path: '/stats', activePaths: ['/stats'] },
  { label: '設定', icon: '⚙️', path: '/settings', activePaths: ['/settings'] },
]

function matchesPath(pathname: string, activePath: string): boolean {
  if (activePath === '/') return pathname === '/'
  return pathname === activePath || pathname.startsWith(`${activePath}/`)
}

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-2xl mx-auto flex">
        {tabs.map((tab) => {
          const isActive = tab.activePaths.some((activePath) => matchesPath(pathname, activePath))
          return (
            <Link
              key={tab.path}
              href={tab.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center py-2 gap-1 text-xs transition ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={isActive ? 'font-bold' : ''}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
