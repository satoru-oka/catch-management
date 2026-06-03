import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BottomNav from '@/components/BottomNav'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

beforeEach(() => {
  pathname = '/'
})

describe('BottomNav', () => {
  it('各タブは Link として期待する href を持つ', () => {
    render(<BottomNav />)

    expect(screen.getByRole('link', { name: /ホーム/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /記録/ })).toHaveAttribute('href', '/sessions/new')
    expect(screen.getByRole('link', { name: /地図/ })).toHaveAttribute('href', '/spots')
    expect(screen.getByRole('link', { name: /統計/ })).toHaveAttribute('href', '/stats')
    expect(screen.getByRole('link', { name: /設定/ })).toHaveAttribute('href', '/settings')
  })

  it('ホームは / だけで active になる', () => {
    pathname = '/spots'

    render(<BottomNav />)

    expect(screen.getByRole('link', { name: /ホーム/ })).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('link', { name: /地図/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it.each([
    '/sessions/new',
    '/sessions/ses1',
    '/sessions/ses1/edit',
    '/sessions/ses1/catches/new',
    '/sessions/ses1/catches/catch1/edit',
  ])('%s で記録タブが active になる', (path) => {
    pathname = path

    render(<BottomNav />)

    expect(screen.getByRole('link', { name: /記録/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
