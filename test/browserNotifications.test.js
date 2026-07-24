import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isPageInBackground,
  requestNotificationPermission,
  shouldNotifyForAnswer,
  showBackgroundNotification,
} from '../src/api/browserNotifications.js'

test('detects a hidden or unfocused page', () => {
  assert.equal(isPageInBackground({ hidden: true, hasFocus: () => true }), true)
  assert.equal(isPageInBackground({ hidden: false, hasFocus: () => false }), true)
  assert.equal(isPageInBackground({ hidden: false, hasFocus: () => true }), false)
})

test('notifies only while another GSM VITA menu is active', () => {
  assert.equal(shouldNotifyForAnswer({ notificationsEnabled: true, activeView: 'home' }), true)
  assert.equal(shouldNotifyForAnswer({ notificationsEnabled: true, activeView: 'timeline' }), true)
  assert.equal(shouldNotifyForAnswer({ notificationsEnabled: true, activeView: 'chat' }), false)
  assert.equal(shouldNotifyForAnswer({ notificationsEnabled: false, activeView: 'home' }), false)
})

test('requests notification permission only when it is undecided', async () => {
  let requests = 0
  const permission = await requestNotificationPermission({
    permission: 'default',
    requestPermission: async () => {
      requests += 1
      return 'granted'
    },
  })

  assert.equal(permission, 'granted')
  assert.equal(requests, 1)
  assert.equal(await requestNotificationPermission({ permission: 'denied' }), 'denied')
})

test('shows a browser notification only while the page is in the background', () => {
  const created = []
  class FakeNotification {
    static permission = 'granted'

    constructor(title, options) {
      created.push({ title, options })
    }

    close() {}
  }

  assert.equal(showBackgroundNotification({
    title: 'AI 답변',
    body: '답변이 도착했습니다.',
    NotificationApi: FakeNotification,
    documentObject: { hidden: false, hasFocus: () => true },
  }), false)
  assert.equal(showBackgroundNotification({
    title: 'AI 답변',
    body: '답변이 도착했습니다.',
    NotificationApi: FakeNotification,
    documentObject: { hidden: true, hasFocus: () => false },
  }), true)
  assert.equal(created.length, 1)
})
