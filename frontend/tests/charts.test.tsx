/**
 * recharts の単体テストは挙動の細部 (SVG 座標等) ではなく
 * 「与えたデータが構造として渡され、コンポーネントが落ちないか」を確認する。
 *
 * jsdom 上の ResponsiveContainer は親要素の width=0 を観測してチャートを
 * レンダリングしないため、`width` と `height` を直接指定してバイパスする。
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    // ResponsiveContainer を素通し div に置き換え、固定サイズで子を描画
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 400, height: 220 }}>
        {children}
      </div>
    ),
  }
})

import { MonthlyBarChart, SpeciesPieChart } from '@/app/(protected)/stats/charts'

describe('MonthlyBarChart', () => {
  it('データを渡しても例外を投げず ResponsiveContainer を描画する', () => {
    const { getByTestId } = render(
      <MonthlyBarChart
        data={[
          { month: '2026-03', session_count: 1, catch_count: 2 },
          { month: '2026-04', session_count: 2, catch_count: 5 },
        ]}
      />,
    )
    expect(getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('空配列でもクラッシュしない', () => {
    const { getByTestId } = render(<MonthlyBarChart data={[]} />)
    expect(getByTestId('responsive-container')).toBeInTheDocument()
  })
})

describe('SpeciesPieChart', () => {
  it('データを渡しても例外を投げず ResponsiveContainer を描画する', () => {
    const { getByTestId } = render(
      <SpeciesPieChart
        data={[
          { name: 'ヤマメ', count: 3 },
          { name: 'イワナ', count: 1 },
        ]}
      />,
    )
    expect(getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('空配列でもクラッシュしない', () => {
    const { getByTestId } = render(<SpeciesPieChart data={[]} />)
    expect(getByTestId('responsive-container')).toBeInTheDocument()
  })
})
