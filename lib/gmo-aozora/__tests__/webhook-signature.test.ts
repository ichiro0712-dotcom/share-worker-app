import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { verifyWebhookSignature } from '../webhook-signature'

test('valid webhook signature passes', () => {
  const body = JSON.stringify({ messageId: 'msg_1', amount: 1000 })
  const secret = 'test-secret'
  const signature = createHmac('sha256', secret).update(body).digest('base64')

  assert.equal(verifyWebhookSignature(body, `sha256=${signature}`, secret), true)
})

test('invalid webhook signature fails', () => {
  const body = JSON.stringify({ messageId: 'msg_1', amount: 1000 })
  const signature = createHmac('sha256', 'other-secret').update(body).digest('base64')

  assert.equal(verifyWebhookSignature(body, signature, 'test-secret'), false)
})

test('empty webhook signature or secret fails', () => {
  assert.equal(verifyWebhookSignature('{}', '', 'test-secret'), false)
  assert.equal(verifyWebhookSignature('{}', null, 'test-secret'), false)
  assert.equal(verifyWebhookSignature('{}', 'signature', ''), false)
})
