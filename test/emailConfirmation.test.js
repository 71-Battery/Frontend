import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMAIL_CONFIRMATION_PATH,
  resolveInitialRoute,
} from '../src/api/emailConfirmation.js'

const validToken = 'header.payload.signature'

test('keeps the root path on the normal application', () => {
  assert.deepEqual(
    resolveInitialRoute({ pathname: '/', search: '', hash: '' }),
    { kind: 'app' },
  )
})

test('accepts a Supabase signup callback with a JWT access token', () => {
  assert.deepEqual(
    resolveInitialRoute({
      pathname: EMAIL_CONFIRMATION_PATH,
      search: '',
      hash: `#access_token=${validToken}&type=signup`,
    }),
    {
      kind: 'email-confirmation',
      accessToken: validToken,
    },
  )
})

test('redirects direct, errored, and non-signup confirmation access', () => {
  const invalidLocations = [
    { pathname: EMAIL_CONFIRMATION_PATH, search: '', hash: '' },
    {
      pathname: EMAIL_CONFIRMATION_PATH,
      search: '',
      hash: '#error=access_denied&type=signup',
    },
    {
      pathname: EMAIL_CONFIRMATION_PATH,
      search: '',
      hash: `#access_token=${validToken}&type=recovery`,
    },
    { pathname: '/unknown', search: '', hash: '' },
  ]

  invalidLocations.forEach((location) => {
    assert.deepEqual(resolveInitialRoute(location), { kind: 'redirect' })
  })
})
