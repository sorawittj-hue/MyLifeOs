/**
 * Haptic feedback utility using the Vibration API.
 * Patterns are defined as [vibrate, pause, vibrate, pause, ...] in milliseconds.
 */

export const haptics = {
  /**
   * Light tap for subtle interactions like button presses.
   */
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium tap for more significant interactions.
   */
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  },

  /**
   * Success feedback for completed actions or goals.
   */
  success: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 30, 10]);
    }
  },

  /**
   * Error feedback for failed actions.
   */
  error: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }
  },

  /**
   * Notification feedback for alerts.
   */
  notification: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 50, 30, 50, 30]);
    }
  }
};
