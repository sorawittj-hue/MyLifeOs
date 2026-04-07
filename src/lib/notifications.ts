export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  return new Notification(title, {
    icon: 'https://picsum.photos/seed/health/192/192',
    ...options
  });
}

export function scheduleNotification(title: string, options: NotificationOptions, delayMs: number) {
  setTimeout(() => {
    sendNotification(title, options);
  }, delayMs);
}
