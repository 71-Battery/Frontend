import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeChatPayload } from '../src/api/chatMapper.js'

test('normalizes a raw Campus AI response and sorts document sources by score', () => {
  const result = normalizeChatPayload({
    answer: '현장실습 안내입니다.',
    has_context: true,
    sources: [
      { category: '교육과정', document: '교육과정.md', snippet: '두 번째 근거', score: 1.4 },
      { category: '기업 협력사', document: '협력사.md', snippet: '첫 번째 근거', score: 1.2 },
    ],
    request_id: 'request-1',
  })

  assert.equal(result.answer, '현장실습 안내입니다.')
  assert.equal(result.hasContext, true)
  assert.equal(result.sources[0].document, '협력사.md')
  assert.equal(result.sources[0].type, 'DOCUMENT')
  assert.equal(result.requestId, 'request-1')
})

test('normalizes a wrapped response while preserving clickable internal sources', () => {
  const result = normalizeChatPayload({
    status: 'OK',
    data: {
      answer: '일정을 확인하세요.',
      sources: [{
        type: 'SCHEDULE',
        id: 'schedule-1',
        title: '보고서 제출',
        date: '2026-07-25',
      }],
    },
  })

  assert.equal(result.sources[0].kind, 'INTERNAL')
  assert.equal(result.sources[0].id, 'schedule-1')
})

test('treats has_context false as a successful answer with no evidence', () => {
  const result = normalizeChatPayload({
    data: {
      response: {
        answer: '지식베이스에 해당 정보가 없습니다.',
        has_context: false,
        sources: [{ category: '무시', document: 'stale.md', snippet: '표시하지 않음' }],
      },
    },
  })

  assert.equal(result.hasContext, false)
  assert.deepEqual(result.sources, [])
})

test('returns null for a response without an answer', () => {
  assert.equal(normalizeChatPayload({ data: { sources: [] } }), null)
  assert.equal(normalizeChatPayload({ status: 'OK', message: 'success' }), null)
})
