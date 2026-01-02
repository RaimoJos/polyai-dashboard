import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { safeUnwrap, formatErrorMessage, logError } from '../utils/apiSafety';
import { sanitizeText } from '../utils/sanitization';
import { useLanguage } from '../i18n';
import toast from '../utils/toast';
import ClientOrderHistory from './ClientOrderHistory';

const ClientList = () => {
  const { t } = useLanguage();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [historyClient, setHistoryClient] = useState(null);  // For ClientOrderHistory
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    postal_code: '',
    county: '',
    reg_number: '',
    vat_number: '',
    pricing_tier: 'standard',
    discount_percentage: 0,
    notes: ''
  });

  useEffect(() => {
    fetchClients();
    
    // Listen for openNewClient event from navigation
    const handleOpenNewClient = () => {
      resetForm();
      setShowForm(true);
    };
    window.addEventListener('openNewClient', handleOpenNewClient);
    
    return () => {
      window.removeEventListener('openNewClient', handleOpenNewClient);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.getClients({ status: filterStatus });
      // FIXED: Use safeUnwrap for response validation
      const clientData = safeUnwrap(res, 'array') ?? res ?? [];
      setClients(Array.isArray(clientData) ? clientData : (clientData?.data ?? clientData?.clients ?? []));
    } catch (err) {
      // FIXED: User-friendly error message
      const msg = formatErrorMessage(err, { action: 'load clients' });
      toast.error(msg);
      setClients([]);
      // FIXED: Log error with context
      logError(err, { component: 'ClientList', action: 'fetchClients', filterStatus });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      postal_code: '',
      county: '',
      reg_number: '',
      vat_number: '',
      pricing_tier: 'standard',
      discount_percentage: 0,
      notes: ''
    });
    setEditingClient(null);
    setShowForm(false);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      address: client.address || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      county: client.county || '',
      reg_number: client.reg_number || '',
      vat_number: client.vat_number || '',
      pricing_tier: client.pricing_tier || 'standard',
      discount_percentage: client.discount_percentage || 0,
      notes: client.notes || ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.updateClient(editingClient.client_id, formData);
      } else {
        await api.createClient(formData);
      }
      resetForm();
      fetchClients();
    } catch (err) {
      console.error('Error saving client:', err);
      toast.error(err.response?.data?.error || 'Failed to save client');
    }
  };

  const handleDelete = async (client) => {
    if (!window.confirm(`${t('clients.deleteConfirm')} "${client.name}"?`)) return;
    try {
      await api.updateClient(client.client_id, { status: 'deleted' });
      fetchClients();
    } catch (err) {
      console.error('Error deleting client:', err);
    }
  };

  const handleDeactivate = async (client) => {
    const newStatus = client.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateClient(client.client_id, { status: newStatus });
      fetchClients();
    } catch (err) {
      console.error('Error updating client status:', err);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.company?.toLowerCase().includes(query) ||
      client.phone?.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="h-40 bg-gray-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">👥 {t('clients.title')}</h2>
          <p className="text-sm text-zinc-500">{filteredClients.length} {t('nav.clients').toLowerCase()}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 rounded-lg font-medium text-white transition-colors"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          {showForm ? t('common.cancel') : `+ ${t('clients.addClient')}`}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder={t('clients.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="active">{t('common.active')}</option>
          <option value="inactive">{t('common.inactive')}</option>
          <option value="all">{t('common.all')}</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-gray-800/50 border border-gray-700 p-4 rounded-xl space-y-3">
          <h3 className="font-semibold mb-2 text-white">
            {editingClient ? `${t('clients.editClient')}: ${sanitizeText(editingClient.name)}` : t('clients.addClient')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <input 
              type="text" 
              placeholder={`${t('common.name')} *`} 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
              required 
            />
            <input 
              type="email" 
              placeholder={`${t('common.email')} *`} 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
              required 
            />
            <input 
              type="tel" 
              placeholder={t('common.phone')} 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
            />
            <input 
              type="text" 
              placeholder={t('clients.company')} 
              value={formData.company}
              onChange={(e) => setFormData({...formData, company: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
            />
            <input 
              type="text" 
              placeholder={t('common.address')} 
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 col-span-2" 
            />
            
            {/* Estonian business address fields */}
            <input 
              type="text" 
              placeholder={t('clients.city') || 'Linn'} 
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
            />
            <div className="grid grid-cols-2 gap-2">
              <input 
                type="text" 
                placeholder={t('clients.postalCode') || 'Postiindeks'} 
                value={formData.postal_code}
                onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
              />
              <input 
                type="text" 
                placeholder={t('clients.county') || 'Maakond'} 
                value={formData.county}
                onChange={(e) => setFormData({...formData, county: e.target.value})}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
              />
            </div>
            
            {/* Estonian business registration fields */}
            <input 
              type="text" 
              placeholder={t('clients.regNumber') || 'Rg-kood'} 
              value={formData.reg_number}
              onChange={(e) => setFormData({...formData, reg_number: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
            />
            <input 
              type="text" 
              placeholder={t('clients.vatNumber') || 'KMKR nr (nt EE123456789)'} 
              value={formData.vat_number}
              onChange={(e) => setFormData({...formData, vat_number: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
            />
            <select 
              value={formData.pricing_tier}
              onChange={(e) => setFormData({...formData, pricing_tier: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="wholesale">Wholesale</option>
            </select>
            <input 
              type="number" 
              placeholder={t('clients.discountPercent')} 
              value={formData.discount_percentage}
              onChange={(e) => setFormData({...formData, discount_percentage: parseFloat(e.target.value) || 0})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500" 
              min="0" 
              max="100" 
            />
            <textarea 
              placeholder={t('common.notes')} 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 col-span-2" 
              rows={2} 
            />
          </div>
          <div className="flex gap-2">
            <button 
              type="submit" 
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
            >
              {editingClient ? t('common.save') : t('common.add')}
            </button>
            {editingClient && (
              <button 
                type="button" 
                onClick={resetForm}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {filteredClients.map(client => (
          <div key={client.client_id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{sanitizeText(client.name)}</p>
                  {client.status === 'inactive' && (
                    <span className="px-2 py-0.5 bg-gray-700 text-zinc-400 rounded text-xs">{t('common.inactive')}</span>
                  )}
                </div>
                {client.company && <p className="text-sm text-zinc-400">{sanitizeText(client.company)}</p>}
                <p className="text-sm text-zinc-500">{sanitizeText(client.email)}</p>
                {client.phone && <p className="text-xs text-zinc-600">{sanitizeText(client.phone)}</p>}
              </div>
              
              <div className="text-right mr-4">
                <p className="text-sm font-medium text-green-400">€{(client.total_revenue || 0).toFixed(2)}</p>
                <p className="text-xs text-zinc-500">{client.total_orders || 0} {t('business.orders').toLowerCase()}</p>
                {client.discount_percentage > 0 && (
                  <p className="text-xs text-orange-400">{client.discount_percentage}%</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => setHistoryClient(client)}
                  className="px-3 py-1 text-xs bg-purple-900/50 text-purple-300 rounded-lg hover:bg-purple-800/50 transition-colors"
                >
                  📊 History
                </button>
                <button 
                  onClick={() => handleEdit(client)}
                  className="px-3 py-1 text-xs bg-blue-900/50 text-blue-300 rounded-lg hover:bg-blue-800/50 transition-colors"
                >
                  ✏️ {t('common.edit')}
                </button>
                <button 
                  onClick={() => handleDeactivate(client)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    client.status === 'active' 
                      ? 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50'
                      : 'bg-green-900/50 text-green-300 hover:bg-green-800/50'
                  }`}
                >
                  {client.status === 'active' ? '⏸️' : '▶️'}
                </button>
                <button 
                  onClick={() => handleDelete(client)}
                  className="px-3 py-1 text-xs bg-red-900/50 text-red-300 rounded-lg hover:bg-red-800/50 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">👤</p>
          <p className="text-zinc-500">
            {searchQuery ? t('clients.noSearchResults') || 'No clients match your search' : t('clients.noClients')}
          </p>
          <p className="text-xs text-zinc-600 mt-1">{t('clients.addFirst')}</p>
        </div>
      )}

      {/* Client Order History Modal */}
      {historyClient && (
        <ClientOrderHistory
          client={historyClient}
          onClose={() => setHistoryClient(null)}
          onCreateOrder={() => {
            setHistoryClient(null);
            // Navigate to quote calculator with this client selected
            window.dispatchEvent(new CustomEvent('prefillQuoteClient', { detail: historyClient }));
          }}
        />
      )}
    </div>
  );
};

export default ClientList;
