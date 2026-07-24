import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeContentResources,
  normalizeContentResource,
  RESOURCE_TYPES,
} from '../src/api/resourceMapper.js'

const profile = {
  grade: 3,
  major: 'SW_DEVELOPMENT',
}

test('normalizes proactive Campus AI notification metadata', () => {
  const notification = normalizeContentResource({
    id: 'ai-notice:1',
    sourceId: 'db-notice-1',
    title: '현장실습 안내',
    summary: '8월 1일까지 신청하세요.',
    content: '신청서 제출 안내',
    category: 'AI 알림',
    department: 'AI 공지 브리핑',
    publishedAt: '2026-07-24T00:00:00Z',
    targetGrades: [3],
    targetMajors: ['SW_DEVELOPMENT'],
    isProactive: true,
    notified: true,
    summaryProvider: 'bedrock',
  }, RESOURCE_TYPES.NOTICE, profile)

  assert.equal(notification.isProactive, true)
  assert.equal(notification.notified, true)
  assert.equal(notification.sourceId, 'db-notice-1')
  assert.equal(notification.summaryProvider, 'bedrock')
  assert.equal(notification.target, '3학년 · 소프트웨어개발과')
})

test('enriches a database notice instead of rendering a duplicate AI alert', () => {
  const databaseNotice = normalizeContentResource({
    id: 'db-notice-1',
    title: '현장실습 안내',
    summary: '기존 요약',
    content: '상세 원문',
    category: '학교생활',
    publishedAt: '2026-07-24T00:00:00Z',
  }, RESOURCE_TYPES.NOTICE, profile)
  const notification = normalizeContentResource({
    id: 'ai-notice:1',
    sourceId: 'db-notice-1',
    title: '현장실습 안내',
    summary: 'AI 요약',
    content: 'AI 원문',
    category: 'AI 알림',
    publishedAt: '2026-07-24T00:00:00Z',
    isProactive: true,
  }, RESOURCE_TYPES.NOTICE, profile)

  const merged = mergeContentResources({
    notices: [databaseNotice],
    notifications: [notification],
    regulations: [],
  })

  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'db-notice-1')
  assert.equal(merged[0].summary, 'AI 요약')
  assert.equal(merged[0].content, '상세 원문')
  assert.equal(merged[0].isProactive, true)
})
