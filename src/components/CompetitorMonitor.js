import React, { useState, useEffect } from 'react';

/**
 * CompetitorMonitor - Track competitor pricing and positioning
 * Manual entry + potential web scraping integration
 */
function CompetitorMonitor() {
  const [competitors, setCompetitors] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [priceHistory, setPriceHistory] = useState({});

  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = () => {
    const saved = localStorage.getItem('polywerk_competitors');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompetitors(data.competitors || getDefaultCompetitors());
        setPriceHistory(data.priceHistory || {});
      } catch (e) {
        setCompetitors(getDefaultCompetitors());
      }
    } else {
      setCompetitors(getDefaultCompetitors());
    }
  };

  const saveCompetitors = (comps, history) => {
    localStorage.setItem('polywerk_competitors', JSON.stringify({
      competitors: comps,
      priceHistory: history,
    }));
    setCompetitors(comps);
    setPriceHistory(history);
  };

  const getDefaultCompetitors = () => [
    {
      id: 'comp-1',
      name: '3D Print Estonia',
      website: 'https://3dprint.ee',
      location: 'Tallinn',
      pricing: {
        pla_per_hour: 10,
        petg_per_hour: 12,
        setup_fee: 8,
        rush_multiplier: 1.8,
        min_order: 15,
      },
      services: ['FDM', 'SLA', 'Design'],
      strengths: ['Fast turnaround', 'Good reviews'],
      weaknesses: ['Higher prices', 'Limited materials'],
      lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Main competitor in Tallinn market',
    },
    {
      id: 'comp-2',
      name: 'PrintHub',
      website: 'https://printhub.ee',
      location: 'Tartu',
      pricing: {
        pla_per_hour: 7,
        petg_per_hour: 9,
        setup_fee: 5,
        rush_multiplier: 1.5,
        min_order: 10,
      },
      services: ['FDM', 'Finishing'],
      strengths: ['Lower prices', 'Student discounts'],
      weaknesses: ['Slower delivery', 'Basic materials only'],
      lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Budget option, targets students',
    },
    {
      id: 'comp-3',
      name: 'Industrial Proto',
      website: 'https://industrialproto.ee',
      location: 'Tallinn',
      pricing: {
        pla_per_hour: 15,
        petg_per_hour: 18,
        setup_fee: 25,
        rush_multiplier: 2.0,
        min_order: 50,
      },
      services: ['FDM', 'SLS', 'Metal', 'Engineering'],
      strengths: ['Industrial quality', 'Engineering support', 'ISO certified'],
      weaknesses: ['Very expensive', 'Long lead times', 'High minimums'],
      lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'Premium industrial segment',
    },
  ];

  // Calculate our position
  const ourPricing = {
    pla_per_hour: 8,
    petg_per_hour: 10,
    setup_fee: 5,
    rush_multiplier: 1.5,
    min_order: 0,
  };

  const marketAnalysis = {
    avgPlaRate: competitors.reduce((s, c) => s + (c.pricing?.pla_per_hour || 0), 0) / competitors.length,
    avgSetupFee: competitors.reduce((s, c) => s + (c.pricing?.setup_fee || 0), 0) / competitors.length,
    ourPosition: 'competitive', // calculated below
    priceAdvantage: 0,
  };

  marketAnalysis.priceAdvantage = Math.round(((marketAnalysis.avgPlaRate - ourPricing.pla_per_hour) / marketAnalysis.avgPlaRate) * 100);
  marketAnalysis.ourPosition = marketAnalysis.priceAdvantage > 10 ? 'budget' : 
                                marketAnalysis.priceAdvantage < -10 ? 'premium' : 'competitive';

  const addCompetitor = (competitor) => {
    const newCompetitor = {
      ...competitor,
      id: `comp-${Date.now()}`,
      lastUpdated: new Date().toISOString(),
    };
    saveCompetitors([...competitors, newCompetitor], priceHistory);
    setShowAddModal(false);
  };

  const updateCompetitor = (id, updates) => {
    const updated = competitors.map(c => 
      c.id === id ? { ...c, ...updates, lastUpdated: new Date().toISOString() } : c
    );
    
    // Track price history
    const comp = competitors.find(c => c.id === id);
    if (comp && updates.pricing) {
      const history = priceHistory[id] || [];
      history.push({
        date: new Date().toISOString(),
        pricing: comp.pricing,
      });
      setPriceHistory({ ...priceHistory, [id]: history.slice(-10) }); // Keep last 10
    }
    
    saveCompetitors(updated, priceHistory);
  };

  const deleteCompetitor = (id) => {
    if (window.confirm('Delete this competitor?')) {
      saveCompetitors(competitors.filter(c => c.id !== id), priceHistory);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const daysSinceUpdate = (dateStr) => {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🔍 Competitor Monitor
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Track market pricing and positioning
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
        >
          + Add Competitor
        </button>
      </div>

      {/* Market Position */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Market Position</p>
          <p className={`text-xl font-bold capitalize ${
            marketAnalysis.ourPosition === 'budget' ? 'text-green-400' :
            marketAnalysis.ourPosition === 'premium' ? 'text-purple-400' :
            'text-cyan-400'
          }`}>
            {marketAnalysis.ourPosition}
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Price vs Market</p>
          <p className={`text-xl font-bold ${
            marketAnalysis.priceAdvantage > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {marketAnalysis.priceAdvantage > 0 ? '-' : '+'}{Math.abs(marketAnalysis.priceAdvantage)}%
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Avg Market Rate (PLA)</p>
          <p className="text-white text-xl font-bold">{formatCurrency(marketAnalysis.avgPlaRate)}/h</p>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">Competitors Tracked</p>
          <p className="text-white text-xl font-bold">{competitors.length}</p>
        </div>
      </div>

      {/* Price Comparison Chart */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h3 className="font-medium text-white mb-4">💰 Price Comparison (PLA/hour)</h3>
        <div className="space-y-3">
          {/* Our pricing */}
          <div className="flex items-center gap-4">
            <div className="w-32 text-sm text-cyan-400 font-medium">Polywerk (You)</div>
            <div className="flex-1">
              <div className="h-8 rounded-lg overflow-hidden bg-slate-700">
                <div 
                  className="h-full rounded-lg"
                  style={{ 
                    width: `${(ourPricing.pla_per_hour / 20) * 100}%`,
                    background: 'linear-gradient(to right, #06b6d4, #3b82f6)',
                  }}
                />
              </div>
            </div>
            <div className="w-20 text-right text-cyan-400 font-bold">
              {formatCurrency(ourPricing.pla_per_hour)}
            </div>
          </div>

          {/* Competitors */}
          {competitors.map(comp => (
            <div key={comp.id} className="flex items-center gap-4">
              <div className="w-32 text-sm text-slate-400 truncate">{comp.name}</div>
              <div className="flex-1">
                <div className="h-8 rounded-lg overflow-hidden bg-slate-700">
                  <div 
                    className={`h-full rounded-lg ${
                      comp.pricing.pla_per_hour > ourPricing.pla_per_hour 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${(comp.pricing.pla_per_hour / 20) * 100}%` }}
                  />
                </div>
              </div>
              <div className={`w-20 text-right font-medium ${
                comp.pricing.pla_per_hour > ourPricing.pla_per_hour 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                {formatCurrency(comp.pricing.pla_per_hour)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competitors.map(comp => (
          <div
            key={comp.id}
            className="rounded-xl border p-4 cursor-pointer hover:border-purple-500/50 transition"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
            onClick={() => setSelectedCompetitor(comp)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-medium text-white">{comp.name}</h3>
                <p className="text-sm text-slate-500">{comp.location}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm ${
                  daysSinceUpdate(comp.lastUpdated) > 14 ? 'text-yellow-400' : 'text-slate-500'
                }`}>
                  {daysSinceUpdate(comp.lastUpdated)}d ago
                </p>
              </div>
            </div>

            {/* Quick Pricing */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-xs text-slate-500">PLA/h</p>
                <p className="text-white font-medium">{formatCurrency(comp.pricing.pla_per_hour)}</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-xs text-slate-500">Setup</p>
                <p className="text-white font-medium">{formatCurrency(comp.pricing.setup_fee)}</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-xs text-slate-500">Min Order</p>
                <p className="text-white font-medium">{formatCurrency(comp.pricing.min_order)}</p>
              </div>
            </div>

            {/* Services */}
            <div className="flex flex-wrap gap-1 mb-3">
              {comp.services?.map((service, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                  {service}
                </span>
              ))}
            </div>

            {/* Strengths/Weaknesses */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-green-400">✓</span>
                <span className="text-slate-500 ml-1">{comp.strengths?.[0]}</span>
              </div>
              <div>
                <span className="text-red-400">✗</span>
                <span className="text-slate-500 ml-1">{comp.weaknesses?.[0]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <AddCompetitorModal
          onClose={() => setShowAddModal(false)}
          onAdd={addCompetitor}
        />
      )}

      {/* Competitor Detail Modal */}
      {selectedCompetitor && (
        <CompetitorDetailModal
          competitor={selectedCompetitor}
          priceHistory={priceHistory[selectedCompetitor.id] || []}
          onClose={() => setSelectedCompetitor(null)}
          onUpdate={(updates) => updateCompetitor(selectedCompetitor.id, updates)}
          onDelete={() => {
            deleteCompetitor(selectedCompetitor.id);
            setSelectedCompetitor(null);
          }}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

/**
 * AddCompetitorModal
 */
function AddCompetitorModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    name: '',
    website: '',
    location: '',
    pricing: {
      pla_per_hour: 10,
      petg_per_hour: 12,
      setup_fee: 5,
      rush_multiplier: 1.5,
      min_order: 0,
    },
    services: [],
    strengths: [''],
    weaknesses: [''],
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    onAdd(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h3 className="font-bold text-white">Add Competitor</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Company Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#334155' }}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#334155' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Pricing</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">PLA/hour (€)</label>
                <input
                  type="number"
                  value={form.pricing.pla_per_hour}
                  onChange={(e) => setForm(prev => ({ 
                    ...prev, 
                    pricing: { ...prev.pricing, pla_per_hour: Number(e.target.value) }
                  }))}
                  min="0"
                  step="0.5"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Setup Fee (€)</label>
                <input
                  type="number"
                  value={form.pricing.setup_fee}
                  onChange={(e) => setForm(prev => ({ 
                    ...prev, 
                    pricing: { ...prev.pricing, setup_fee: Number(e.target.value) }
                  }))}
                  min="0"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-white text-sm"
              style={{ backgroundColor: '#334155' }}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              Add Competitor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * CompetitorDetailModal
 */
function CompetitorDetailModal({ competitor, priceHistory, onClose, onUpdate, onDelete, formatCurrency }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(competitor);

  const handleSave = () => {
    onUpdate(form);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div>
            <h3 className="font-bold text-white">{competitor.name}</h3>
            <p className="text-sm text-slate-500">{competitor.location}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setEditing(!editing)}
              className="px-3 py-1 rounded-lg text-sm text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {editing ? (
            <>
              {/* Edit Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">PLA/hour (€)</label>
                    <input
                      type="number"
                      value={form.pricing.pla_per_hour}
                      onChange={(e) => setForm(prev => ({ 
                        ...prev, 
                        pricing: { ...prev.pricing, pla_per_hour: Number(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 rounded-lg text-white"
                      style={{ backgroundColor: '#334155' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Setup Fee (€)</label>
                    <input
                      type="number"
                      value={form.pricing.setup_fee}
                      onChange={(e) => setForm(prev => ({ 
                        ...prev, 
                        pricing: { ...prev.pricing, setup_fee: Number(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 rounded-lg text-white"
                      style={{ backgroundColor: '#334155' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-white"
                    style={{ backgroundColor: '#334155' }}
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleSave}
                  className="w-full py-2 rounded-lg font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' }}
                >
                  Save Changes
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Pricing Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-500">PLA/hour</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(competitor.pricing.pla_per_hour)}</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-500">PETG/hour</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(competitor.pricing.petg_per_hour)}</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-500">Setup Fee</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(competitor.pricing.setup_fee)}</p>
                </div>
                <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
                  <p className="text-xs text-slate-500">Rush Mult.</p>
                  <p className="text-xl font-bold text-white">{competitor.pricing.rush_multiplier}x</p>
                </div>
              </div>

              {/* Services */}
              {competitor.services?.length > 0 && (
                <div>
                  <h4 className="font-medium text-white mb-2">Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {competitor.services.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-sm bg-slate-700 text-slate-300">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SWOT */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <h4 className="text-green-400 font-medium mb-2">Strengths</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    {competitor.strengths?.map((s, i) => (
                      <li key={i}>✓ {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <h4 className="text-red-400 font-medium mb-2">Weaknesses</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    {competitor.weaknesses?.map((w, i) => (
                      <li key={i}>✗ {w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Notes */}
              {competitor.notes && (
                <div>
                  <h4 className="font-medium text-white mb-2">Notes</h4>
                  <p className="text-slate-400 p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                    {competitor.notes}
                  </p>
                </div>
              )}

              {/* Delete */}
              <button
                onClick={onDelete}
                className="w-full py-2 rounded-lg text-red-400 border border-red-500/30 hover:bg-red-500/10"
              >
                Delete Competitor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompetitorMonitor;
