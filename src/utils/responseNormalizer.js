/**
 * ResponseNormalizer - Handles inconsistent backend response formats
 * Converts various response formats to expected shapes
 */

/**
 * Normalize response to array
 * Handles: [], {data: []}, {items: []}, {records: []}, {spools: []}, null, undefined
 */
export function toArray(response, defaultValue = []) {
  if (!response) return defaultValue;
  
  // Already an array
  if (Array.isArray(response)) return response;
  
  // Object - check for array properties
  if (typeof response === 'object') {
    // Try common array property names
    const arrayProps = [
      'data',
      'items',
      'records',
      'spools',
      'jobs',
      'entries',
      'prints',
      'history',
      'messages',
      'files',
      'printers',
      'orders',
      'clients',
      'invoices',
      'results',
      'list',
      'users',
      'logs',
      'issues',
      'failures',
      'alerts',
    ];
    
    for (const prop of arrayProps) {
      if (Array.isArray(response[prop])) {
        return response[prop];
      }
    }
    
    // If response has a count property, it's likely paginated - return data if exists
    if (response.count !== undefined) {
      if (Array.isArray(response.data)) return response.data;
      if (Array.isArray(response.items)) return response.items;
    }
  }
  
  // Couldn't extract array - return default
  console.warn('[ResponseNormalizer] Could not extract array from response:', response);
  return defaultValue;
}

/**
 * Normalize response to object
 * Handles: {}, null, undefined, arrays (returns as-is with warning)
 */
export function toObject(response, defaultValue = {}) {
  if (!response) return defaultValue;
  
  if (typeof response === 'object' && !Array.isArray(response)) {
    return response;
  }
  
  if (Array.isArray(response)) {
    console.warn('[ResponseNormalizer] Received array when object expected:', response);
    return defaultValue;
  }
  
  return defaultValue;
}

/**
 * Smart normalizer - detects what type is needed based on context
 */
export function normalize(response, options = {}) {
  const { type = 'auto', default: defaultValue = null } = options;
  
  if (type === 'array') {
    return toArray(response, Array.isArray(defaultValue) ? defaultValue : []);
  }
  
  if (type === 'object') {
    return toObject(response, typeof defaultValue === 'object' && !Array.isArray(defaultValue) ? defaultValue : {});
  }
  
  // Auto-detect
  if (Array.isArray(response)) return response;
  if (typeof response === 'object' && response !== null) return response;
  return defaultValue;
}

/**
 * Pagination helper - extract count/total from various response formats
 */
export function getCount(response) {
  if (!response || typeof response !== 'object') return 0;
  return response.count ?? response.total ?? response.length ?? 0;
}

/**
 * Error response detector
 */
export function isErrorResponse(response) {
  if (!response || typeof response !== 'object') return false;
  return response.error !== undefined || 
         response.success === false || 
         response.status === 'error';
}

/**
 * Pagination info extractor
 */
export function getPaginationInfo(response) {
  if (!response || typeof response !== 'object') {
    return { count: 0, total: 0, page: 1, pages: 1 };
  }
  
  return {
    count: response.count ?? response.total ?? 0,
    total: response.total ?? response.count ?? 0,
    page: response.page ?? 1,
    pages: response.pages ?? 1,
    limit: response.limit ?? response.per_page ?? 50,
  };
}
