import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../i18n';

const BusinessOverview = () => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getBusinessDashboard();
        const dashboardData = res && typeof res === 'object' && !Array.isArray(res) 
          ? (res.kpis ? res : (res?.data ?? res))
          : {
              revenue_30d: 0,
              profit_30d: 0,
              profit_margin_30d: 0,
              orders_30d: 0,
              active_orders_count: 0,
              average_order_value: 0,
              top_clients: [],
              orders_by_status: {},
              active_clients: 0,
              total_clients: 0
            };
        setData(dashboardData);
      } catch (err) {
        console.error('Error fetching business data:', err);
        setData({
          revenue_30d: 0,
          profit_30d: 0,
          profit_margin_30d: 0,
          orders_30d: 0,
          active_orders_count: 0,
          average_order_value: 0,
          top_clients: [],
          orders_by_status: {},
          active_clients: 0,
          total_clients: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-zinc-500 p-6">{t('common.noData')}</div>;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            💼 {t('business.title')}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">{t('business.subtitle')}</p>
        </div>
      </div>

      {/* Key Metrics Grid - Dark Theme */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
            borderColor: 'rgba(34, 197, 94, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">{t('business.revenue')} (30d)</p>
          <p className="text-2xl font-bold text-green-400">€{data.revenue_30d?.toFixed(2) || '0.00'}</p>
        </div>
        
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',
            borderColor: 'rgba(59, 130, 246, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">{t('business.profit')} (30d)</p>
          <p className="text-2xl font-bold text-blue-400">€{data.profit_30d?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-zinc-500 mt-1">{data.profit_margin_30d?.toFixed(1)}% {t('business.margin')}</p>
        </div>
        
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">{t('business.activeOrders')}</p>
          <p className="text-2xl font-bold text-purple-400">{data.active_orders_count || 0}</p>
        </div>
        
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)',
            borderColor: 'rgba(249, 115, 22, 0.3)'
          }}
        >
          <p className="text-sm text-zinc-400">{t('business.orders')} (30d)</p>
          <p className="text-2xl font-bold text-orange-400">{data.orders_30d || 0}</p>
          <p className="text-xs text-zinc-500 mt-1">€{data.average_order_value?.toFixed(2)} {t('business.avg')}</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Clients */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
            <span>🏆</span>
            <span>{t('business.topClients')}</span>
          </h3>
          {data.top_clients && data.top_clients.length > 0 ? (
            <div className="space-y-2">
              {data.top_clients.map((client, idx) => (
                <div key={client.client_id} className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg flex justify-between items-center hover:bg-gray-800 transition-colors">
                  <div>
                    <p className="font-medium text-white">{idx + 1}. {client.client_name}</p>
                    <p className="text-xs text-zinc-500">{client.total_orders} {t('business.orders').toLowerCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-400">€{client.total_revenue.toFixed(2)}</p>
                    <p className="text-xs text-zinc-500">{client.profit_margin.toFixed(1)}% {t('business.margin')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <p className="text-4xl mb-2">👤</p>
              <p className="text-zinc-500">{t('business.noClientData')}</p>
            </div>
          )}
        </div>

        {/* Orders by Status */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
            <span>📊</span>
            <span>{t('business.ordersByStatus')}</span>
          </h3>
          {data.orders_by_status && Object.keys(data.orders_by_status).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(data.orders_by_status).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      status === 'delivered' ? 'bg-green-500' :
                      status === 'printing' ? 'bg-blue-500' :
                      status === 'cancelled' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`}></span>
                    <span className="capitalize text-zinc-300">{status.replace('_', ' ')}</span>
                  </div>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-zinc-500">{t('business.noOrdersYet')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 pt-6 border-t border-gray-800 grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-2xl font-bold text-white">{data.active_clients || 0}</p>
          <p className="text-sm text-zinc-500">{t('business.activeClients')}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-2xl font-bold text-white">{data.total_clients || 0}</p>
          <p className="text-sm text-zinc-500">{t('business.totalClients')}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-2xl font-bold text-green-400">€{data.average_order_value?.toFixed(2) || '0.00'}</p>
          <p className="text-sm text-zinc-500">{t('business.avgOrderValue')}</p>
        </div>
      </div>
    </div>
  );
};

export default BusinessOverview;
