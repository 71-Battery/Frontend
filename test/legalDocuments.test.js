import test from 'node:test'
import assert from 'node:assert/strict'
import { getLegalDocument, LEGAL_DOCUMENTS } from '../src/legalDocuments.js'

test('provides separate required terms and privacy documents', () => {
  assert.equal(getLegalDocument('terms'), LEGAL_DOCUMENTS.terms)
  assert.equal(getLegalDocument('privacy'), LEGAL_DOCUMENTS.privacy)
  assert.equal(getLegalDocument('unknown'), null)
})

test('each legal document has an effective date and substantive clauses', () => {
  for (const document of Object.values(LEGAL_DOCUMENTS)) {
    assert.match(document.effectiveDate, /^\d{4}년 \d{1,2}월 \d{1,2}일$/)
    assert.ok(document.sections.length >= 8)
    assert.ok(document.sections.every((section) => section.title.startsWith('제')))
  }
})

test('privacy notice explains required consent and external integrations', () => {
  const text = JSON.stringify(LEGAL_DOCUMENTS.privacy)
  assert.match(text, /동의하지 않을 권리/)
  assert.match(text, /Data-GSM/)
  assert.match(text, /Supabase/)
  assert.match(text, /Campus AI/)
})
