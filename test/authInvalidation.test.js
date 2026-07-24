import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldInvalidateAuthenticatedSession } from '../src/api/httpClient.js'

test('invalidates a stored session when an authenticated user is gone', () => {
  assert.equal(shouldInvalidateAuthenticatedSession({
    authToken: 'access-token',
    status: 410,
    code: 'ACCOUNT_REMOVED',
  }), true)
  assert.equal(shouldInvalidateAuthenticatedSession({
    authToken: 'access-token',
    status: 404,
    code: 'USER_NOT_FOUND',
  }), true)
})

test('does not invalidate the current session for anonymous form errors', () => {
  assert.equal(shouldInvalidateAuthenticatedSession({
    authToken: '',
    status: 401,
    code: 'INVALID_CREDENTIALS',
  }), false)
  assert.equal(shouldInvalidateAuthenticatedSession({
    authToken: 'access-token',
    status: 400,
    code: 'STUDENT_IDENTITY_MISMATCH',
  }), false)
})
