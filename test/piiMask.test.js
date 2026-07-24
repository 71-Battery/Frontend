import test from 'node:test'
import assert from 'node:assert/strict'

import {
  displayEmail,
  displayName,
  displayStudentNumber,
  maskEmail,
  maskName,
  maskStudentNumber,
} from '../src/utils/piiMask.js'

test('masks names while preserving only the first and last character', () => {
  assert.equal(maskName('홍길동'), '홍*동')
  assert.equal(maskName('김민'), '김*')
  assert.equal(maskName('김'), '김')
})

test('masks the email local part while preserving its domain', () => {
  assert.equal(maskEmail('student1234@gsm.hs.kr'), 'stu******34@gsm.hs.kr')
  assert.equal(maskEmail('abcd@gsm.hs.kr'), 'a***@gsm.hs.kr')
})

test('masks all but the first two student-number digits', () => {
  assert.equal(maskStudentNumber(2103), '21**')
  assert.equal(maskStudentNumber('210301'), '21****')
})

test('reveals personal information only after explicit opt-in', () => {
  assert.equal(displayName('홍길동', false), '홍*동')
  assert.equal(displayEmail('student@gsm.hs.kr', false), 'stu**nt@gsm.hs.kr')
  assert.equal(displayStudentNumber(2103, false), '21**')
  assert.equal(displayName('홍길동', true), '홍길동')
  assert.equal(displayEmail('student@gsm.hs.kr', true), 'student@gsm.hs.kr')
  assert.equal(displayStudentNumber(2103, true), '2103')
})
