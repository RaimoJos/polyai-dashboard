/**
 * Form validation utilities
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number (flexible format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Check for valid phone pattern (7-15 digits, optional + prefix)
  const phoneRegex = /^\+?[0-9]{7,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL format
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate number is within range
 * @param {number} value - Number to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} True if within range
 */
export function isInRange(value, min, max) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate percentage (0-100)
 * @param {number} value - Value to validate
 * @returns {boolean} True if valid percentage
 */
export function isValidPercentage(value) {
  return isInRange(value, 0, 100);
}

/**
 * Validate positive number
 * @param {number} value - Value to validate
 * @returns {boolean} True if positive number
 */
export function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate non-empty string
 * @param {string} value - Value to validate
 * @returns {boolean} True if non-empty string
 */
export function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate string length
 * @param {string} value - String to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {boolean} True if within length range
 */
export function isValidLength(value, min, max) {
  if (typeof value !== 'string') return false;
  const len = value.trim().length;
  return len >= min && len <= max;
}

/**
 * Validate form data against rules
 * @param {object} data - Form data object
 * @param {object} rules - Validation rules { field: { required, email, phone, min, max, custom } }
 * @returns {{ isValid: boolean, errors: object }} Validation result
 */
export function validateForm(data, rules) {
  const errors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    // Required check
    if (rule.required && !isNonEmpty(String(value ?? ''))) {
      errors[field] = rule.message || `${field} is required`;
      continue;
    }

    // Skip other validations if empty and not required
    if (!value && !rule.required) continue;

    // Email validation
    if (rule.email && !isValidEmail(value)) {
      errors[field] = rule.emailMessage || 'Invalid email format';
      continue;
    }

    // Phone validation
    if (rule.phone && !isValidPhone(value)) {
      errors[field] = rule.phoneMessage || 'Invalid phone format';
      continue;
    }

    // URL validation
    if (rule.url && !isValidUrl(value)) {
      errors[field] = rule.urlMessage || 'Invalid URL format';
      continue;
    }

    // Range validation
    if (rule.min !== undefined || rule.max !== undefined) {
      const num = Number(value);
      if (rule.min !== undefined && num < rule.min) {
        errors[field] = rule.rangeMessage || `Must be at least ${rule.min}`;
        continue;
      }
      if (rule.max !== undefined && num > rule.max) {
        errors[field] = rule.rangeMessage || `Must be at most ${rule.max}`;
        continue;
      }
    }

    // Length validation
    if (rule.minLength !== undefined || rule.maxLength !== undefined) {
      const len = String(value).trim().length;
      if (rule.minLength !== undefined && len < rule.minLength) {
        errors[field] = rule.lengthMessage || `Must be at least ${rule.minLength} characters`;
        continue;
      }
      if (rule.maxLength !== undefined && len > rule.maxLength) {
        errors[field] = rule.lengthMessage || `Must be at most ${rule.maxLength} characters`;
        continue;
      }
    }

    // Custom validation
    if (rule.custom && typeof rule.custom === 'function') {
      const customResult = rule.custom(value, data);
      if (customResult !== true) {
        errors[field] = customResult || `Invalid ${field}`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export default {
  isValidEmail,
  isValidPhone,
  isValidUrl,
  isInRange,
  isValidPercentage,
  isPositiveNumber,
  isNonEmpty,
  isValidLength,
  validateForm,
};
