import axios from 'axios';

// Base URLs
export const SERVER_ROOT = process.env.REACT_APP_SERVER_ROOT || 'http://localhost:5000';

// Ensure API base always includes /v1 version prefix
const rawApiBase = process.env.REACT_APP_API_BASE || `${SERVER_ROOT}/api/v1`;
// If someone sets REACT_APP_API_BASE without /v1, add it
export const API_BASE = rawApiBase.includes('/v1')
  ? rawApiBase
  : rawApiBase.replace(/\/api\/?$/, '/api/v1');

// Axios instance
const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cache endpoints that appear to be unimplemented (404/405) to avoid repeated network spam.
const _missingEndpointCache = new Set();

// Clear the cache - useful when server might have restarted
export function clearMissingEndpointCache() {
  _missingEndpointCache.clear();
  console.log('Cleared missing endpoint cache');
}

export class ApiError extends Error {
  constructor(message, { status, data, url, method } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.url = url;
    this.method = method;
  }
}

export function unwrap(resp) {
  const data = resp && typeof resp === 'object' && 'data' in resp ? resp.data : resp;
  if (!data || typeof data !== 'object') return data;
  if (data.success === false) {
    const msg = data.error || data.message || 'Request failed';
    throw new ApiError(msg, { status: data.status, data });
  }
  return data;
}

export function setAuthToken(token) {
  if (token && token !== 'session') {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
}

function statusFromError(err) {
  return err?.status ?? err?.response?.status ?? err?.cause?.response?.status;
}

function isAuthError(err) {
  const s = statusFromError(err);
  return s === 401 || s === 403;
}

function isMissingEndpoint(err) {
  const s = statusFromError(err);
  return s === 404 || s === 405;
}

async function safeUnwrap(method, paths, opts = {}) {
  const { defaultValue, ...rest } = opts;
  try {
    const resp = await requestWithFallback(method, paths, rest);
    return unwrap(resp);
  } catch (e) {
    if (isAuthError(e)) throw e;
    return defaultValue;
  }
}

async function tryRequest(method, url, { data, params, headers } = {}) {
  try {
    const resp = await http.request({ method, url, data, params, headers });
    return resp;
  } catch (err) {
    const status = err?.response?.status;
    const payload = err?.response?.data;
    const msg = payload?.error || payload?.message || err?.message || 'Request failed';
    throw new ApiError(msg, { status, data: payload, url, method });
  }
}

async function requestWithFallback(method, paths, opts = {}) {
  const errors = [];
  const { skipCache = false } = opts;
  
  for (const path of paths) {
    const cacheKey = `${method.toUpperCase()} ${path}`;
    
    // Skip cache check for certain critical endpoints
    const isCriticalEndpoint = path.includes('/upload') || path.includes('/login');
    
    if (!skipCache && !isCriticalEndpoint && _missingEndpointCache.has(cacheKey)) {
      errors.push({ path, status: 404, message: 'cached missing' });
      continue;
    }
    try {
      return await tryRequest(method, path, opts);
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) throw e;
      if (!isCriticalEndpoint && (e?.status === 404 || e?.status === 405)) {
        _missingEndpointCache.add(cacheKey);
      }
      errors.push({ path, status: e?.status, message: e?.message });
    }
  }
  const last = errors[errors.length - 1];
  const msg = last ? `All endpoints failed. Last: ${last.path} (${last.status || 'n/a'})` : 'All endpoints failed.';
  throw new ApiError(msg, { status: last?.status, data: { attempts: errors } });
}

function pickTokenFromLoginPayload(payload) {
  const p = payload || {};
  const d = p.data && typeof p.data === 'object' ? p.data : p;
  const session = d.session && typeof d.session === 'object' ? d.session : null;
  return (
    d.token ||
    d.access_token ||
    d.session_token ||
    session?.token ||
    session?.session_token ||
    session?.session_id ||
    session?.id ||
    d.session_id ||
    d.id ||
    null
  );
}

// ===========================================================================
// MAIN API OBJECT
// ===========================================================================
export const api = {
  // =========================================================================
  // AUTH
  // =========================================================================
  async login({ username, password }) {
    const resp = await requestWithFallback('post', ['/users/login', '/auth/login'], {
      data: { username, password },
    });
    const payload = unwrap(resp);
    const token = pickTokenFromLoginPayload(payload);
    if (token) setAuthToken(token);

    return {
      ...payload,
      data: {
        ...(payload.data || {}),
        token: token || payload?.data?.token || null,
      },
    };
  },

  async logout() {
    try {
      await requestWithFallback('post', ['/users/logout', '/auth/logout'], { data: {} });
    } catch (_) {
      // no-op
    }
    setAuthToken(null);
    return { success: true };
  },

  async validateToken(token) {
    if (!token) return { success: true, data: { valid: false } };

    const isSessionToken = token === 'session';

    if (!isSessionToken) {
      try {
        const resp = await requestWithFallback('post', ['/users/validate', '/auth/validate'], {
          data: { token },
        });
        const payload = unwrap(resp);
        const valid = !!(payload.valid ?? payload?.data?.valid ?? payload?.data?.data?.valid);
        return { ...payload, data: { ...(payload.data || {}), valid } };
      } catch (e) {
        if (isAuthError(e)) return { success: true, data: { valid: false } };
      }
    }

    try {
      const meResp = await requestWithFallback('get', ['/users/me', '/auth/me', '/me']);
      const mePayload = unwrap(meResp);
      return {
        success: true,
        data: { valid: true, user: mePayload?.data?.user || mePayload?.user || mePayload?.data || null },
      };
    } catch (e) {
      if (isAuthError(e)) return { success: true, data: { valid: false } };
      if (isMissingEndpoint(e)) return { success: true, data: { valid: true } };
      return { success: true, data: { valid: true } };
    }
  },

  async me() {
    const resp = await requestWithFallback('get', ['/users/me', '/auth/me', '/me']);
    return unwrap(resp);
  },

  async getCurrentUser() {
    return this.me();
  },

  async updateProfile(data) {
    const resp = await requestWithFallback('put', ['/users/me'], { data });
    return unwrap(resp);
  },

  async changePassword(oldPassword, newPassword) {
    const resp = await requestWithFallback('put', ['/users/me/password', '/auth/password'], {
      data: { old_password: oldPassword, new_password: newPassword },
    });
    return unwrap(resp);
  },

  async getMyActiveSessions() {
    return safeUnwrap('get', ['/users/me/sessions'], {
      defaultValue: { data: [] },
    });
  },

  async logoutAllSessions() {
    const resp = await requestWithFallback('post', ['/users/logout-all'], { data: {} });
    return unwrap(resp);
  },

  // =========================================================================
  // PRINTERS
  // =========================================================================
  async getPrinters() {
    const resp = await requestWithFallback('get', ['/printers', '/printers/', '/printers/list']);
    return unwrap(resp);
  },

  async listPrinters() {
    return this.getPrinters();
  },

  async getPrinterTypes() {
    return safeUnwrap('get', ['/printers/types'], {
      defaultValue: {
        options: [
          { value: 'creality_k1', label: 'Creality K1' },
          { value: 'bambu_p1s', label: 'Bambu P1S' },
          { value: 'bambu_p2s', label: 'Bambu P2S' },
        ],
      },
    });
  },

  async getPrinterHealth() {
    return safeUnwrap('get', ['/printers/health', '/printers/status', '/printers'], {
      defaultValue: { printers: [] },
    });
  },

  async registerPrinter(payload) {
    const resp = await requestWithFallback('post', ['/printers/register', '/printers'], { data: payload });
    return unwrap(resp);
  },

  async addPrinter(printer) {
    return this.registerPrinter(printer);
  },

  async updatePrinter(printerId, patch) {
    const id = encodeURIComponent(printerId);
    const resp = await requestWithFallback('put', [`/printers/${id}`], { data: patch });
    return unwrap(resp);
  },

  async deletePrinter(printerId) {
    const id = encodeURIComponent(printerId);
    const resp = await requestWithFallback('delete', [`/printers/${id}`]);
    return unwrap(resp);
  },

  async connectPrinter(printerId) {
    const id = encodeURIComponent(printerId);
    const resp = await requestWithFallback('post', [`/printers/${id}/connect`], { data: {} });
    return unwrap(resp);
  },

  async disconnectPrinter(printerId) {
    const id = encodeURIComponent(printerId);
    const resp = await requestWithFallback('post', [`/printers/${id}/disconnect`], { data: {} });
    return unwrap(resp);
  },

  async printerControl(printerName, action, params = {}) {
    const id = encodeURIComponent(printerName);
    const resp = await requestWithFallback('post', [`/printers/${id}/control`, `/printers/${id}/${action}`], {
      data: { action, ...params },
    });
    return unwrap(resp);
  },

  // Alias for components that call controlPrinter instead of printerControl
  async controlPrinter(printerName, action, params = {}) {
    return this.printerControl(printerName, action, params);
  },

  async pausePrinter(printerId) {
    return this.printerControl(printerId, 'pause');
  },

  async resumePrinter(printerId) {
    return this.printerControl(printerId, 'resume');
  },

  async stopPrinter(printerId) {
    return this.printerControl(printerId, 'stop');
  },

  // =========================================================================
  // CONFIG / SETTINGS
  // =========================================================================
  async getCurrentConfig(params) {
    return safeUnwrap('get', ['/config/', '/config', '/settings'], {
      params,
      defaultValue: {
        currency: 'EUR',
        labor_rate_per_hour: 0,
        machine_rate_per_hour: 0,
        shipping: {},
        materials: {},
      },
    });
  },

  async updateConfig(patch) {
    const resp = await requestWithFallback('post', ['/config', '/config/update', '/settings'], { data: patch });
    return unwrap(resp);
  },

  async getCompanyInfo() {
    return safeUnwrap('get', ['/config/company', '/company', '/business/company'], {
      defaultValue: {
        name: '',
        address: '',
        email: '',
        phone: '',
        vat_number: '',
        default_language: 'en',
      },
    });
  },

  async updateCompanyInfo(data) {
    const resp = await requestWithFallback('post', ['/config/company', '/company', '/business/company'], { data });
    return unwrap(resp);
  },

  async getPricingConfig(params) {
    // Backend: GET /api/v1/business/quotes/pricing-config
    return safeUnwrap('get', ['/business/quotes/pricing-config', '/quotes/pricing-config', '/config/pricing'], {
      params,
      defaultValue: {
        currency: 'EUR',
        labor_hourly_rate: 8,
        machine_hourly_rate: 2.5,
        labor_hours_per_job: 0.5,
        default_profit_margin: 0.40,
        tax_rate: 0.20,
        rush_order_multiplier: 1.5,
        complexity_multipliers: {
          low: 1.0,
          medium: 1.2,
          high: 1.5,
          extreme: 2.0
        },
        quantity_discounts: {
          '5': 5,
          '10': 10,
          '25': 15,
          '50': 20
        },
        material_costs: {
          PLA: 18.0,
          PETG: 22.0,
          ABS: 20.0,
          TPU: 32.0,
          Nylon: 38.0,
          ASA: 28.0,
          PC: 42.0,
          PVA: 45.0
        }
      },
    });
  },

  async updatePricingConfig(data) {
    // Backend: PUT /api/v1/business/quotes/pricing-config
    const resp = await requestWithFallback('put', ['/business/quotes/pricing-config', '/quotes/pricing-config'], { data });
    return unwrap(resp);
  },

  async getLaborConfig() {
    return safeUnwrap('get', ['/config/labor', '/labor', '/cost/labor'], {
      defaultValue: {
        net_hourly_rate: 8,
        social_tax_rate: 33,
        unemployment_insurance_rate: 0.8,
        funded_pension_rate: 2,
      },
    });
  },

  async updateLaborConfig(data) {
    const resp = await requestWithFallback('post', ['/config/labor', '/labor', '/cost/labor'], { data });
    return unwrap(resp);
  },

  async getNotificationsConfig() {
    return safeUnwrap('get', ['/notifications/preferences', '/config/notifications', '/notifications/config'], {
      defaultValue: {
        email_enabled: false,
        slack_enabled: false,
        discord_enabled: false,
        slack_webhook: '',
        discord_webhook: '',
        notify_on_complete: true,
        notify_on_error: true,
        notify_on_low_stock: true,
      },
    });
  },

  async updateNotificationsConfig(data) {
    const resp = await requestWithFallback('post', ['/notifications/preferences', '/config/notifications', '/notifications/config'], { data });
    return unwrap(resp);
  },

  async getExpenseSummary(params) {
    return safeUnwrap('get', ['/cost/summary', '/expenses/summary', '/analytics/expenses'], {
      params,
      defaultValue: {
        total_material_cost: 0,
        total_labor_cost: 0,
        total_machine_cost: 0,
        total_energy_cost: 0,
        period: 'month',
      },
    });
  },

  // =========================================================================
  // BUSINESS / QUOTES / ORDERS
  // =========================================================================
  async calculateQuote(input) {
    const resp = await requestWithFallback('post', ['/business/quotes/calculate', '/quotes/calculate'], { data: input });
    return unwrap(resp);
  },

  async getOrderStatistics(days) {
    return safeUnwrap('get', ['/business/orders/statistics', '/orders/stats', '/orders/statistics'], {
      params: days ? { days } : undefined,
      defaultValue: {
        total_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        by_day: [],
      },
    });
  },

  async listOrders(params) {
    return safeUnwrap('get', ['/business/orders', '/orders'], { params, defaultValue: [] });
  },

  // Alias for backward compatibility
  async getOrders(params) {
    return this.listOrders(params);
  },

  async createOrder(data) {
    // Backend: POST /api/v1/business/orders
    const resp = await requestWithFallback('post', ['/business/orders', '/orders'], { data });
    return unwrap(resp);
  },

  async updateOrder(orderId, patch) {
    const id = encodeURIComponent(orderId);
    // Backend: PUT /api/v1/business/orders/<order_id>
    const resp = await requestWithFallback('put', [`/business/orders/${id}`, `/orders/${id}`], { data: patch });
    return unwrap(resp);
  },

  async updateOrderStatus(orderId, status, notes = '') {
    const id = encodeURIComponent(orderId);
    // Backend: PUT /api/v1/business/orders/<order_id>/status
    const resp = await requestWithFallback('put', [`/business/orders/${id}/status`, `/orders/${id}/status`], { data: { status, notes } });
    return unwrap(resp);
  },

  async queueOrderForProduction(orderId) {
    const id = encodeURIComponent(orderId);
    const resp = await requestWithFallback('post', [`/business/orders/${id}/queue`, `/production/queue/${id}`, `/scheduling/queue`], { data: { order_id: orderId } });
    return unwrap(resp);
  },

  async getBusinessDashboard(params) {
    return safeUnwrap('get', ['/business/analytics/dashboard', '/business/dashboard', '/dashboard'], {
      params,
      defaultValue: {
        kpis: { revenue: 0, orders: 0, clients: 0, profit: 0 },
        recent_orders: [],
        top_clients: [],
        updated_at: null,
      },
    });
  },

  // =========================================================================
  // INVOICES
  // =========================================================================
  async createInvoice(data) {
    const resp = await requestWithFallback('post', ['/business/invoices', '/invoices'], { data });
    return unwrap(resp);
  },

  async listInvoices(params) {
    return safeUnwrap('get', ['/business/invoices', '/invoices'], {
      params,
      defaultValue: [],
    });
  },

  async markInvoicePaid(invoiceNumber, method, reference) {
    const num = encodeURIComponent(invoiceNumber);
    const resp = await requestWithFallback('post', [`/business/invoices/${num}/pay`, `/invoices/${num}/paid`], {
      data: { payment_method: method, payment_reference: reference },
    });
    return unwrap(resp);
  },

  // =========================================================================
  // CLIENTS
  // =========================================================================
  async getClients(params) {
    return safeUnwrap('get', ['/business/clients', '/clients'], { params, defaultValue: [] });
  },

  async listClients(params) {
    return this.getClients(params);
  },

  async createClient(body) {
    const resp = await requestWithFallback('post', ['/business/clients', '/clients'], { data: body });
    return unwrap(resp);
  },

  async updateClient(clientId, patch) {
    const id = encodeURIComponent(clientId);
    // Backend: PUT /api/v1/business/clients/<client_id>
    const resp = await requestWithFallback('put', [`/business/clients/${id}`, `/clients/${id}`], { data: patch });
    return unwrap(resp);
  },

  async deleteClient(clientId) {
    const id = encodeURIComponent(clientId);
    const resp = await requestWithFallback('delete', [`/business/clients/${id}`, `/clients/${id}`]);
    return unwrap(resp);
  },

  // =========================================================================
  // MATERIALS / INVENTORY (Spools)
  // =========================================================================
  async getMaterialInventory(params) {
    // Backend route: GET /api/v1/materials/spools
    return safeUnwrap('get', ['/materials/spools'], {
      params,
      defaultValue: { spools: [], count: 0 },
    });
  },

  async getInventoryStats() {
    // Backend route: GET /api/v1/materials/inventory/stats
    return safeUnwrap('get', ['/materials/inventory/stats'], {
      defaultValue: {},
    });
  },

  async addMaterial(data) {
    // Backend route: POST /api/v1/materials/spools
    const resp = await requestWithFallback('post', ['/materials/spools'], { data });
    return unwrap(resp);
  },

  async updateMaterial(spoolId, patch) {
    // Backend route: PATCH /api/v1/materials/spools/<spool_id>
    const id = encodeURIComponent(spoolId);
    const resp = await requestWithFallback('patch', [`/materials/spools/${id}`], { data: patch });
    return unwrap(resp);
  },

  async deleteMaterial(spoolId) {
    // Note: Backend doesn't have DELETE for spools - use PATCH to deactivate
    const id = encodeURIComponent(spoolId);
    const resp = await requestWithFallback('patch', [`/materials/spools/${id}`], { 
      data: { is_active: false } 
    });
    return unwrap(resp);
  },

  async recordMaterialUsage(data) {
    // Backend route: POST /api/v1/materials/usage
    const resp = await requestWithFallback('post', ['/materials/usage'], { data });
    return unwrap(resp);
  },

  async getMaterialUsageHistory(params) {
    // Backend route: GET /api/v1/materials/usage/history
    return safeUnwrap('get', ['/materials/usage/history'], {
      params,
      defaultValue: { records: [], count: 0 },
    });
  },

  // =========================================================================
  // PRINT JOBS / QUEUE
  // =========================================================================
  async getJobQueue() {
    return safeUnwrap('get', ['/scheduling/queue', '/printing/print_jobs', '/production/queue', '/print_jobs'], { defaultValue: { jobs: [], count: 0 } });
  },

  // Alias for components that use getPrintJobs
  async getPrintJobs() {
    return this.getJobQueue();
  },

  async createPrintJob(data) {
    const resp = await requestWithFallback('post', ['/scheduling/queue', '/printing/print_jobs', '/print_jobs'], { data });
    return unwrap(resp);
  },

  async updatePrintJob(jobId, patch) {
    const id = encodeURIComponent(jobId);
    const resp = await requestWithFallback('put', [`/scheduling/jobs/${id}`, `/printing/print_jobs/${id}`, `/print_jobs/${id}`], { data: patch });
    return unwrap(resp);
  },

  async deletePrintJob(jobId) {
    const id = encodeURIComponent(jobId);
    const resp = await requestWithFallback('delete', [`/scheduling/jobs/${id}/cancel`, `/scheduling/jobs/${id}`, `/print_jobs/${id}`]);
    return unwrap(resp);
  },

  // =========================================================================
  // REPORTS
  // =========================================================================
  async getReportHistory() {
    return safeUnwrap('get', ['/reports/types', '/reports/history', '/reports'], { defaultValue: { types: [], formats: [] } });
  },

  async generateReport(body) {
    const resp = await requestWithFallback('post', ['/reports/generate', '/reports'], { data: body });
    return unwrap(resp);
  },

  // =========================================================================
  // MARKETING
  // =========================================================================
  async getDailySocialContent(params) {
    return safeUnwrap('get', ['/marketing/social/content/daily', '/marketing/daily', '/marketing/content'], {
      params,
      defaultValue: { posts: [], suggested_times: [], language: 'en' },
    });
  },

  async getLanguages() {
    return safeUnwrap('get', ['/marketing/translations/languages', '/marketing/languages', '/i18n/languages'], {
      defaultValue: ['en', 'et'],
    });
  },

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================
  async getNotificationPreferences() {
    return this.getNotificationsConfig();
  },

  async updateNotificationPreferences(prefs) {
    return this.updateNotificationsConfig(prefs);
  },

  async getNotifications(params) {
    return safeUnwrap('get', ['/notifications', '/notifications/list'], {
      params,
      defaultValue: [],
    });
  },

  // =========================================================================
  // FEEDBACK
  // =========================================================================
  async getFeedbackReviewQueue() {
    return safeUnwrap('get', ['/feedback/review_queue', '/feedback/review', '/feedback'], {
      defaultValue: [],
    });
  },

  // Alias for components that use listFeedbackEntries
  async listFeedbackEntries() {
    return this.getFeedbackReviewQueue();
  },

  async getFeedbackEntries(params = {}) {
    return safeUnwrap('get', ['/ai/feedback/entries', '/feedback/entries', '/feedback'], {
      params,
      defaultValue: { entries: [] },
    });
  },

  async getFeedbackStatistics() {
    return safeUnwrap('get', ['/ai/feedback/statistics', '/feedback/statistics', '/feedback/stats'], {
      defaultValue: { total: 0, pending: 0, accepted: 0, rejected: 0 },
    });
  },

  async acceptFeedbackEntry(entryId) {
    const id = encodeURIComponent(entryId);
    const resp = await requestWithFallback('post', [`/ai/feedback/entries/${id}/accept`, `/feedback/${id}/accept`], { data: {} });
    return unwrap(resp);
  },

  async rejectFeedbackEntry(entryId, data = {}) {
    const id = encodeURIComponent(entryId);
    const resp = await requestWithFallback('post', [`/ai/feedback/entries/${id}/reject`, `/feedback/${id}/reject`], { data });
    return unwrap(resp);
  },

  async exportFeedbackTraining(params = {}) {
    const resp = await requestWithFallback('post', ['/ai/feedback/export', '/feedback/export'], { data: params });
    return unwrap(resp);
  },

  // =========================================================================
  // DATASETS
  // =========================================================================
  async listDatasets(readyOnly = true) {
    return safeUnwrap('get', ['/datasets'], {
      params: { ready_only: readyOnly },
      defaultValue: [],
    });
  },

  async getDatasetVersions(datasetName) {
    const name = encodeURIComponent(datasetName);
    return safeUnwrap('get', [`/datasets/${name}/versions`], { defaultValue: [] });
  },

  // Alias for components that use listDatasetVersions
  async listDatasetVersions(datasetName) {
    return this.getDatasetVersions(datasetName);
  },

  async checkDataset(datasetName) {
    const name = encodeURIComponent(datasetName);
    const resp = await requestWithFallback('post', [`/datasets/${name}/check`, `/datasets/check`], { data: { dataset: datasetName } });
    return unwrap(resp);
  },

  async inspectDataset(params) {
    const { dataset, ...rest } = params;
    const name = encodeURIComponent(dataset);
    const resp = await requestWithFallback('post', [`/datasets/${name}/inspect`, `/datasets/inspect`], { data: { dataset, ...rest } });
    return unwrap(resp);
  },

  async buildDatasetVersion(params) {
    const { dataset, ...rest } = params;
    const name = encodeURIComponent(dataset);
    const resp = await requestWithFallback('post', [`/datasets/${name}/build`, `/datasets/build`], { data: { dataset, ...rest } });
    return unwrap(resp);
  },

  async activateDatasetVersion(datasetName, version) {
    const name = encodeURIComponent(datasetName);
    const ver = encodeURIComponent(version);
    const resp = await requestWithFallback('post', [`/datasets/${name}/versions/${ver}/activate`, `/datasets/${name}/activate`], {
      data: { version },
    });
    return unwrap(resp);
  },

  async deleteDatasetVersion(datasetName, version) {
    const name = encodeURIComponent(datasetName);
    const ver = encodeURIComponent(version);
    const resp = await requestWithFallback('delete', [`/datasets/${name}/versions/${ver}`]);
    return unwrap(resp);
  },

  async cleanupDatasetVersions(datasetName, keepN = 5, dryRun = true) {
    const name = encodeURIComponent(datasetName);
    const resp = await requestWithFallback('post', [`/datasets/${name}/cleanup`], {
      data: { keep: keepN, dry_run: dryRun },
    });
    return unwrap(resp);
  },

  async getDatasetExclusions(datasetName) {
    const name = encodeURIComponent(datasetName);
    return safeUnwrap('get', [`/datasets/${name}/exclusions`], { defaultValue: { relpaths: [] } });
  },

  async setDatasetExclusions(params) {
    const { dataset, mode, relpaths } = params;
    const name = encodeURIComponent(dataset);
    const resp = await requestWithFallback('post', [`/datasets/${name}/exclusions`], {
      data: { mode, relpaths },
    });
    return unwrap(resp);
  },

  async getDatasetQuality(params) {
    const { dataset, version, rescan, gate } = params;
    const name = encodeURIComponent(dataset);
    return safeUnwrap('get', [`/datasets/${name}/quality`], {
      params: { version, rescan, ...gate },
      defaultValue: null,
    });
  },

  async getDatasetQualityFailures(params) {
    const { dataset, version, limit, gate } = params;
    const name = encodeURIComponent(dataset);
    return safeUnwrap('get', [`/datasets/${name}/quality/failures`], {
      params: { version, limit, ...gate },
      defaultValue: { failures: [] },
    });
  },

  // =========================================================================
  // USERS (Admin)
  // =========================================================================
  async listUsers(params) {
    try {
      const resp = await requestWithFallback('get', ['/users', '/users/'], { params });
      const data = unwrap(resp);
      return Array.isArray(data) ? data : (data?.data ?? data?.users ?? []);
    } catch (e) {
      // For auth errors, let them propagate
      if (e?.status === 401 || e?.status === 403) throw e;
      // For other errors (like 404), return empty array
      return [];
    }
  },

  async createUser(data) {
    const resp = await requestWithFallback('post', ['/users', '/users/'], { data });
    return unwrap(resp);
  },

  async updateUser(userId, patch) {
    const id = encodeURIComponent(userId);
    const resp = await requestWithFallback('put', [`/users/${id}`], { data: patch });
    return unwrap(resp);
  },

  async deleteUser(userId) {
    const id = encodeURIComponent(userId);
    const resp = await requestWithFallback('delete', [`/users/${id}`]);
    return unwrap(resp);
  },

  async resetUserPassword(userId, newPassword) {
    const id = encodeURIComponent(userId);
    const resp = await requestWithFallback('put', [`/users/${id}/password`], { data: { new_password: newPassword } });
    return unwrap(resp);
  },

  async activateUser(userId) {
    const id = encodeURIComponent(userId);
    const resp = await requestWithFallback('post', [`/users/${id}/activate`], { data: {} });
    return unwrap(resp);
  },

  async deactivateUser(userId) {
    const id = encodeURIComponent(userId);
    const resp = await requestWithFallback('post', [`/users/${id}/deactivate`], { data: {} });
    return unwrap(resp);
  },

  // =========================================================================
  // MAINTENANCE
  // =========================================================================
  async getMaintenanceSchedule() {
    return safeUnwrap('get', ['/maintenance', '/maintenance/schedule'], { defaultValue: [] });
  },

  async getUpcomingMaintenance() {
    return safeUnwrap('get', ['/maintenance/upcoming', '/maintenance'], { defaultValue: [] });
  },

  async createMaintenanceTask(data) {
    const resp = await requestWithFallback('post', ['/maintenance', '/maintenance/tasks'], { data });
    return unwrap(resp);
  },

  // =========================================================================
  // ANALYTICS
  // =========================================================================
  async getAnalytics(params) {
    return safeUnwrap('get', ['/analytics', '/analytics/overview'], {
      params,
      defaultValue: { prints: [], utilization: [], costs: [] },
    });
  },

  async getEnergySavings(params) {
    return safeUnwrap('get', ['/analytics/energy', '/cost/energy'], {
      params,
      defaultValue: { total_kwh: 0, total_cost: 0, savings: 0 },
    });
  },

  async getEnergyHistory(days = 30) {
    return safeUnwrap('get', ['/analytics/energy/history', '/energy/history', '/cost/energy/history'], {
      params: { days },
      defaultValue: { history: [] },
    });
  },

  async getEnergySummary() {
    return safeUnwrap('get', ['/analytics/stats/summary', '/analytics/energy/summary', '/energy/summary'], {
      defaultValue: {
        total_energy_saved_kwh: 0,
        total_cost_saved: 0,
        total_cooldown_events: 0,
      },
    });
  },

  // =========================================================================
  // COST ANALYTICS
  // =========================================================================
  async getCostSummary(days = 30) {
    return safeUnwrap('get', ['/cost/summary', '/analytics/costs', '/cost/analytics'], {
      params: { days },
      defaultValue: {
        total_energy_cost: 0,
        total_material_cost: 0,
        total_maintenance_cost: 0,
        total_overhead_cost: 0,
        daily_breakdown: [],
      },
    });
  },

  async getExpenses() {
    return safeUnwrap('get', ['/cost/expenses', '/expenses'], {
      defaultValue: { expenses: [] },
    });
  },

  // =========================================================================
  // FILES
  // =========================================================================
  async listFiles(params) {
    return safeUnwrap('get', ['/slicing/files', '/files', '/stl/files'], {
      params,
      defaultValue: { files: [] },
    });
  },

  async uploadFile(formData) {
    const resp = await requestWithFallback('post', ['/slicing/upload', '/files/upload'], {
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(resp);
  },

  async deleteFile(fileId) {
    const id = encodeURIComponent(fileId);
    const resp = await requestWithFallback('delete', [`/files/${id}`]);
    return unwrap(resp);
  },

  // =========================================================================
  // SLICING
  // =========================================================================
  async sliceFile(filePath, params) {
    const resp = await requestWithFallback('post', ['/slicing/slice'], {
      data: { file_path: filePath, settings: params },
    });
    return unwrap(resp);
  },

  async analyzeSTL(fileId) {
    const id = encodeURIComponent(fileId);
    return safeUnwrap('get', [`/slicing/analyze/${id}`, `/files/${id}/analyze`], {
      defaultValue: null,
    });
  },

  async listSlicingFiles(params) {
    return safeUnwrap('get', ['/slicing/files', '/files'], {
      params,
      defaultValue: { files: [] },
    });
  },

  async uploadSlicingFile(formData) {
    const resp = await requestWithFallback('post', ['/slicing/upload', '/files/upload'], {
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(resp);
  },

  async analyzeSlicingFile(filePath, layerHeight) {
    const resp = await requestWithFallback('post', ['/slicing/analyze'], {
      data: { file_path: filePath, layer_height: layerHeight },
    });
    return unwrap(resp);
  },

  slicingDownloadUrl(filePath) {
    if (!filePath) return null;
    const encodedPath = encodeURIComponent(filePath);
    return `${API_BASE}/slicing/download?path=${encodedPath}`;
  },

  async deleteSlicingFile(filePath) {
    const resp = await requestWithFallback('post', ['/slicing/files/delete'], {
      data: { path: filePath },
    });
    return unwrap(resp);
  },

  async createPrintJobFromSlice(params) {
    const resp = await requestWithFallback('post', ['/slicing/print', '/print_jobs'], {
      data: params,
    });
    return unwrap(resp);
  },

  // =========================================================================
  // SYSTEM / STATUS
  // =========================================================================
  async getSystemStatus() {
    try {
      const resp = await requestWithFallback('get', ['/system/status', '/status', '/health']);
      const data = unwrap(resp);
      // Normalize the response - the backend might return various formats
      return data || {
        status: 'unknown',
        uptime: 0,
        cpu_percent: 0,
        memory: { percent_used: 0 },
        platform: 'N/A',
      };
    } catch (e) {
      if (isAuthError(e)) throw e;
      // Return default values on error
      return {
        status: 'offline',
        uptime: 0,
        cpu_percent: 0,
        memory: { percent_used: 0 },
        platform: 'N/A',
      };
    }
  },

  // =========================================================================
  // PRINT HISTORY
  // =========================================================================
  async getPrintHistory(days) {
    return safeUnwrap('get', ['/production/history', '/printing/history', '/print_history', '/prints/history', '/history'], {
      params: days ? { days } : undefined,
      defaultValue: [],
    });
  },

  // =========================================================================
  // ML / ANALYTICS
  // =========================================================================
  async getMLDashboard(params) {
    return safeUnwrap('get', ['/ml/dashboard', '/ml/overview', '/training/dashboard'], {
      params,
      defaultValue: {
        models: [],
        recent_predictions: [],
        accuracy_metrics: {},
      },
    });
  },

  async getAllAnomalies(params) {
    return safeUnwrap('get', ['/ml/anomalies', '/anomalies', '/training/anomalies'], {
      params,
      defaultValue: [],
    });
  },

  // =========================================================================
  // AI / GENERATION
  // =========================================================================
  async generateText(params) {
    const resp = await requestWithFallback('post', ['/training/generate', '/ai/generate', '/generate'], { data: params });
    return unwrap(resp);
  },

  async predictJobQuality(jobId, params = {}) {
    const id = encodeURIComponent(jobId);
    const resp = await requestWithFallback('post', [`/prediction/predict/${id}`, `/ml/predict/${id}`], { data: params });
    return unwrap(resp);
  },

  async getPredictionStats(days = 7) {
    return safeUnwrap('get', ['/prediction/stats', '/ml/stats'], {
      params: { days },
      defaultValue: null,
    });
  },

  async getFeatureImportance() {
    return safeUnwrap('get', ['/prediction/feature-importance', '/ml/feature-importance'], {
      defaultValue: null,
    });
  },

  async getPredictionModelInfo() {
    return safeUnwrap('get', ['/prediction/model/info', '/ml/model/info'], {
      defaultValue: null,
    });
  },

  async getAIGenerationBackends() {
    return safeUnwrap('get', ['/ai/generation/backends', '/generation/backends'], {
      defaultValue: { backends: [{ name: 'mock', available: true }], active_backend: 'mock' },
    });
  },

  async generate3DFromImage(formData, params = {}) {
    const resp = await requestWithFallback('post', ['/ai/generation/image-to-3d', '/generation/image-to-3d'], {
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(resp);
  },

  // =========================================================================
  // AUTO-START SERVICE
  // =========================================================================
  async getAutoStartStatus() {
    return safeUnwrap('get', ['/auto-start/status', '/scheduling/auto-start', '/printers/auto-start'], {
      defaultValue: {
        enabled: false,
        running: false,
        check_interval: 60,
        cooldown_wait_minutes: 5,
        min_bed_temp: 35,
        disabled_printers: [],
      },
    });
  },

  async enableAutoStart() {
    const resp = await requestWithFallback('post', ['/auto-start/enable', '/scheduling/auto-start/enable'], { data: {} });
    return unwrap(resp);
  },

  async disableAutoStart() {
    const resp = await requestWithFallback('post', ['/auto-start/disable', '/scheduling/auto-start/disable'], { data: {} });
    return unwrap(resp);
  },

  // =========================================================================
  // MATERIAL PROFILES
  // =========================================================================
  async getMaterialProfiles(category) {
    return safeUnwrap('get', ['/materials/profiles', '/material_profiles', '/profiles'], {
      params: category ? { category } : undefined,
      defaultValue: { profiles: [], categories: [] },
    });
  },

  async getMaterialSettings(materialCode, printerType) {
    const code = encodeURIComponent(materialCode);
    const printer = encodeURIComponent(printerType);
    return safeUnwrap('get', [`/materials/settings/${code}/${printer}`, `/materials/profiles/${code}/settings`], {
      params: { printer_type: printerType },
      defaultValue: null,
    });
  },

  async validateMaterialSettings(materialCode, settings) {
    const code = encodeURIComponent(materialCode);
    const resp = await requestWithFallback('post', [`/materials/validate/${code}`, `/materials/profiles/${code}/validate`], {
      data: settings,
    });
    return unwrap(resp);
  },

  async createMaterialProfile(data) {
    const resp = await requestWithFallback('post', ['/materials/profiles', '/material_profiles'], { data });
    return unwrap(resp);
  },

  async updateMaterialProfile(profileId, patch) {
    const id = encodeURIComponent(profileId);
    const resp = await requestWithFallback('put', [`/materials/profiles/${id}`, `/material_profiles/${id}`], { data: patch });
    return unwrap(resp);
  },

  async deleteMaterialProfile(profileId) {
    const id = encodeURIComponent(profileId);
    const resp = await requestWithFallback('delete', [`/materials/profiles/${id}`, `/material_profiles/${id}`]);
    return unwrap(resp);
  },

  // =========================================================================
  // FILAMENT DRYING REMINDERS
  // =========================================================================
  async getDryingAlerts() {
    return safeUnwrap('get', ['/materials/drying/alerts'], {
      defaultValue: { alerts: [], count: 0 },
    });
  },

  async getExposureRecords(params) {
    return safeUnwrap('get', ['/materials/drying/exposure'], {
      params,
      defaultValue: { records: [], count: 0 },
    });
  },

  async getExposureSummary() {
    return safeUnwrap('get', ['/materials/drying/summary'], {
      defaultValue: { total_tracked: 0, spools_needing_drying: 0 },
    });
  },

  async getExposureRecord(spoolId) {
    const id = encodeURIComponent(spoolId);
    return safeUnwrap('get', [`/materials/drying/exposure/${id}`], {
      defaultValue: null,
    });
  },

  async startExposureTracking(data) {
    const resp = await requestWithFallback('post', ['/materials/drying/exposure/start'], { data });
    return unwrap(resp);
  },

  async stopExposureTracking(spoolId, reason = 'sealed') {
    const resp = await requestWithFallback('post', ['/materials/drying/exposure/stop'], {
      data: { spool_id: spoolId, reason },
    });
    return unwrap(resp);
  },

  async markSpoolDried(spoolId) {
    const id = encodeURIComponent(spoolId);
    const resp = await requestWithFallback('post', [`/materials/drying/dry/${id}`], { data: {} });
    return unwrap(resp);
  },

  async startSpoolDrying(spoolId) {
    const id = encodeURIComponent(spoolId);
    const resp = await requestWithFallback('post', [`/materials/drying/drying/${id}`], { data: {} });
    return unwrap(resp);
  },

  async getSpoolsNeedingDrying() {
    return safeUnwrap('get', ['/materials/drying/needs-drying'], {
      defaultValue: { spools: [], count: 0 },
    });
  },

  async getDryingThresholds() {
    return safeUnwrap('get', ['/materials/drying/thresholds'], {
      defaultValue: { thresholds: {} },
    });
  },

  async getDryingThreshold(materialCode) {
    const code = encodeURIComponent(materialCode);
    return safeUnwrap('get', [`/materials/drying/thresholds/${code}`], {
      defaultValue: null,
    });
  },

  async setDryingThreshold(materialCode, data) {
    const code = encodeURIComponent(materialCode);
    const resp = await requestWithFallback('put', [`/materials/drying/thresholds/${code}`], { data });
    return unwrap(resp);
  },

  // =========================================================================
  // SHIPPING
  // =========================================================================
  async calculateShipping(shippingParams) {
    try {
      const resp = await requestWithFallback('post', ['/shipping/calculate', '/quotes/shipping'], {
        data: shippingParams,
      });
      return unwrap(resp);
    } catch (e) {
      if (isAuthError(e)) throw e;
      return null;
    }
  },

  // =========================================================================
  // PRODUCTION QUEUE
  // =========================================================================
  async getProductionQueue(params) {
    return safeUnwrap('get', ['/production/queue', '/scheduling/queue', '/print_jobs'], {
      params,
      defaultValue: [],
    });
  },

  // =========================================================================
  // CARBON FOOTPRINT
  // =========================================================================
  async getCarbonSummary(days = 30) {
    return safeUnwrap('get', ['/carbon/summary'], {
      params: { days },
      defaultValue: {
        summary: {
          total_co2_kg: 0,
          scope1_co2_kg: 0,
          scope2_co2_kg: 0,
          scope3_co2_kg: 0,
          breakdown: {},
          equivalents: {},
          period_days: days,
        },
      },
    });
  },

  async getCarbonDailyStats(days = 30) {
    return safeUnwrap('get', ['/carbon/stats/daily'], {
      params: { days },
      defaultValue: { daily_stats: [] },
    });
  },

  async getCarbonWeeklyStats(weeks = 12) {
    return safeUnwrap('get', ['/carbon/stats/weekly'], {
      params: { weeks },
      defaultValue: { weekly_stats: [] },
    });
  },

  async getCarbonMonthlyStats(months = 12) {
    return safeUnwrap('get', ['/carbon/stats/monthly'], {
      params: { months },
      defaultValue: { monthly_stats: [] },
    });
  },

  async getCarbonEntries(params = {}) {
    return safeUnwrap('get', ['/carbon/entries'], {
      params,
      defaultValue: { entries: [] },
    });
  },

  async calculateJobCarbon(data) {
    const resp = await requestWithFallback('post', ['/carbon/calculate'], { data });
    return unwrap(resp);
  },

  async recordCarbonEntry(data) {
    const resp = await requestWithFallback('post', ['/carbon/record'], { data });
    return unwrap(resp);
  },

  async getCarbonPrinterComparison(days = 30) {
    return safeUnwrap('get', ['/carbon/printers/comparison'], {
      params: { days },
      defaultValue: { printers: {} },
    });
  },

  async calculateCarbonEquivalents(co2_kg) {
    const resp = await requestWithFallback('post', ['/carbon/equivalents'], { data: { co2_kg } });
    return unwrap(resp);
  },

  async getEmissionFactors() {
    return safeUnwrap('get', ['/carbon/factors'], {
      defaultValue: { factors: {}, available_regions: [], available_materials: [] },
    });
  },

  async getCarbonTargets(activeOnly = true) {
    return safeUnwrap('get', ['/carbon/targets'], {
      params: { active_only: activeOnly },
      defaultValue: { targets: [] },
    });
  },

  async createCarbonTarget(data) {
    const resp = await requestWithFallback('post', ['/carbon/targets'], { data });
    return unwrap(resp);
  },

  async calculateOffsetCost(co2_kg, standard = 'verified_carbon_standard') {
    const resp = await requestWithFallback('post', ['/carbon/offset/cost'], { data: { co2_kg, standard } });
    return unwrap(resp);
  },

  async getCarbonReport(days = 30) {
    return safeUnwrap('get', ['/carbon/report'], {
      params: { days },
      defaultValue: { report: {} },
    });
  },

  // ============== Chat ==============
  async getChatHistory(channel = 'general', limit = 50) {
    return safeUnwrap('get', ['/chat/history'], {
      params: { channel, limit },
      defaultValue: { messages: [], channel },
    });
  },

  async sendChatMessage(message, channel = 'general') {
    const resp = await requestWithFallback('post', ['/chat/send'], {
      data: { message, channel },
    });
    return unwrap(resp);
  },

  async deleteChatMessage(messageId) {
    const resp = await requestWithFallback('delete', [`/chat/delete/${messageId}`], {});
    return unwrap(resp);
  },

  async getOnlineUsers() {
    return safeUnwrap('get', ['/chat/online'], {
      defaultValue: { users: [] },
    });
  },

  // ============== Feedback / Issues ==============
  async getFeedbackIssues(status = null) {
    return safeUnwrap('get', ['/issues'], {
      params: status ? { status } : {},
      defaultValue: [],
    });
  },

  async submitFeedback(data) {
    const resp = await requestWithFallback('post', ['/issues'], { data });
    return unwrap(resp);
  },

  async updateFeedbackStatus(issueId, status) {
    const resp = await requestWithFallback('put', [`/issues/${issueId}/status`], {
      data: { status },
    });
    return unwrap(resp);
  },

  async deleteFeedbackIssue(issueId) {
    const resp = await requestWithFallback('delete', [`/issues/${issueId}`], {});
    return unwrap(resp);
  },

  // ============== User Invitations ==============
  async createInvitation(data) {
    const resp = await requestWithFallback('post', ['/invitations'], { data });
    return unwrap(resp);
  },

  async listInvitations(status = null) {
    return safeUnwrap('get', ['/invitations'], {
      params: status ? { status } : {},
      defaultValue: { data: [], count: 0 },
    });
  },

  async getInvitationStats() {
    return safeUnwrap('get', ['/invitations/stats'], {
      defaultValue: { data: { total: 0, pending: 0, accepted: 0, expired: 0, cancelled: 0 } },
    });
  },

  async cancelInvitation(invitationId) {
    const resp = await requestWithFallback('post', [`/invitations/${invitationId}/cancel`], { data: {} });
    return unwrap(resp);
  },

  async resendInvitation(invitationId, expiresInDays = 7) {
    const resp = await requestWithFallback('post', [`/invitations/${invitationId}/resend`], {
      data: { expires_in_days: expiresInDays },
    });
    return unwrap(resp);
  },

  async verifyInvitation(token) {
    return safeUnwrap('get', [`/invitations/verify/${token}`], {
      defaultValue: null,
    });
  },

  async acceptInvitation(data) {
    const resp = await requestWithFallback('post', ['/invitations/accept'], { data });
    return unwrap(resp);
  },

  // ============== Inventory Management ==============
  // Locations
  async getInventoryLocations() {
    return safeUnwrap('get', ['/inventory/locations'], {
      defaultValue: { data: [], count: 0 },
    });
  },

  // Materials (for POS)
  async getMaterials() {
    // Returns filament/material data for pricing
    return safeUnwrap('get', ['/materials', '/inventory/products'], {
      params: { type: 'raw' },
      defaultValue: { data: [] },
    });
  },

  async createInventoryLocation(data) {
    const resp = await requestWithFallback('post', ['/inventory/locations'], { data });
    return unwrap(resp);
  },

  async updateInventoryLocation(locationId, data) {
    const resp = await requestWithFallback('put', [`/inventory/locations/${locationId}`], { data });
    return unwrap(resp);
  },

  async deleteInventoryLocation(locationId) {
    const resp = await requestWithFallback('delete', [`/inventory/locations/${locationId}`]);
    return unwrap(resp);
  },

  // Suppliers
  async getSuppliers(activeOnly = true) {
    return safeUnwrap('get', ['/inventory/suppliers'], {
      params: { active_only: activeOnly },
      defaultValue: { data: [], count: 0 },
    });
  },

  async getSupplier(supplierId) {
    return safeUnwrap('get', [`/inventory/suppliers/${supplierId}`], {
      defaultValue: null,
    });
  },

  async createSupplier(data) {
    const resp = await requestWithFallback('post', ['/inventory/suppliers'], { data });
    return unwrap(resp);
  },

  async updateSupplier(supplierId, data) {
    const resp = await requestWithFallback('put', [`/inventory/suppliers/${supplierId}`], { data });
    return unwrap(resp);
  },

  async deleteSupplier(supplierId) {
    const resp = await requestWithFallback('delete', [`/inventory/suppliers/${supplierId}`]);
    return unwrap(resp);
  },

  // Categories
  async getInventoryCategories() {
    return safeUnwrap('get', ['/inventory/categories'], {
      defaultValue: { data: [], count: 0 },
    });
  },

  async createInventoryCategory(data) {
    const resp = await requestWithFallback('post', ['/inventory/categories'], { data });
    return unwrap(resp);
  },

  // Products
  async getInventoryProducts(params = {}) {
    return safeUnwrap('get', ['/inventory/products'], {
      params,
      defaultValue: { data: [], count: 0 },
    });
  },

  async getInventoryProduct(productId) {
    return safeUnwrap('get', [`/inventory/products/${productId}`], {
      defaultValue: null,
    });
  },

  async getInventoryProductBySku(sku) {
    return safeUnwrap('get', [`/inventory/products/sku/${sku}`], {
      defaultValue: null,
    });
  },

  async createInventoryProduct(data) {
    const resp = await requestWithFallback('post', ['/inventory/products'], { data });
    return unwrap(resp);
  },

  async updateInventoryProduct(productId, data) {
    const resp = await requestWithFallback('put', [`/inventory/products/${productId}`], { data });
    return unwrap(resp);
  },

  async deleteInventoryProduct(productId) {
    const resp = await requestWithFallback('delete', [`/inventory/products/${productId}`]);
    return unwrap(resp);
  },

  // Stock
  async getInventoryStock(params = {}) {
    return safeUnwrap('get', ['/inventory/stock'], {
      params,
      defaultValue: { data: [], count: 0 },
    });
  },

  async getInventoryStockSummary() {
    return safeUnwrap('get', ['/inventory/stock/summary'], {
      defaultValue: { data: {} },
    });
  },

  // Movements
  async getInventoryMovements(params = {}) {
    return safeUnwrap('get', ['/inventory/movements'], {
      params,
      defaultValue: { data: [], count: 0 },
    });
  },

  async receiveStock(data) {
    const resp = await requestWithFallback('post', ['/inventory/movements/receive'], { data });
    return unwrap(resp);
  },

  async produceStock(data) {
    const resp = await requestWithFallback('post', ['/inventory/movements/produce'], { data });
    return unwrap(resp);
  },

  async sellStock(data) {
    const resp = await requestWithFallback('post', ['/inventory/movements/sell'], { data });
    return unwrap(resp);
  },

  async transferStock(data) {
    const resp = await requestWithFallback('post', ['/inventory/movements/transfer'], { data });
    return unwrap(resp);
  },

  async adjustStock(data) {
    const resp = await requestWithFallback('post', ['/inventory/movements/adjust'], { data });
    return unwrap(resp);
  },

  async recordWaste(data) {
    const resp = await requestWithFallback('post', ['/inventory/movements/waste'], { data });
    return unwrap(resp);
  },

  // Alerts
  async getInventoryAlerts(status = 'active') {
    return safeUnwrap('get', ['/inventory/alerts'], {
      params: { status },
      defaultValue: { data: [], count: 0 },
    });
  },

  async dismissInventoryAlert(alertId) {
    const resp = await requestWithFallback('post', [`/inventory/alerts/${alertId}/dismiss`], { data: {} });
    return unwrap(resp);
  },

  async getReorderSuggestions() {
    return safeUnwrap('get', ['/inventory/reorder-suggestions'], {
      defaultValue: { data: [], count: 0 },
    });
  },

  // Reports
  async getInventoryValuation() {
    return safeUnwrap('get', ['/inventory/reports/valuation'], {
      defaultValue: { data: {} },
    });
  },

  async getInventoryMovementReport(days = 30) {
    return safeUnwrap('get', ['/inventory/reports/movements'], {
      params: { days },
      defaultValue: { data: {} },
    });
  },

  // ============== Instant Quote ==============
  async getInstantQuote(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (options.material) formData.append('material', options.material);
    if (options.quality) formData.append('quality', options.quality);
    if (options.quantity) formData.append('quantity', options.quantity.toString());
    
    const resp = await http.post('/quote/quote', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(resp);
  },

  async analyzeModelQuality(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const resp = await http.post('/quote/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(resp);
  },

  async getAvailableMaterials() {
    return safeUnwrap('get', ['/quote/materials'], {
      defaultValue: { materials: [], quality_presets: [] },
    });
  },

  // ============== Smart Scheduler ==============
  async getSchedulerQueue(params = {}) {
    return safeUnwrap('get', ['/scheduler/queue'], {
      params,
      defaultValue: { jobs: [], stats: {}, total: 0 },
    });
  },

  async addSchedulerJob(data) {
    const resp = await requestWithFallback('post', ['/scheduler/jobs'], { data });
    return unwrap(resp);
  },

  async getSchedulerJob(jobId) {
    return safeUnwrap('get', [`/scheduler/jobs/${jobId}`], {
      defaultValue: null,
    });
  },

  async updateJobPriority(jobId, priority) {
    const resp = await requestWithFallback('put', [`/scheduler/jobs/${jobId}/priority`], {
      data: { priority },
    });
    return unwrap(resp);
  },

  async assignJob(jobId, printerName) {
    const resp = await requestWithFallback('post', [`/scheduler/jobs/${jobId}/assign`], {
      data: { printer_name: printerName },
    });
    return unwrap(resp);
  },

  async startSchedulerJob(jobId) {
    const resp = await requestWithFallback('post', [`/scheduler/jobs/${jobId}/start`], { data: {} });
    return unwrap(resp);
  },

  async completeSchedulerJob(jobId, success = true, options = {}) {
    const resp = await requestWithFallback('post', [`/scheduler/jobs/${jobId}/complete`], {
      data: { success, ...options },
    });
    return unwrap(resp);
  },

  async cancelSchedulerJob(jobId) {
    const resp = await requestWithFallback('post', [`/scheduler/jobs/${jobId}/cancel`], { data: {} });
    return unwrap(resp);
  },

  async getSchedulerOptimizations() {
    const resp = await requestWithFallback('post', ['/scheduler/optimize'], { data: {} });
    return unwrap(resp);
  },

  async autoAssignJobs() {
    const resp = await requestWithFallback('post', ['/scheduler/auto-assign'], { data: {} });
    return unwrap(resp);
  },

  async getSchedulerStats() {
    return safeUnwrap('get', ['/scheduler/stats'], {
      defaultValue: {},
    });
  },

  async getPrinterLoads() {
    return safeUnwrap('get', ['/scheduler/printers/loads'], {
      defaultValue: { printer_loads: [] },
    });
  },

  // ============== Admin / Data Management ==============
  async getDataSummary() {
    return safeUnwrap('get', ['/admin/data/summary'], {
      defaultValue: { categories: {}, total_size_bytes: 0 },
    });
  },

  async createBackup(options = {}) {
    const resp = await requestWithFallback('post', ['/admin/backup'], {
      data: options,
    });
    return unwrap(resp);
  },

  async listBackups() {
    return safeUnwrap('get', ['/admin/backup/list'], {
      defaultValue: [],
    });
  },

  async downloadBackup(filename) {
    // Return the URL for download
    return `${API_BASE}/admin/backup/${encodeURIComponent(filename)}/download`;
  },

  async restoreBackup(filename, options = {}) {
    const resp = await requestWithFallback('post', [`/admin/backup/${encodeURIComponent(filename)}/restore`], {
      data: options,
    });
    return unwrap(resp);
  },

  async deleteBackup(filename) {
    const resp = await requestWithFallback('delete', [`/admin/backup/${encodeURIComponent(filename)}`], {});
    return unwrap(resp);
  },

  async wipeData(categories, confirm = false) {
    const resp = await requestWithFallback('post', ['/admin/data/wipe'], {
      data: { categories, confirm },
    });
    return unwrap(resp);
  },

  async getSystemInfo() {
    return safeUnwrap('get', ['/admin/system/info'], {
      defaultValue: {},
    });
  },

  // ============== OrcaSlicer Integration ==============
  async getSlicerStatus() {
    return safeUnwrap('get', ['/slicer/status'], {
      defaultValue: { available: false, slicer_type: 'none', slicer_path: null },
    });
  },

  async setSlicerPath(path) {
    const resp = await requestWithFallback('post', ['/slicer/set-path'], {
      data: { path },
    });
    return unwrap(resp);
  },

  async detectSlicer() {
    const resp = await requestWithFallback('post', ['/slicer/detect'], { data: {} });
    return unwrap(resp);
  },

  async sliceModel(file, settings = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add settings to form data
    if (settings.layer_height) formData.append('layer_height', settings.layer_height.toString());
    if (settings.infill_percent) formData.append('infill_percent', settings.infill_percent.toString());
    if (settings.wall_count) formData.append('wall_count', settings.wall_count.toString());
    if (settings.material) formData.append('material', settings.material);
    if (settings.supports !== undefined) formData.append('supports', settings.supports.toString());
    if (settings.support_type) formData.append('support_type', settings.support_type);
    if (settings.brim !== undefined) formData.append('brim', settings.brim.toString());
    if (settings.nozzle_temp) formData.append('nozzle_temp', settings.nozzle_temp.toString());
    if (settings.bed_temp) formData.append('bed_temp', settings.bed_temp.toString());
    if (settings.keep_gcode) formData.append('keep_gcode', settings.keep_gcode.toString());
    
    const resp = await http.post('/slicer/slice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 minute timeout for slicing
    });
    return unwrap(resp);
  },

  async sliceExistingFile(filePath, settings = {}, keepGcode = false) {
    const resp = await requestWithFallback('post', ['/slicer/slice-file'], {
      data: { file_path: filePath, settings, keep_gcode: keepGcode },
    });
    return unwrap(resp);
  },

  async getQuickEstimate(file, settings = {}) {
    const formData = new FormData();
    formData.append('file', file);
    if (settings.material) formData.append('material', settings.material);
    if (settings.layer_height) formData.append('layer_height', settings.layer_height.toString());
    if (settings.infill_percent) formData.append('infill_percent', settings.infill_percent.toString());
    
    const resp = await http.post('/slicer/quick-estimate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(resp);
  },

  async getSlicerProfiles() {
    return safeUnwrap('get', ['/slicer/profiles'], {
      defaultValue: { profiles: [] },
    });
  },

  async getSlicerProfile(profileId) {
    return safeUnwrap('get', [`/slicer/profiles/${profileId}`], {
      defaultValue: null,
    });
  },

  async createSlicerProfile(profileData) {
    const resp = await requestWithFallback('post', ['/slicer/profiles'], {
      data: profileData,
    });
    return unwrap(resp);
  },

  async getSlicerPresets() {
    return safeUnwrap('get', ['/slicer/presets'], {
      defaultValue: { presets: {} },
    });
  },

  // ============== Printer Integration (Calibrations & Slice-and-Print) ==============
  async getCalibrationTypes() {
    return safeUnwrap('get', ['/printer-integration/calibrations'], {
      defaultValue: { calibrations: [] },
    });
  },

  async generateCalibration(type, printer = null, params = {}) {
    const resp = await requestWithFallback('post', ['/printer-integration/calibrations/generate'], {
      data: { type, printer, params },
    });
    return unwrap(resp);
  },

  getCalibrationDownloadUrl(filename) {
    return `${API_BASE}/printer-integration/calibrations/download/${encodeURIComponent(filename)}`;
  },

  async sendCalibrationToPrinter(type, printer, params = {}, autoStart = false) {
    const resp = await requestWithFallback('post', ['/printer-integration/calibrations/send'], {
      data: { type, printer, params, auto_start: autoStart },
    });
    return unwrap(resp);
  },

  async sliceAndPrint(file, printer, settings = {}, autoStart = true) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('printer', printer);
    formData.append('auto_start', autoStart.toString());
    
    if (settings.layer_height) formData.append('layer_height', settings.layer_height.toString());
    if (settings.infill) formData.append('infill', settings.infill.toString());
    if (settings.material) formData.append('material', settings.material);
    if (settings.supports !== undefined) formData.append('supports', settings.supports.toString());
    
    const resp = await http.post('/printer-integration/slice-and-print', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000, // 10 minute timeout for slice+upload+start
    });
    return unwrap(resp);
  },

  async sliceAndPrintExisting(stlPath, printer, settings = {}, autoStart = true) {
    const resp = await requestWithFallback('post', ['/printer-integration/slice-and-print'], {
      data: { stl_path: stlPath, printer, ...settings, auto_start: autoStart },
    });
    return unwrap(resp);
  },

  async getPrinterProfiles() {
    return safeUnwrap('get', ['/printer-integration/profiles'], {
      defaultValue: { profiles: {} },
    });
  },

  async getPrinterProfile(printerName) {
    return safeUnwrap('get', [`/printer-integration/profiles/${encodeURIComponent(printerName)}`], {
      defaultValue: {},
    });
  },

  async quickPreheat(printer, material = 'PLA') {
    const resp = await requestWithFallback('post', ['/printer-integration/quick/preheat'], {
      data: { printer, material },
    });
    return unwrap(resp);
  },

  async quickCooldown(printer) {
    const resp = await requestWithFallback('post', ['/printer-integration/quick/cooldown'], {
      data: { printer },
    });
    return unwrap(resp);
  },

  async quickHome(printer, axes = 'XYZ') {
    const resp = await requestWithFallback('post', ['/printer-integration/quick/home'], {
      data: { printer, axes },
    });
    return unwrap(resp);
  },
};

export default api;
