import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCalendarMonth, getCalendarMonths } from '../src/api/calendarMapper.js'

test('creates every calendar month touched by the 90-day range', () => {
  assert.deepEqual(
    getCalendarMonths('2026-07-23', '2026-10-20').map((month) => month.key),
    ['2026-07', '2026-08', '2026-09', '2026-10'],
  )
})

test('builds a month grid and attaches schedules to their date', () => {
  const [july] = getCalendarMonths('2026-07-23', '2026-10-20')
  const cells = buildCalendarMonth(july, '2026-07-23', '2026-10-20', [
    { id: 'schedule-1', scheduleDate: '2026-07-25', title: '프로젝트 제출' },
  ])
  const today = cells.find((cell) => cell.scheduleDate === '2026-07-23')
  const scheduled = cells.find((cell) => cell.scheduleDate === '2026-07-25')
  const beforeRange = cells.find((cell) => cell.scheduleDate === '2026-07-22')

  assert.equal(cells.length % 7, 0)
  assert.equal(today.isToday, true)
  assert.equal(scheduled.events[0].id, 'schedule-1')
  assert.equal(beforeRange.inRange, false)
})
