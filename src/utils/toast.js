/**
 * Toast notification utilities using react-hot-toast
 * Provides a consistent notification API across the app
 */

import toast from 'react-hot-toast';

// Custom toast styling to match Polywerk theme
const toastOptions = {
  style: {
    background: '#111313',
    color: '#ffffff',
    border: '1px solid #1f2424',
    borderRadius: '8px',
    padding: '12px 16px',
  },
  duration: 4000,
};

/**
 * Show a success toast
 * @param {string} message - Message to display
 * @param {object} options - Additional toast options
 */
export function showSuccess(message, options = {}) {
  return toast.success(message, {
    ...toastOptions,
    iconTheme: {
      primary: '#22c55e',
      secondary: '#ffffff',
    },
    ...options,
  });
}

/**
 * Show an error toast
 * @param {string} message - Message to display
 * @param {object} options - Additional toast options
 */
export function showError(message, options = {}) {
  return toast.error(message, {
    ...toastOptions,
    duration: 5000,
    iconTheme: {
      primary: '#ef4444',
      secondary: '#ffffff',
    },
    ...options,
  });
}

/**
 * Show an info toast
 * @param {string} message - Message to display
 * @param {object} options - Additional toast options
 */
export function showInfo(message, options = {}) {
  return toast(message, {
    ...toastOptions,
    icon: 'ℹ️',
    ...options,
  });
}

/**
 * Show a warning toast
 * @param {string} message - Message to display
 * @param {object} options - Additional toast options
 */
export function showWarning(message, options = {}) {
  return toast(message, {
    ...toastOptions,
    icon: '⚠️',
    style: {
      ...toastOptions.style,
      borderColor: '#f59e0b',
    },
    ...options,
  });
}

/**
 * Show a loading toast (returns ID to dismiss later)
 * @param {string} message - Message to display
 * @returns {string} Toast ID for dismissing
 */
export function showLoading(message) {
  return toast.loading(message, {
    ...toastOptions,
  });
}

/**
 * Dismiss a toast by ID
 * @param {string} toastId - Toast ID to dismiss
 */
export function dismiss(toastId) {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAll() {
  toast.dismiss();
}

/**
 * Promise-based toast for async operations
 * @param {Promise} promise - Promise to track
 * @param {object} messages - { loading, success, error } messages
 * @returns {Promise} The original promise result
 */
export function showPromise(promise, messages) {
  return toast.promise(promise, messages, {
    ...toastOptions,
    loading: {
      ...toastOptions,
    },
    success: {
      ...toastOptions,
      iconTheme: {
        primary: '#22c55e',
        secondary: '#ffffff',
      },
    },
    error: {
      ...toastOptions,
      iconTheme: {
        primary: '#ef4444',
        secondary: '#ffffff',
      },
    },
  });
}

export default {
  success: showSuccess,
  error: showError,
  info: showInfo,
  warning: showWarning,
  loading: showLoading,
  dismiss,
  dismissAll,
  promise: showPromise,
};
