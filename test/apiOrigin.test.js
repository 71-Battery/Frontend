import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeApiBaseUrl } from '../src/api/apiOrigin.js'

test('allows an HTTPS API origin and removes trailing slashes', () => {
  assert.equal(
    normalizeApiBaseUrl('https://gsm-api.onrender.com///'),
    'https://gsm-api.onrender.com',
  )
})

test('allows HTTP only for local development', () => {
  assert.equal(normalizeApiBaseUrl('http://localhost:3000'), 'http://localhost:3000')
  assert.throws(() => normalizeApiBaseUrl('http://api.example.com'), /HTTPS/)
})

test('rejects credentials, queries, and non-absolute values', () => {
  assert.throws(() => normalizeApiBaseUrl('https://user:pass@example.com'), /인증 정보/)
  assert.throws(() => normalizeApiBaseUrl('https://example.com?token=value'), /쿼리/)
  assert.throws(() => normalizeApiBaseUrl('api.example.com'), /형식/)
})
