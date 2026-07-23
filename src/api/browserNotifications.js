export function isPageInBackground(documentObject = globalThis.document) {
  if (!documentObject) return false
  return documentObject.hidden === true || documentObject.hasFocus?.() === false
}

export async function requestNotificationPermission(NotificationApi = globalThis.Notification) {
  if (!NotificationApi) return 'unsupported'
  if (NotificationApi.permission === 'granted' || NotificationApi.permission === 'denied') {
    return NotificationApi.permission
  }

  try {
    return await NotificationApi.requestPermission()
  } catch {
    return 'denied'
  }
}

export function showBackgroundNotification({
  title,
  body,
  onClick,
  NotificationApi = globalThis.Notification,
  documentObject = globalThis.document,
}) {
  if (
    !NotificationApi
    || NotificationApi.permission !== 'granted'
    || !isPageInBackground(documentObject)
  ) {
    return false
  }

  try {
    const notification = new NotificationApi(title, {
      body,
      tag: 'gsm-compass-ai-answer',
    })
    notification.onclick = () => {
      onClick?.()
      notification.close?.()
    }
    return true
  } catch {
    return false
  }
}
