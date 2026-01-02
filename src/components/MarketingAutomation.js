import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import toast from '../utils/toast';

const MarketingAutomation = () => {
  const [contentPosts, setContentPosts] = useState([]);
  const [language, setLanguage] = useState('en');
  const [languages, setLanguages] = useState({});
  const [shippingResult, setShippingResult] = useState(null);
  const [shippingForm, setShippingForm] = useState({
    country: 'FI',
    weight_kg: 0.1,
    order_value: 50
  });

  const fetchContent = useCallback(async () => {
    try {
      const res = await api.getDailySocialContent({ language, days: 7 });
      const posts = Array.isArray(res) ? res : (res?.posts ?? res?.data ?? []);
      setContentPosts(posts);
    } catch (err) {
      console.error('Error fetching content:', err);
      setContentPosts([]);
    }
  }, [language]);

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await api.getLanguages();
      const langs = Array.isArray(res) ? res : (res?.languages ?? res?.data ?? ['en', 'et']);
      if (Array.isArray(langs)) {
        const langObj = {};
        langs.forEach(l => { langObj[l] = l.toUpperCase(); });
        setLanguages(langObj);
      } else {
        setLanguages(langs);
      }
    } catch (err) {
      console.error('Error fetching languages:', err);
      setLanguages({ en: 'EN', et: 'ET' });
    }
  }, []);

  useEffect(() => {
    fetchContent();
    fetchLanguages();
  }, [fetchContent, fetchLanguages]);

  const calculateShipping = async () => {
    try {
      const res = await api.calculateShipping(shippingForm);
      const result = res?.data ?? res ?? null;
      setShippingResult(result);
    } catch (err) {
      console.error('Error calculating shipping:', err);
      setShippingResult(null);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      toast.error('Copy failed (check browser permissions)');
    }
  };

  return (
    <div className="space-y-6">
      {/* Language Selector */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4">🌍 Multi-Language Setup</h2>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(languages).map(([code, info]) => (
            <button
              key={code}
              onClick={() => setLanguage(code)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                language === code
                  ? 'text-white'
                  : 'bg-gray-800 text-zinc-300 hover:bg-gray-700'
              }`}
              style={language === code ? { background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' } : {}}
            >
              {typeof info === 'object' ? `${info.flag} ${info.native}` : info}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Content below will be generated in: <strong className="text-white">{typeof languages[language] === 'object' ? languages[language]?.native : languages[language]}</strong>
        </p>
      </div>

      {/* Social Media Content Calendar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">📱 Automated Social Media Content</h2>
          <button
            onClick={fetchContent}
            className="px-4 py-2 text-white rounded-lg font-medium"
            style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
          >
            🔄 Refresh Content
          </button>
        </div>

        <div 
          className="rounded-lg p-4 mb-6"
          style={{ 
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-300">
            <strong className="text-white">💡 Your Daily Content Strategy:</strong> Pre-generated posts ready to copy & paste to Facebook and Instagram.
            Post at suggested times for maximum engagement. Update with your actual photos/videos!
          </p>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {contentPosts.map((post, idx) => (
            <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="font-semibold text-lg text-white">{post.day_of_week}</span>
                  <span className="text-zinc-400 ml-2 text-sm">{new Date(post.date).toLocaleDateString()}</span>
                  <span 
                    className="ml-3 text-sm px-2 py-1 rounded"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                      color: '#c084fc'
                    }}
                  >
                    {String(post.post_type || '').replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Best time: <strong className="text-white">{post.best_time}</strong></p>
                  <div className="flex gap-1 mt-1">
                    {(post.platform || []).map((p) => (
                      <span key={p} className="text-xs bg-gray-700 text-zinc-300 px-2 py-1 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 p-3 rounded mb-3">
                <p className="whitespace-pre-wrap text-zinc-300">{post.full_text}</p>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-zinc-500 mb-1"><strong>📸 Image Ideas:</strong></p>
                  <p className="text-xs text-zinc-400">{(post.image_suggestions || []).join(', ')}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(post.full_text)}
                  className="px-3 py-1 text-white text-sm rounded font-medium"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                >
                  📋 Copy Post
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Shipping Calculator */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4">🌍 Global Shipping Calculator</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-white mb-3">Calculate Shipping</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Destination Country</label>
                <select
                  value={shippingForm.country}
                  onChange={(e) => setShippingForm({...shippingForm, country: e.target.value})}
                  className="w-full rounded-lg px-3 py-2"
                >
                  <option value="EE">🇪🇪 Estonia</option>
                  <option value="LV">🇱🇻 Latvia</option>
                  <option value="LT">🇱🇹 Lithuania</option>
                  <option value="FI">🇫🇮 Finland</option>
                  <option value="SE">🇸🇪 Sweden</option>
                  <option value="NO">🇳🇴 Norway</option>
                  <option value="DK">🇩🇰 Denmark</option>
                  <option value="DE">🇩🇪 Germany</option>
                  <option value="FR">🇫🇷 France</option>
                  <option value="NL">🇳🇱 Netherlands</option>
                  <option value="BE">🇧🇪 Belgium</option>
                  <option value="PL">🇵🇱 Poland</option>
                  <option value="ES">🇪🇸 Spain</option>
                  <option value="IT">🇮🇹 Italy</option>
                  <option value="GB">🇬🇧 United Kingdom</option>
                  <option value="US">🇺🇸 United States</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={shippingForm.weight_kg}
                  onChange={(e) => setShippingForm({...shippingForm, weight_kg: parseFloat(e.target.value)})}
                  className="w-full rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Order Value (€)</label>
                <input
                  type="number"
                  value={shippingForm.order_value}
                  onChange={(e) => setShippingForm({...shippingForm, order_value: parseFloat(e.target.value)})}
                  className="w-full rounded-lg px-3 py-2"
                />
              </div>

              <button
                onClick={calculateShipping}
                className="w-full py-2 rounded-lg text-white font-medium"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                Calculate Shipping
              </button>
            </div>
          </div>

          <div>
            {shippingResult ? (
              <div 
                className="p-6 rounded-lg h-full"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                <h3 className="font-semibold text-lg text-white mb-3">Shipping Quote</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Carrier:</span>
                    <span className="font-semibold text-white">{shippingResult.carrier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Delivery Time:</span>
                    <span className="font-semibold text-white">{shippingResult.delivery_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Shipping Cost:</span>
                    <span className="font-semibold text-white">€{Number(shippingResult.shipping_cost).toFixed(2)}</span>
                  </div>
                  {shippingResult.free_shipping && (
                    <div className="bg-green-900/30 text-green-400 px-3 py-2 rounded border border-green-700">
                      🎉 FREE SHIPPING!
                    </div>
                  )}
                  {shippingResult.tracking && (
                    <div className="text-xs text-green-400">✓ Tracking included</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 p-6 rounded-lg text-center text-zinc-500 h-full flex items-center justify-center border border-gray-700">
                <div>
                  <p className="text-3xl mb-2">📦</p>
                  <p>Calculate shipping to see quote</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strategy Guide */}
      <div 
        className="rounded-xl p-6"
        style={{ 
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.3)'
        }}
      >
        <h3 className="text-xl font-bold text-white mb-4">🎯 Your Marketing Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <h4 className="font-semibold text-white mb-2">📱 Social Media</h4>
            <ul className="text-sm space-y-1 text-zinc-400">
              <li>• Post daily (use generator above)</li>
              <li>• Best times: 9-11 AM, 2-4 PM</li>
              <li>• Engage with comments</li>
              <li>• Use Stories for behind-scenes</li>
              <li>• Share client testimonials</li>
            </ul>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <h4 className="font-semibold text-white mb-2">🌍 Global Reach</h4>
            <ul className="text-sm space-y-1 text-zinc-400">
              <li>• Target: Baltic, Nordic, EU</li>
              <li>• Multi-language content</li>
              <li>• Competitive shipping rates</li>
              <li>• Free shipping over thresholds</li>
              <li>• Fast EU delivery (2-7 days)</li>
            </ul>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <h4 className="font-semibold text-white mb-2">🔍 SEO Focus</h4>
            <ul className="text-sm space-y-1 text-zinc-400">
              <li>• "3D printing + [city]"</li>
              <li>• Multi-language landing pages</li>
              <li>• Portfolio blog posts</li>
              <li>• Client case studies</li>
              <li>• Technical guides</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingAutomation;
