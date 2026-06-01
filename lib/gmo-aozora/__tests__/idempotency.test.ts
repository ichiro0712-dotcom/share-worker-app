import assert from 'node:assert/strict'
import test from 'node:test'
import { generateIdempotencyKey, isValidIdempotencyKey } from '../idempotency'

test('generated idempotency key uses printable ASCII and stays within 128 chars', () => {
  const key = generateIdempotencyKey('worker-123')

  assert.match(key, /^[\x21-\x7E]{1,128}$/)
})

test('idempotency key validator accepts printable ASCII only', () => {
  assert.equal(isValidIdempotencyKey('abc-ABC_123.!~'), true)
  assert.equal(isValidIdempotencyKey(''), false)
  assert.equal(isValidIdempotencyKey('has space'), false)
  assert.equal(isValidIdempotencyKey('has\ttab'), false)
  assert.equal(isValidIdempotencyKey('改行なしでも日本語'), false)
  assert.equal(isValidIdempotencyKey('a'.repeat(129)), false)
})
