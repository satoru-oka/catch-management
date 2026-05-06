import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FullScreenSpinner, Spinner } from '@/lib/Loading'

describe('Spinner', () => {
  it('デフォルトラベルを表示する', () => {
    render(<Spinner />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('指定したラベルを表示する', () => {
    render(<Spinner label="保存中" />)
    expect(screen.getByText('保存中...')).toBeInTheDocument()
  })

  it('aria-live="polite" を持つ status ロールである', () => {
    render(<Spinner />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })
})

describe('FullScreenSpinner', () => {
  it('内部の Spinner がデフォルトラベルを表示する', () => {
    render(<FullScreenSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('ラベルを Spinner に伝搬する', () => {
    render(<FullScreenSpinner label="認証確認中" />)
    expect(screen.getByText('認証確認中...')).toBeInTheDocument()
  })
})
