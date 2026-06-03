'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiFetch, ApiError } from '@/lib/api'
import { FullScreenSpinner } from '@/lib/Loading'
import { fetchAllPages } from '@/lib/pagination'
import type { Catch, MonthlyStats, LureStats } from '@/lib/types'

// recharts はバンドルが大きいのでチャート部分のみ遅延ロード
const MonthlyBarChart = dynamic(() => import('./charts').then((m) => m.MonthlyBarChart), {
  ssr: false,
  loading: () => <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">グラフ準備中...</div>,
})
const SpeciesPieChart = dynamic(() => import('./charts').then((m) => m.SpeciesPieChart), {
  ssr: false,
  loading: () => <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">グラフ準備中...</div>,
})

type MonthlyRow = { month: string; session_count: number; catch_count: number }
type LureRow = { name: string; count: number; avg_length: number }
type SpeciesRow = { name: string; count: number }

export default function StatsPage() {
  const router = useRouter()
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [lureStats, setLureStats] = useState<LureRow[]>([])
  const [species, setSpecies] = useState<SpeciesRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<MonthlyStats>('/api/sessions/stats/monthly'),
      apiFetch<LureStats>('/api/lures/stats'),
      fetchAllPages<Catch>('/api/catches', (path) => apiFetch<Catch[]>(path)),
    ])
      .then(([monthlyData, lureData, catchData]) => {
        const monthlyArray: MonthlyRow[] = Object.entries(monthlyData)
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => a.month.localeCompare(b.month))

        const lureArray: LureRow[] = Object.entries(lureData)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count)

        const speciesMap: Record<string, number> = {}
        catchData.forEach((c) => {
          const key = c.fish_species
          speciesMap[key] = (speciesMap[key] || 0) + 1
        })
        const speciesArray: SpeciesRow[] = Object.entries(speciesMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)

        setMonthly(monthlyArray)
        setLureStats(lureArray)
        setSpecies(speciesArray)
      })
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700" aria-label="前のページに戻る">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">統計</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-4">月別釣行・釣果数</h2>
          {monthly.length === 0 ? (
            <p className="text-center text-gray-400 py-8">データがありません</p>
          ) : (
            <MonthlyBarChart data={monthly} />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-4">魚種別釣果</h2>
          {species.length === 0 ? (
            <p className="text-center text-gray-400 py-8">データがありません</p>
          ) : (
            <SpeciesPieChart data={species} />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-4">ルアー別釣果ランキング</h2>
          <p className="text-xs text-gray-400 -mt-2 mb-4">
            釣果記録時点のルアー名で集計しています
          </p>
          {lureStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8">データがありません</p>
          ) : (
            <div className="space-y-3">
              {lureStats.slice(0, 5).map((lure, i) => (
                <div key={lure.name} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 w-6">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{lure.name}</span>
                      <span className="text-gray-500">{lure.count}匹 / 平均{lure.avg_length}cm</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(lure.count / lureStats[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
