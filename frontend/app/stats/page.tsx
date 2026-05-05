'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function StatsPage() {
  const router = useRouter()
  const [monthly, setMonthly] = useState<any[]>([])
  const [lureStats, setLureStats] = useState<any[]>([])
  const [catches, setCatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [monthlyData, lureData, catchData] = await Promise.all([
        apiFetch('/api/sessions/stats/monthly'),
        apiFetch('/api/lures/stats'),
        apiFetch('/api/catches'),
      ])

      // 月別データを配列に変換・ソート
      const monthlyArray = Object.entries(monthlyData).map(([month, data]: any) => ({
        month,
        ...data,
      })).sort((a, b) => a.month.localeCompare(b.month))

      // ルアー別データを配列に変換
      const lureArray = Object.entries(lureData).map(([name, data]: any) => ({
        name,
        ...data,
      })).sort((a, b) => b.count - a.count)

      // 魚種別集計
      const speciesMap: any = {}
      catchData.forEach((c: any) => {
        const key = c.fish_species
        speciesMap[key] = (speciesMap[key] || 0) + 1
      })
      const speciesArray = Object.entries(speciesMap).map(([name, count]) => ({ name, count }))
        .sort((a: any, b: any) => b.count - a.count)

      setMonthly(monthlyArray)
      setLureStats(lureArray)
      setCatches(speciesArray)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← 戻る</button>
        <h1 className="text-xl font-bold text-gray-800">統計</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* 月別釣行・釣果数 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-4">月別釣行・釣果数</h2>
          {monthly.length === 0 ? (
            <p className="text-center text-gray-400 py-8">データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="session_count" name="釣行数" fill="#3b82f6" />
                <Bar dataKey="catch_count" name="釣果数" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 魚種別釣果 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-4">魚種別釣果</h2>
          {catches.length === 0 ? (
            <p className="text-center text-gray-400 py-8">データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catches} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name}(${count})`}>
                  {catches.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ルアー別釣果ランキング */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-bold text-gray-700 mb-4">ルアー別釣果ランキング</h2>
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