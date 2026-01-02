import React, { useState, useEffect, useMemo } from 'react';
import { api, unwrap } from '../services/api';

/**
 * LeadScoring - AI-powered lead prioritization
 * Score and rank inquiries by conversion likelihood
 */
function LeadScoring() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filterScore, setFilterScore] = useState('all'); // all, hot, warm, cold
  const [sortBy, setSortBy] = useState('score'); // score, date, value

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      // Try to load from API (quotes/inquiries)
      const res = await api.getQuotes?.() || Promise.resolve({ data: [] });
      const data = unwrap(res);
      const apiLeads = Array.isArray(data) ? data : (data?.quotes || []);
      
      setLeads(apiLeads.length > 0 ? apiLeads : getMockLeads());
    } catch (err) {
      console.error('Failed to load leads:', err);
      setLeads(getMockLeads());
    } finally {
      setLoading(false);
    }
  };

  const getMockLeads = () => [
    {
      id: 'lead-1',
      name: 'TechCorp Solutions',
      email: 'procurement@techcorp.ee',
      phone: '+372 5123 4567',
      company: 'TechCorp OÜ',
      source: 'website',
      inquiry: 'Need 500 custom enclosures for our IoT devices. Looking for a reliable partner for ongoing production.',
      estimated_value: 2500,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'new',
      attachments: 2,
      response_time: null,
      follow_ups: 0,
    },
    {
      id: 'lead-2',
      name: 'Design Agency',
      email: 'hello@designagency.ee',
      company: 'Creative Design OÜ',
      source: 'referral',
      inquiry: 'We have a client who needs architectural models. Can you do detailed miniatures?',
      estimated_value: 800,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'contacted',
      attachments: 0,
      response_time: 4,
      follow_ups: 1,
    },
    {
      id: 'lead-3',
      name: 'Hobby Maker',
      email: 'john@gmail.com',
      source: 'social',
      inquiry: 'How much for one small figurine?',
      estimated_value: 25,
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'new',
      attachments: 1,
      response_time: null,
      follow_ups: 0,
    },
    {
      id: 'lead-4',
      name: 'Industrial Parts Ltd',
      email: 'orders@industrialparts.ee',
      phone: '+372 5987 6543',
      company: 'Industrial Parts AS',
      source: 'google',
      inquiry: 'Urgent: Need replacement parts for machinery. 50 pieces, can you deliver by Friday? Material: ABS or PETG.',
      estimated_value: 1200,
      created_at: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'new',
      attachments: 3,
      response_time: null,
      follow_ups: 0,
    },
    {
      id: 'lead-5',
      name: 'Startup Founder',
      email: 'founder@newstartup.io',
      company: 'NewStartup',
      source: 'linkedin',
      inquiry: 'Exploring options for prototyping our product. Early stage, no budget confirmed yet.',
      estimated_value: 500,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'contacted',
      attachments: 0,
      response_time: 24,
      follow_ups: 2,
    },
    {
      id: 'lead-6',
      name: 'School Project',
      email: 'teacher@school.ee',
      source: 'email',
      inquiry: 'Can students visit your workshop? Maybe print something small for science fair?',
      estimated_value: 50,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'new',
      attachments: 0,
      response_time: null,
      follow_ups: 0,
    },
    {
      id: 'lead-7',
      name: 'Medical Device Co',
      email: 'rd@meddevice.ee',
      phone: '+372 5555 1234',
      company: 'MedDevice AS',
      source: 'referral',
      inquiry: 'Looking for biocompatible printing capabilities. Need prototypes for medical device housings. ISO certification required?',
      estimated_value: 5000,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'qualified',
      attachments: 5,
      response_time: 2,
      follow_ups: 1,
    },
  ];

  // Calculate lead scores
  const scoredLeads = useMemo(() => {
    return leads.map(lead => {
      let score = 50; // Base score
      const factors = [];

      // 1. Estimated Value Factor (+0-25)
      if (lead.estimated_value >= 2000) {
        score += 25;
        factors.push({ name: 'High value project', impact: '+25', positive: true });
      } else if (lead.estimated_value >= 500) {
        score += 15;
        factors.push({ name: 'Medium value project', impact: '+15', positive: true });
      } else if (lead.estimated_value >= 100) {
        score += 5;
        factors.push({ name: 'Small project', impact: '+5', positive: true });
      } else {
        score -= 10;
        factors.push({ name: 'Very low value', impact: '-10', positive: false });
      }

      // 2. Source Quality (+0-15)
      const sourceScores = {
        referral: 15,
        google: 10,
        linkedin: 8,
        website: 8,
        email: 5,
        social: 3,
      };
      const sourceScore = sourceScores[lead.source] || 5;
      score += sourceScore;
      if (sourceScore >= 10) {
        factors.push({ name: `Quality source (${lead.source})`, impact: `+${sourceScore}`, positive: true });
      }

      // 3. Business vs Personal (+0-10)
      if (lead.company && lead.company.includes('OÜ') || lead.company?.includes('AS')) {
        score += 10;
        factors.push({ name: 'Registered company', impact: '+10', positive: true });
      } else if (lead.company) {
        score += 5;
        factors.push({ name: 'Has company name', impact: '+5', positive: true });
      }

      // 4. Contact Completeness (+0-10)
      if (lead.phone && lead.email) {
        score += 10;
        factors.push({ name: 'Full contact info', impact: '+10', positive: true });
      } else if (lead.phone || lead.email) {
        score += 5;
      }

      // 5. Inquiry Quality (+0-15)
      const inquiry = lead.inquiry?.toLowerCase() || '';
      if (inquiry.includes('urgent') || inquiry.includes('asap') || inquiry.includes('deadline')) {
        score += 10;
        factors.push({ name: 'Urgent need', impact: '+10', positive: true });
      }
      if (inquiry.includes('ongoing') || inquiry.includes('regular') || inquiry.includes('partner')) {
        score += 15;
        factors.push({ name: 'Ongoing potential', impact: '+15', positive: true });
      }
      if (inquiry.length > 100) {
        score += 5;
        factors.push({ name: 'Detailed inquiry', impact: '+5', positive: true });
      }
      if (inquiry.length < 30) {
        score -= 10;
        factors.push({ name: 'Vague inquiry', impact: '-10', positive: false });
      }

      // 6. Attachments (+0-10)
      if (lead.attachments >= 3) {
        score += 10;
        factors.push({ name: 'Multiple attachments', impact: '+10', positive: true });
      } else if (lead.attachments >= 1) {
        score += 5;
        factors.push({ name: 'Has attachments', impact: '+5', positive: true });
      }

      // 7. Recency (+0-10)
      const daysSinceCreated = (Date.now() - new Date(lead.created_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceCreated < 1) {
        score += 10;
        factors.push({ name: 'New lead', impact: '+10', positive: true });
      } else if (daysSinceCreated < 3) {
        score += 5;
      } else if (daysSinceCreated > 7) {
        score -= 5;
        factors.push({ name: 'Aging lead', impact: '-5', positive: false });
      }

      // 8. Engagement (-10-0)
      if (lead.status === 'new' && daysSinceCreated > 2) {
        score -= 5;
        factors.push({ name: 'No response yet', impact: '-5', positive: false });
      }
      if (lead.follow_ups >= 3 && lead.status !== 'qualified') {
        score -= 10;
        factors.push({ name: 'Multiple follow-ups, no progress', impact: '-10', positive: false });
      }

      // Normalize score
      score = Math.max(0, Math.min(100, score));

      // Determine category
      let category = 'cold';
      if (score >= 70) category = 'hot';
      else if (score >= 50) category = 'warm';

      // Recommended action
      let action = 'Monitor';
      if (category === 'hot' && lead.status === 'new') {
        action = 'Call immediately';
      } else if (category === 'hot') {
        action = 'Send proposal';
      } else if (category === 'warm' && lead.status === 'new') {
        action = 'Email within 24h';
      } else if (category === 'warm') {
        action = 'Schedule follow-up';
      } else {
        action = 'Add to nurture campaign';
      }

      return {
        ...lead,
        score,
        category,
        factors,
        action,
        daysSinceCreated: Math.round(daysSinceCreated * 10) / 10,
      };
    });
  }, [leads]);

  // Filter and sort
  const filteredLeads = useMemo(() => {
    let filtered = scoredLeads;
    
    if (filterScore !== 'all') {
      filtered = filtered.filter(l => l.category === filterScore);
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'date') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'value') return b.estimated_value - a.estimated_value;
      return 0;
    });
  }, [scoredLeads, filterScore, sortBy]);

  // Summary
  const summary = useMemo(() => {
    const hot = scoredLeads.filter(l => l.category === 'hot');
    const warm = scoredLeads.filter(l => l.category === 'warm');
    const cold = scoredLeads.filter(l => l.category === 'cold');
    const newLeads = scoredLeads.filter(l => l.status === 'new');
    
    return {
      total: scoredLeads.length,
      hot: hot.length,
      warm: warm.length,
      cold: cold.length,
      newLeads: newLeads.length,
      totalPipelineValue: scoredLeads.reduce((s, l) => s + l.estimated_value, 0),
      hotValue: hot.reduce((s, l) => s + l.estimated_value, 0),
      avgScore: Math.round(scoredLeads.reduce((s, l) => s + l.score, 0) / scoredLeads.length),
    };
  }, [scoredLeads]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getCategoryBadge = (category) => {
    const styles = {
      hot: 'bg-red-500/20 text-red-400 border-red-500/30',
      warm: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      cold: 'bg-slate-600 text-slate-400 border-slate-500/30',
    };
    return styles[category];
  };

  const getSourceIcon = (source) => {
    const icons = {
      website: '🌐',
      google: '🔍',
      referral: '👥',
      linkedin: '💼',
      email: '📧',
      social: '📱',
    };
    return icons[source] || '📋';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🎯 Lead Scoring
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            AI-ranked leads by conversion probability
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: '#334155' }}
          >
            <option value="score">Sort by Score</option>
            <option value="date">Sort by Date</option>
            <option value="value">Sort by Value</option>
          </select>
          <button
            onClick={loadLeads}
            className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          className="rounded-xl border p-4 cursor-pointer hover:border-red-500/50 transition"
          style={{ backgroundColor: '#1e293b', borderColor: filterScore === 'hot' ? '#ef4444' : '#334155' }}
          onClick={() => setFilterScore(filterScore === 'hot' ? 'all' : 'hot')}
        >
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">🔥 Hot Leads</p>
            <span className="text-red-400 font-bold text-xl">{summary.hot}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{formatCurrency(summary.hotValue)} potential</p>
        </div>

        <div 
          className="rounded-xl border p-4 cursor-pointer hover:border-yellow-500/50 transition"
          style={{ backgroundColor: '#1e293b', borderColor: filterScore === 'warm' ? '#eab308' : '#334155' }}
          onClick={() => setFilterScore(filterScore === 'warm' ? 'all' : 'warm')}
        >
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">☀️ Warm</p>
            <span className="text-yellow-400 font-bold text-xl">{summary.warm}</span>
          </div>
        </div>

        <div 
          className="rounded-xl border p-4 cursor-pointer hover:border-slate-500/50 transition"
          style={{ backgroundColor: '#1e293b', borderColor: filterScore === 'cold' ? '#64748b' : '#334155' }}
          onClick={() => setFilterScore(filterScore === 'cold' ? 'all' : 'cold')}
        >
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">❄️ Cold</p>
            <span className="text-slate-400 font-bold text-xl">{summary.cold}</span>
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <p className="text-slate-400 text-sm">💰 Pipeline</p>
          <p className="text-cyan-400 font-bold text-xl">{formatCurrency(summary.totalPipelineValue)}</p>
        </div>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.map(lead => (
          <div
            key={lead.id}
            onClick={() => setSelectedLead(lead)}
            className="rounded-xl border p-4 cursor-pointer hover:border-purple-500/50 transition"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Lead Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${getScoreColor(lead.score)}`} style={{ backgroundColor: '#334155' }}>
                    {lead.score}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{lead.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs border ${getCategoryBadge(lead.category)}`}>
                        {lead.category.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {getSourceIcon(lead.source)} {lead.source} • {lead.company || 'Individual'} • {formatCurrency(lead.estimated_value)}
                    </p>
                  </div>
                </div>
                
                <p className="text-sm text-slate-400 line-clamp-2">
                  "{lead.inquiry}"
                </p>
              </div>

              {/* Action */}
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-500">{lead.daysSinceCreated}d ago</p>
                  {lead.attachments > 0 && (
                    <p className="text-xs text-slate-500">📎 {lead.attachments} files</p>
                  )}
                </div>
                <button 
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    lead.category === 'hot' 
                      ? 'bg-red-500 text-white' 
                      : lead.category === 'warm'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-slate-700 text-slate-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle action
                  }}
                >
                  {lead.action}
                </button>
              </div>
            </div>

            {/* Scoring Factors Preview */}
            {lead.category === 'hot' && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: '#334155' }}>
                {lead.factors.filter(f => f.positive).slice(0, 3).map((factor, i) => (
                  <span key={i} className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400">
                    ✓ {factor.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

/**
 * LeadDetailModal - Detailed scoring breakdown
 */
function LeadDetailModal({ lead, onClose, formatCurrency }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between z-10" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="font-bold text-white">{lead.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Display */}
          <div className="text-center">
            <div className={`text-6xl font-bold ${
              lead.score >= 70 ? 'text-green-400' : lead.score >= 50 ? 'text-yellow-400' : 'text-slate-400'
            }`}>
              {lead.score}
            </div>
            <p className="text-slate-500 mt-1">Lead Score</p>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-white text-sm">{lead.email}</p>
            </div>
            {lead.phone && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-white text-sm">{lead.phone}</p>
              </div>
            )}
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <p className="text-xs text-slate-500">Est. Value</p>
              <p className="text-cyan-400 font-medium">{formatCurrency(lead.estimated_value)}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <p className="text-xs text-slate-500">Source</p>
              <p className="text-white text-sm capitalize">{lead.source}</p>
            </div>
          </div>

          {/* Inquiry */}
          <div>
            <p className="text-sm text-slate-500 mb-2">Inquiry</p>
            <p className="text-slate-300 p-3 rounded-lg" style={{ backgroundColor: '#334155' }}>
              "{lead.inquiry}"
            </p>
          </div>

          {/* Scoring Factors */}
          <div>
            <p className="text-sm text-slate-500 mb-2">Scoring Factors</p>
            <div className="space-y-2">
              {lead.factors.map((factor, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    factor.positive ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <span className={factor.positive ? 'text-green-400' : 'text-red-400'}>
                    {factor.positive ? '✓' : '✗'} {factor.name}
                  </span>
                  <span className={`font-mono text-sm ${factor.positive ? 'text-green-400' : 'text-red-400'}`}>
                    {factor.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-medium">
              📞 Call Now
            </button>
            <button className="flex-1 py-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              📧 Send Email
            </button>
            <button className="flex-1 py-2.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              💰 Create Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeadScoring;
