/**
 * Safe JSON parsing utilities to prevent app crashes from corrupted data
 */

/**
 * Safely parse JSON string with fallback
 * @param {string} jsonString - The JSON string to parse
 * @param {*} fallback - Default value if parsing fails (default: null)
 * @returns {*} Parsed object or fallback value
 */
export function safeJsonParse(jsonString, fallback = null) {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error.message);
    return fallback;
  }
}

/**
 * Safely get and parse JSON from localStorage
 * @param {string} key - localStorage key
 * @param {*} fallback - Default value if not found or parsing fails
 * @returns {*} Parsed object or fallback value
 */
export function getLocalStorageJson(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      return fallback;
    }
    return safeJsonParse(item, fallback);
  } catch (error) {
    console.warn(`Failed to get localStorage key "${key}":`, error.message);
    return fallback;
  }
}

/**
 * Safely set JSON to localStorage
 * @param {string} key - localStorage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful
 */
export function setLocalStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage key "${key}":`, error.message);
    return false;
  }
}

export default {
  parse: safeJsonParse,
  getStorage: getLocalStorageJson,
  setStorage: setLocalStorageJson,
};
