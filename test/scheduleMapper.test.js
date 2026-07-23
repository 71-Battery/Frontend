import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getDefaultScheduleRange,
  getSchedulePageCount,
  getSchedulePageIndex,
  getSchedulesForPage,
  mapAndSortSchedules,
} from '../src/api/scheduleMapper.js'

test('uses a 90-day inclusive range in Asia/Seoul', () => {
  assert.deepEqual(
    getDefaultScheduleRange(new Date('2026-07-22T15:30:00.000Z')),
    {
      fromDate: '2026-07-23',
      toDate: '2026-10-20',
    },
  )
})

test('splits schedules into 30-day pages with a 90-day maximum', () => {
  const schedules = [
    { id: 'day-0', ddayValue: 0 },
    { id: 'day-29', ddayValue: 29 },
    { id: 'day-30', ddayValue: 30 },
    { id: 'day-59', ddayValue: 59 },
    { id: 'day-60', ddayValue: 60 },
    { id: 'day-89', ddayValue: 89 },
    { id: 'day-90', ddayValue: 90 },
  ]

  assert.deepEqual(schedules.map(getSchedulePageIndex), [0, 0, 1, 1, 2, 2, -1])
  assert.equal(getSchedulePageCount(schedules), 3)
  assert.deepEqual(
    getSchedulesForPage(schedules, 1).map((schedule) => schedule.id),
    ['day-30', 'day-59'],
  )
})

test('sorts timeline schedules by date before student importance', () => {
  const base = {
    schoolCode: '7430310',
    schoolName: '광주소프트웨어마이스터고등학교',
    officeCode: 'G10',
    officeName: '광주광역시교육청',
    academicYear: '2026',
    eventContent: '',
    dayCategory: '학사일정',
    schoolCourseType: '고등학교',
    dayNightType: '주간',
  }
  const schedules = mapAndSortSchedules([
    {
      ...base,
      scheduleId: 'late-personal',
      scheduleDate: '2026-08-29',
      eventName: '2학년 일정',
      targetGrades: [2],
    },
    {
      ...base,
      scheduleId: 'early-other',
      scheduleDate: '2026-07-24',
      eventName: '1학년 일정',
      targetGrades: [1],
    },
  ], 2, new Date('2026-07-23T00:00:00.000Z'))

  assert.deepEqual(schedules.map((schedule) => schedule.id), [
    'early-other',
    'late-personal',
  ])
})
