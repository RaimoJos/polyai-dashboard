/**
 * Input Sanitization Utilities
 * 
 * Prevent XSS attacks by sanitizing user input.
 * Use when displaying user-generated content.
 */

/**
 * Sanitize plain text - remove any HTML/script tags
 * Safe to use in React JSX (text content)
 * 
 * @param {string} text - Text to sanitize
 * @returns {string} Clean text with HTML entities escaped
 */
export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Create a text node and convert back to string
  return document.createElement('div').appendChild(
    document.createTextNode(text)
  ).parentNode.innerHTML;
}

/**
 * Sanitize HTML content using allowlist approach
 * 
 * @param {string} html - HTML to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html, options = {}) {
  if (!html || typeof html !== 'string') return '';

  const {
    allowedTags = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    allowedAttributes = { 'a': ['href', 'title'] },
    removeUnknownTags = true,
  } = options;

  try {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const walk = (node) => {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const child = node.childNodes[i];

        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();

          if (!allowedTags.includes(tag)) {
            if (removeUnknownTags) {
              while (child.firstChild) {
                node.insertBefore(child.firstChild, child);
              }
              node.removeChild(child);
            } else {
              node.removeChild(child);
            }
          } else {
            const allowed = allowedAttributes[tag] || [];
            for (let j = child.attributes.length - 1; j >= 0; j--) {
              const attr = child.attributes[j];
              if (!allowed.includes(attr.name)) {
                child.removeAttribute(attr.name);
              }
            }

            // Sanitize href to prevent javascript: URLs
            if (tag === 'a' && child.getAttribute('href')) {
              const href = child.getAttribute('href');
              if (href.startsWith('javascript:') || href.startsWith('data:')) {
                child.removeAttribute('href');
              }
            }

            walk(child);
          }
        }
      }
    };

    walk(temp);
    return temp.innerHTML;
  } catch (error) {
    console.error('HTML sanitization error:', error);
    return sanitizeText(html);
  }
}

/**
 * Sanitize URL to prevent javascript: and data: URLs
 * 
 * @param {string} url - URL to sanitize
 * @param {boolean} allowRelative - Allow relative URLs
 * @returns {string} Sanitized URL
 */
export function sanitizeUrl(url, allowRelative = true) {
  if (!url || typeof url !== 'string') return '';

  const trimmedUrl = url.trim();

  // Block javascript: and data: URLs
  if (
    trimmedUrl.startsWith('javascript:') ||
    trimmedUrl.startsWith('data:') ||
    trimmedUrl.startsWith('vbscript:')
  ) {
    return '';
  }

  // Allow relative URLs
  if (allowRelative && trimmedUrl.startsWith('/')) {
    return trimmedUrl;
  }

  // Validate absolute URLs
  try {
    const urlObj = new URL(trimmedUrl);
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return urlObj.toString();
  } catch {
    // Not a valid absolute URL
    if (allowRelative) return '';
    return '';
  }
}

/**
 * Sanitize object by recursively cleaning string values
 * 
 * @param {Object} obj - Object to sanitize
 * @param {Function} sanitizer - Sanitization function (default: sanitizeText)
 * @returns {Object} Sanitized object
 */
export function sanitizeObject(obj, sanitizer = sanitizeText) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sanitizer));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizer(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, sanitizer);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Create safe innerHTML using DOMPurify-like approach
 * Use with React: dangerouslySetInnerHTML={{ __html: createSafeHtml(...) }}
 * 
 * @param {string} html - HTML to create safely
 * @param {Object} options - Sanitization options
 * @returns {Object} Object safe for dangerouslySetInnerHTML
 */
export function createSafeHtml(html, options = {}) {
  return {
    __html: sanitizeHtml(html, options),
  };
}

export default {
  sanitizeText,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeObject,
  createSafeHtml,
};
