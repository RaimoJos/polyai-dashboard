import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import SlicerSettings from './SlicerSettings';
// UserManagement removed - now using TeamManagement in Config > Team tab

const ConfigTab = ({ canManageUsers = false }) => {
  const [activeSection, setActiveSection] = useState('company');
  const [companyInfo, setCompanyInfo] = useState({});
  const [pricingConfig, setPricingConfig] = useState({});
  const [notificationConfig, setNotificationConfig] = useState({});
  const [laborConfig, setLaborConfig] = useState({});
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [languages, setLanguages] = useState({}); // eslint-disable-line no-unused-vars
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');



  useEffect(() => {
    loadAllConfig();
  }, []);

  const loadAllConfig = async () => {
    setLoading(true);
    try {
      // All these use safeUnwrap which returns defaultValue directly on error
      const [company, pricing, notifications, langs, labor, expenses] = await Promise.all([
        api.getCompanyInfo().catch(() => ({})),
        api.getPricingConfig().catch(() => ({})),
        api.getNotificationsConfig().catch(() => ({})),
        api.getLanguages().catch(() => ['en', 'et']),
        api.getLaborConfig().catch(() => ({})),
        api.getExpenseSummary().catch(() => null),
      ]);

      // safeUnwrap returns data directly, no need to unwrap further
      // But handle edge cases where backend might return wrapped data
      const normalize = (val, fallback = {}) => {
        if (!val) return fallback;
        if (typeof val !== 'object') return fallback;
        // If it has a nested data property, use that
        if (val.data && typeof val.data === 'object') return val.data;
        return val;
      };
      
      setCompanyInfo(normalize(company));
      setPricingConfig(normalize(pricing));
      setNotificationConfig(normalize(notifications));
      setLanguages(Array.isArray(langs) ? langs : normalize(langs, ['en', 'et']));
      setLaborConfig(normalize(labor));
      setExpenseSummary(expenses || null);
      
      const companyData = normalize(company);
      if (companyData?.default_language) {
        setDefaultLanguage(companyData.default_language);
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
    setLoading(false);
  };

  const saveCompanyInfo = async () => {
    try {
      await api.updateCompanyInfo({ ...companyInfo, default_language: defaultLanguage });
      showSaveMessage('Company info saved!');
    } catch (err) {
      showSaveMessage('Error saving: ' + err.message, true);
    }
  };

  const savePricingConfig = async () => {
    try {
      await api.updatePricingConfig(pricingConfig);
      showSaveMessage('Pricing config saved!');
    } catch (err) {
      showSaveMessage('Error saving: ' + err.message, true);
    }
  };

  const saveLaborConfig = async () => {
    try {
      await api.updateLaborConfig({
        net_hourly_rate: laborConfig.net_hourly_rate || 8,
      });
      showSaveMessage('Labor config saved!');
      loadAllConfig();
    } catch (err) {
      showSaveMessage('Error saving: ' + err.message, true);
    }
  };

  const saveNotificationConfig = async () => {
    try {
      await api.updateNotificationsConfig(notificationConfig);
      showSaveMessage('Notification settings saved!');
    } catch (err) {
      showSaveMessage('Error saving: ' + err.message, true);
    }
  };

  const showSaveMessage = (message, isError = false) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // Helper to get VAT as percentage for display
  const getVatPercent = () => {
    const rate = pricingConfig.tax_rate;
    if (rate === undefined || rate === null) return 22;
    // If rate > 1, it's already a percentage (legacy bug)
    // If rate <= 1, it's a decimal
    return rate > 1 ? rate : rate * 100;
  };

  // Helper to set VAT from percentage input
  const setVatPercent = (percent) => {
    setPricingConfig({
      ...pricingConfig,
      tax_rate: parseFloat(percent) / 100  // Always store as decimal
    });
  };

  const formatCurrency = (amount) => `${(amount || 0).toFixed(2)}€`;

  const sections = [
    { id: 'company', name: '🏢 Company Info' },
    { id: 'pricing', name: '💰 Pricing' },
    { id: 'labor', name: '👷 Labor & Costs' },
    { id: 'slicer', name: '🔪 Slicer' },
    { id: 'notifications', name: '🔔 Notifications' },
    // Users section removed - now managed via Team tab in Config
  ];

  return (
    <div className="config-tab">
      {saveMessage && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          saveMessage.includes('Error') ? 'bg-red-500' : 'bg-green-500'
        } text-white`}>
          {saveMessage}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 rounded-lg shadow p-4 border border-gray-800">
          <h2 className="text-xl font-bold mb-4 text-white">⚙️ Configuration</h2>
          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
                  activeSection === section.id
                    ? 'text-white'
                    : 'hover:bg-gray-800 text-gray-400'
                }`}
                style={activeSection === section.id ? {
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                } : {}}
              >
                {section.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {loading ? (
            <div className="bg-gray-900 rounded-lg shadow p-8 text-center border border-gray-800">
              <div className="text-4xl mb-4">⏳</div>
              <p className="text-gray-400">Loading configuration...</p>
            </div>
          ) : (
            <>
              {/* COMPANY INFO */}
              {activeSection === 'company' && (
                <div className="bg-gray-900 rounded-lg shadow p-6 border border-gray-800">
                  <h2 className="text-2xl font-bold mb-6 text-white">🏢 Company Information</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Company Name *</label>
                      <input
                        type="text"
                        value={companyInfo.name || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Tagline</label>
                      <input
                        type="text"
                        value={companyInfo.tagline || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, tagline: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">VAT Number *</label>
                      <input
                        type="text"
                        value={companyInfo.vat_number || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, vat_number: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                        placeholder="EEXXXXXXXXX"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Registration Number</label>
                      <input
                        type="text"
                        value={companyInfo.registration_number || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, registration_number: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Email *</label>
                      <input
                        type="email"
                        value={companyInfo.email || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, email: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Phone</label>
                      <input
                        type="tel"
                        value={companyInfo.phone || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, phone: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Website</label>
                      <input
                        type="url"
                        value={companyInfo.website || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, website: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Country</label>
                      <input
                        type="text"
                        value={companyInfo.country || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, country: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2 text-zinc-400">Address</label>
                      <textarea
                        value={companyInfo.address || ''}
                        onChange={(e) => setCompanyInfo({...companyInfo, address: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={saveCompanyInfo} 
                      className="px-6 py-3 text-white rounded-lg font-medium"
                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                    >
                      💾 Save Company Info
                    </button>
                  </div>
                </div>
              )}

              {/* PRICING */}
              {activeSection === 'pricing' && (
                <div className="bg-gray-900 rounded-lg shadow p-6 border border-gray-800">
                  <h2 className="text-2xl font-bold mb-6 text-white">💰 Pricing Configuration</h2>

                  <div className="space-y-6">
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <h3 className="font-semibold mb-4 text-white">General Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Currency</label>
                          <select
                            value={pricingConfig.currency || 'EUR'}
                            onChange={(e) => setPricingConfig({...pricingConfig, currency: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          >
                            <option value="EUR">EUR (€)</option>
                            <option value="USD">USD ($)</option>
                            <option value="GBP">GBP (£)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">VAT Rate (%)</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={getVatPercent()}
                            onChange={(e) => setVatPercent(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">Estonia: 22% (standard), 24% from 2025</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Machine Rate (€/hour)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={pricingConfig.machine_hourly_rate || 2.5}
                            onChange={(e) => setPricingConfig({...pricingConfig, machine_hourly_rate: parseFloat(e.target.value)})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Profit Margin (%)</label>
                          <input
                            type="number"
                            step="1"
                            value={(pricingConfig.default_profit_margin || 0.40) * 100}
                            onChange={(e) => setPricingConfig({...pricingConfig, default_profit_margin: parseFloat(e.target.value) / 100})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Rush Order Fee (%)</label>
                          <input
                            type="number"
                            step="1"
                            value={((pricingConfig.rush_order_multiplier || 1.5) - 1) * 100}
                            onChange={(e) => setPricingConfig({...pricingConfig, rush_order_multiplier: (parseFloat(e.target.value) / 100) + 1})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Labor Hours/Job</label>
                          <input
                            type="number"
                            step="0.1"
                            value={pricingConfig.labor_hours_per_job || 0.5}
                            onChange={(e) => setPricingConfig({...pricingConfig, labor_hours_per_job: parseFloat(e.target.value)})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <h3 className="font-semibold mb-4 text-white">Material Prices (€/kg)</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['PLA', 'PETG', 'ABS', 'TPU', 'Nylon', 'ASA', 'PC', 'PVA'].map(mat => (
                          <div key={mat}>
                            <label className="block text-sm font-medium mb-2 text-zinc-400">{mat}</label>
                            <input
                              type="number"
                              step="0.01"
                              value={pricingConfig.material_costs?.[mat] || 25}
                              onChange={(e) => setPricingConfig({
                                ...pricingConfig,
                                material_costs: {
                                  ...pricingConfig.material_costs,
                                  [mat]: parseFloat(e.target.value)
                                }
                              })}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <h3 className="font-semibold mb-4 text-white">Complexity Multipliers</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['low', 'medium', 'high', 'extreme'].map(level => (
                          <div key={level}>
                            <label className="block text-sm font-medium mb-2 capitalize text-zinc-400">{level}</label>
                            <input
                              type="number"
                              step="0.1"
                              value={pricingConfig.complexity_multipliers?.[level] || 1.0}
                              onChange={(e) => setPricingConfig({
                                ...pricingConfig,
                                complexity_multipliers: {
                                  ...pricingConfig.complexity_multipliers,
                                  [level]: parseFloat(e.target.value)
                                }
                              })}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">1.0 = no change, 1.5 = 50% more, 2.0 = double</p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={savePricingConfig} 
                      className="px-6 py-3 text-white rounded-lg font-medium"
                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                    >
                      💾 Save Pricing Config
                    </button>
                  </div>
                </div>
              )}

              {/* LABOR & COSTS */}
              {activeSection === 'labor' && (
                <div className="space-y-6">
                  <div className="bg-gray-900 rounded-lg shadow p-6 border border-gray-800">
                    <h2 className="text-2xl font-bold mb-6 text-white">👷 Labor & Business Costs</h2>

                    <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg mb-6">
                      <h3 className="font-semibold mb-2 text-blue-400">🇪🇪 Estonian Tax Calculator</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Enter the NET hourly rate (what worker receives). The system calculates full employer cost including social tax (33%), unemployment insurance, etc.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Net Hourly Rate (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={laborConfig.net_hourly_rate || 8}
                            onChange={(e) => setLaborConfig({...laborConfig, net_hourly_rate: parseFloat(e.target.value)})}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">What worker sees on paycheck</p>
                        </div>
                        
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                          <p className="text-sm text-gray-500">Employer Cost/Hour</p>
                          <p className="text-2xl font-bold text-red-400">
                            {formatCurrency(laborConfig.employer_hourly_cost || 16.97)}
                          </p>
                          <p className="text-xs text-gray-500">Actual cost to business</p>
                        </div>
                        
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                          <p className="text-sm text-gray-500">Cost Multiplier</p>
                          <p className="text-2xl font-bold text-white">
                            {(laborConfig.cost_multiplier || 2.12).toFixed(2)}x
                          </p>
                          <p className="text-xs text-gray-500">Net × multiplier = employer cost</p>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button onClick={saveLaborConfig} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
                          💾 Save Labor Config
                        </button>
                      </div>
                    </div>

                    {/* Monthly Summary */}
                    {laborConfig.monthly_160h && (
                      <div className="p-4 bg-gray-800/50 rounded-lg mb-6 border border-gray-700">
                        <h3 className="font-semibold mb-3 text-white">Monthly Costs (160h)</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Net Salary</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(laborConfig.monthly_160h.net_salary)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Employer Total Cost</p>
                            <p className="text-xl font-bold text-red-400">{formatCurrency(laborConfig.monthly_160h.employer_cost)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expense Summary */}
                    {expenseSummary?.monthly_overhead && (
                      <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <h3 className="font-semibold mb-3 text-white">Monthly Overhead</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Total Monthly</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(expenseSummary.monthly_overhead.total_monthly)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Overhead/Print Hour</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(expenseSummary.hourly_overhead_rate_160h)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Active Expenses</p>
                            <p className="text-xl font-bold text-white">{expenseSummary.monthly_overhead.expense_count || 0}</p>
                          </div>
                        </div>
                        
                        {expenseSummary.monthly_overhead.by_category && Object.keys(expenseSummary.monthly_overhead.by_category).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-700">
                            <p className="text-sm font-medium mb-2 text-zinc-400">By Category:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(expenseSummary.monthly_overhead.by_category).map(([cat, amount]) => (
                                <span key={cat} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-white">
                                  {cat}: {formatCurrency(amount)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-400">
                        💡 <strong>Tip:</strong> Add business expenses (rent, utilities, subscriptions) via the Cost Analytics API to get accurate overhead allocation per print.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SLICER SETTINGS */}
              {activeSection === 'slicer' && (
                <SlicerSettings />
              )}

              {/* NOTIFICATIONS */}
              {activeSection === 'notifications' && (
                <div className="bg-gray-900 rounded-lg shadow p-6 border border-gray-800">
                  <h2 className="text-2xl font-bold mb-6 text-white">🔔 Notification Settings</h2>

                  <div className="space-y-6">
                    {/* Discord */}
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">💬</span>
                        <h3 className="font-semibold text-white">Discord</h3>
                        <input
                          type="checkbox"
                          checked={notificationConfig.discord?.enabled || false}
                          onChange={(e) => setNotificationConfig({
                            ...notificationConfig,
                            discord: { ...notificationConfig.discord, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 ml-auto"
                        />
                      </div>
                      {notificationConfig.discord?.enabled && (
                        <div>
                          <label className="block text-sm font-medium mb-2 text-zinc-400">Webhook URL</label>
                          <input
                            type="url"
                            value={notificationConfig.discord?.webhook_url || ''}
                            onChange={(e) => setNotificationConfig({
                              ...notificationConfig,
                              discord: { ...notificationConfig.discord, webhook_url: e.target.value }
                            })}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            placeholder="https://discord.com/api/webhooks/..."
                          />
                        </div>
                      )}
                    </div>

                    {/* Telegram */}
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">✈️</span>
                        <h3 className="font-semibold text-white">Telegram</h3>
                        <input
                          type="checkbox"
                          checked={notificationConfig.telegram?.enabled || false}
                          onChange={(e) => setNotificationConfig({
                            ...notificationConfig,
                            telegram: { ...notificationConfig.telegram, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 ml-auto"
                        />
                      </div>
                      {notificationConfig.telegram?.enabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-zinc-400">Bot Token</label>
                            <input
                              type="password"
                              value={notificationConfig.telegram?.bot_token || ''}
                              onChange={(e) => setNotificationConfig({
                                ...notificationConfig,
                                telegram: { ...notificationConfig.telegram, bot_token: e.target.value }
                              })}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                              placeholder="123456:ABC-DEF..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-zinc-400">Chat ID</label>
                            <input
                              type="text"
                              value={notificationConfig.telegram?.chat_id || ''}
                              onChange={(e) => setNotificationConfig({
                                ...notificationConfig,
                                telegram: { ...notificationConfig.telegram, chat_id: e.target.value }
                              })}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                              placeholder="-1001234567890"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email/Gmail */}
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">📧</span>
                        <h3 className="font-semibold text-white">Email (Gmail)</h3>
                        <input
                          type="checkbox"
                          checked={notificationConfig.email?.enabled || false}
                          onChange={(e) => setNotificationConfig({
                            ...notificationConfig,
                            email: { ...notificationConfig.email, enabled: e.target.checked }
                          })}
                          className="w-4 h-4 ml-auto"
                        />
                      </div>
                      {notificationConfig.email?.enabled && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-zinc-400">Gmail Address</label>
                              <input
                                type="email"
                                value={notificationConfig.email?.smtp_user || ''}
                                onChange={(e) => setNotificationConfig({
                                  ...notificationConfig,
                                  email: { 
                                    ...notificationConfig.email, 
                                    smtp_user: e.target.value,
                                    smtp_server: 'smtp.gmail.com',
                                    smtp_port: 587
                                  }
                                })}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                placeholder="your@gmail.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-zinc-400">App Password</label>
                              <input
                                type="password"
                                value={notificationConfig.email?.smtp_password || ''}
                                onChange={(e) => setNotificationConfig({
                                  ...notificationConfig,
                                  email: { ...notificationConfig.email, smtp_password: e.target.value }
                                })}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                                placeholder="xxxx xxxx xxxx xxxx"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            💡 Use a <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer" className="text-blue-400 underline">Gmail App Password</a>, not your regular password.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Events */}
                    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <h3 className="font-semibold mb-4 text-white">Notification Events</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                          { key: 'print_complete', label: '✅ Print Complete' },
                          { key: 'print_failed', label: '❌ Print Failed' },
                          { key: 'low_filament', label: '🧵 Low Filament' },
                          { key: 'maintenance_due', label: '🔧 Maintenance Due' },
                          { key: 'order_received', label: '📦 New Order' },
                          { key: 'daily_report', label: '📊 Daily Report' }
                        ].map(event => (
                          <div key={event.key} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`event-${event.key}`}
                              checked={notificationConfig.events?.[event.key] !== false}
                              onChange={(e) => setNotificationConfig({
                                ...notificationConfig,
                                events: { ...notificationConfig.events, [event.key]: e.target.checked }
                              })}
                              className="w-4 h-4"
                            />
                            <label htmlFor={`event-${event.key}`} className="text-sm text-zinc-300">{event.label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={saveNotificationConfig} 
                      className="px-6 py-3 text-white rounded-lg font-medium"
                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
                    >
                      💾 Save Notification Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Users section moved to Team Management */}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigTab;
