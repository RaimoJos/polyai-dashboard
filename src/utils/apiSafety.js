/**
 * API Response Validation and Error Formatting
 * 
 * Provides safe response handling and user-friendly error messages.
 */

/**
 * Validate API response structure
 * 
 * @param {*} response - Response to validate
 * @param {string} expectedType - Expected data type (object, array, string, number)
 * @returns {{ valid: boolean, data: *, error?: string }}
 */
export function validateResponse(response, expectedType = 'object') {
  if (!response) {
    return {
      valid: false,
      data: null,
      error: 'Empty response received',
    };
  }

  if (typeof response !== 'object') {
    return {
      valid: false,
      data: null,
      error: 'Invalid response format',
    };
  }

  // Handle error responses
  if (response.success === false) {
    return {
      valid: false,
      data: null,
      error: response.error || response.message || 'Request failed',
      status: response.status,
    };
  }

  // Check for data property
  let data = response.data || response;

  // Validate data type if specified
  if (expectedType === 'array' && !Array.isArray(data)) {
    return {
      valid: false,
      data: [],
      error: 'Expected array response',
    };
  }

  if (expectedType === 'object' && typeof data !== 'object') {
    return {
      valid: false,
      data: null,
      error: 'Expected object response',
    };
  }

  return {
    valid: true,
    data: data,
  };
}

/**
 * Safely unwrap API response
 * Returns data or throws error with proper format
 * 
 * @param {*} response - Response to unwrap
 * @param {string} expectedType - Expected data type
 * @returns {*} Response data
 * @throws {Error} If response is invalid
 */
export function safeUnwrap(response, expectedType = 'object') {
  const validation = validateResponse(response, expectedType);
  
  if (!validation.valid) {
    const error = new Error(validation.error);
    error.status = validation.status;
    error.originalResponse = response;
    throw error;
  }

  return validation.data;
}

/**
 * Format error for user display
 * Converts technical errors to friendly messages
 * 
 * @param {Error|string} error - Error to format
 * @param {Object} context - Context information
 * @returns {string} User-friendly error message
 */
export function formatErrorMessage(error, context = {}) {
  if (typeof error === 'string') {
    return error;
  }

  if (!error) {
    return 'An unknown error occurred. Please try again.';
  }

  const status = error.status || error.response?.status;
  const message = error.message || error.error || String(error);
  const action = context.action || 'complete this action';

  // HTTP status-based messages
  if (status === 400) {
    return `Invalid request. Please check your input and try again.`;
  }

  if (status === 401) {
    return 'You are not authenticated. Please log in again.';
  }

  if (status === 403) {
    return `You do not have permission to ${action}. Contact your administrator.`;
  }

  if (status === 404) {
    return 'The requested resource was not found.';
  }

  if (status === 409) {
    return 'This resource already exists or conflicts with existing data.';
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (status === 500) {
    return 'Server error. Please try again later or contact support.';
  }

  if (status === 503) {
    return 'Service unavailable. The server is temporarily down.';
  }

  // Network errors
  if (message.includes('timeout')) {
    return 'Request timed out. Please check your connection and try again.';
  }

  if (message.includes('network') || message.includes('offline')) {
    return 'Network error. Please check your internet connection.';
  }

  // Default: use original message
  if (message && message.length < 200) {
    return message;
  }

  return 'An error occurred. Please try again or contact support.';
}

/**
 * Create error object with context
 * 
 * @param {string} message - Error message
 * @param {Object} context - Context information
 * @returns {Error} Error object with context
 */
export function createError(message, context = {}) {
  const error = new Error(message);
  Object.assign(error, context);
  return error;
}

/**
 * Log error with context for debugging
 * 
 * @param {Error} error - Error to log
 * @param {Object} context - Context information
 */
export function logError(error, context = {}) {
  const errorData = {
    message: error?.message || String(error),
    status: error?.status,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    context,
  };

  console.error('[API Error]', errorData);

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Could use Sentry, LogRocket, etc.
    try {
      fetch('/api/v1/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {}); // Silently fail
    } catch (e) {
      // Ignore logging errors
    }
  }
}

/**
 * Retry a failed request with exponential backoff
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<*>} Result of function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
    shouldRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry 4xx errors (client fault)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );

      console.log(
        `[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export default {
  validateResponse,
  safeUnwrap,
  formatErrorMessage,
  createError,
  logError,
  retryWithBackoff,
};
