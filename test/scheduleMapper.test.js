import test from 'node:test'
import assert from 'node:assert/strict'

import { getDefaultScheduleRange, mapAndSortSchedules } from '../src/api/scheduleMapper.js'

test('uses today through the end of next month in Asia/Seoul', () => {
  assert.deepEqual(
    getDefaultScheduleRange(new Date('2026-07-22T15:30:00.000Z')),
    {
      fromDate: '2026-07-23',
      toDate: '2026-08-31',
    },
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
