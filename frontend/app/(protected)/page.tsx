'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { apiFetch, ApiError } from '@/lib/api'
import { tokyoDateIso } from '@/lib/date'
import { extractProfile, profileInitial, type Profile } from '@/lib/profile'
import { FullScreenSpinner } from '@/lib/Loading'
import type { CatchSummary } from '@/lib/types'

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土']

function formatJpDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return `${month}月${day}日(${WEEKDAY[d.getDay()]})`
}

export default function HomePage() {
  const [summary, setSummary] = useState<CatchSummary | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // ホームは全件ページングをやめ、サーバー集計 1 本 + プロフィールに置き換え (#72)。
    Promise.all([
      apiFetch<CatchSummary>('/api/catches/stats/summary'),
      createClient().auth.getUser(),
    ])
      .then(([s, { data }]) => {
        setSummary(s)
        setProfile(extractProfile(data.user))
      })
      .catch((e: ApiError) => setError(e.detail))
      .finally(() => setLoading(false))
  }, [])

  const today = useMemo(() => tokyoDateIso(), [])
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today])
  const greetingName = profile?.name ?? 'ゲスト'
  const greetingInitial = useMemo(() => profileInitial(greetingName), [greetingName])

  const todayCount = summary?.today.count ?? 0
  const todayWeightKg = (summary?.today.total_weight_g ?? 0) / 1000
  const todayMaxCm = summary?.today.max_length_cm ?? 0
  const lifetime = summary?.lifetime_count ?? 0
  const monthly = summary?.month_count ?? 0
  const maxCatch = summary?.max_catch ?? null
  const recent = summary?.recent ?? []

  if (loading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-gradient-to-br from-sky-400 to-blue-500 text-white px-6 pt-8 pb-12 rounded-b-3xl shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-wide flex items-center gap-2">
              <span aria-hidden="true">🐟</span>
              <span>釣果ログ</span>
            </h1>
            <p className="text-sm mt-1 text-sky-50 truncate">
              こんにちは、{greetingName}さん！
            </p>
          </div>
          <Link
            href="/settings"
            aria-label="設定"
            className="shrink-0"
          >
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-14 h-14 rounded-full border-2 border-white object-cover shadow"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/30 border-2 border-white flex items-center justify-center text-xl font-bold shadow">
                {greetingInitial}
              </div>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            読み込みに失敗しました: {error}
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-500 flex items-center justify-center text-xs">
                📅
              </span>
              今日の釣果
            </h2>
            <span className="text-xs text-gray-500 bg-sky-50 rounded-full px-3 py-1">
              {formatJpDate(today)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-4">
            <Stat label="釣果数" value={`${todayCount}`} unit="匹" />
            <Stat label="合計重量" value={todayWeightKg.toFixed(2)} unit="kg" />
            <Stat label="最大サイズ" value={todayMaxCm ? `${todayMaxCm}` : '—'} unit="cm" />
          </div>
          <Link
            href="/sessions/new"
            className="block w-full text-center bg-gradient-to-r from-sky-400 to-blue-500 text-white font-bold py-3 rounded-xl shadow hover:opacity-95"
          >
            ＋ 釣果を記録
          </Link>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <KpiCard
            icon="🐟"
            label="総釣果数"
            value={`${lifetime}`}
            unit="匹"
            footer="すべての記録"
            href="/stats"
            tone="sky"
          />
          <KpiCard
            icon="📅"
            label="今月の釣果"
            value={`${monthly}`}
            unit="匹"
            footer={`${monthStart.slice(5, 7)}月`}
            href="/stats"
            tone="emerald"
          />
          <KpiCard
            icon="🏆"
            label="最大サイズ"
            value={maxCatch?.length_cm ? `${maxCatch.length_cm}` : '—'}
            unit="cm"
            footer={maxCatch?.fish_species ?? '—'}
            href="/stats"
            tone="violet"
          />
        </section>

        <section className="bg-white rounded-2xl shadow-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">最近の釣果</h2>
            <Link href="/stats" className="text-sm text-sky-600">
              すべて見る ›
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              釣果記録がまだありません
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((c) => {
                const spot = c.sessions?.spots ?? null
                const date = c.sessions?.date ?? ''
                return (
                  <li key={c.id} className="py-3 flex items-center gap-3">
                    {c.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photo_url}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-sky-100 flex items-center justify-center text-2xl shrink-0">
                        🐟
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 truncate">
                        {c.fish_species}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {date && <span>📅 {date}</span>}
                        {spot && (
                          <span> · {spot.river_name ?? spot.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-gray-800">
                        {c.length_cm ?? '—'}
                        <span className="text-xs font-normal text-gray-400 ml-0.5">
                          cm
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {c.weight_g != null
                          ? `${(c.weight_g / 1000).toFixed(2)}kg`
                          : '—'}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">
              今日の釣りの状況
            </h2>
            <span className="text-xs text-gray-400">準備中</span>
          </div>
          <p className="text-sm text-gray-400 py-4 text-center">
            天気・潮汐・水温は外部 API 接続後に表示予定
          </p>
        </section>
      </main>
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit: string
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-800 leading-none">
        {value}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </div>
    </div>
  )
}

type Tone = 'sky' | 'emerald' | 'violet'

function KpiCard({
  icon,
  label,
  value,
  unit,
  footer,
  href,
  tone,
}: {
  icon: string
  label: string
  value: string
  unit: string
  footer: string
  href: string
  tone: Tone
}) {
  const toneClasses: Record<Tone, string> = {
    sky: 'bg-sky-100 text-sky-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    violet: 'bg-violet-100 text-violet-600',
  }
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl shadow-sm p-3 flex flex-col hover:shadow-md transition"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${toneClasses[tone]}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-xs text-gray-500 truncate">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-800 leading-tight">
        {value}
        <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1 truncate">{footer} ›</div>
    </Link>
  )
}
