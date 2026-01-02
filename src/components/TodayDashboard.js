import React, { useState, useEffect } from 'react';
import { api, unwrap } from '../services/api';
import { useLanguage } from '../i18n';

/**
 * TodayDashboard - The home view showing today's priorities and quick actions
 * Displays real data or shows 0/- when no data is available
 */
function TodayDashboard({ currentUser, onNavigate }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    orders: [],
    printers: [],
    jobs: [],
    alerts: [],
    recentActivity: [],
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayTasks, setTodayTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadTodayTasks();
    
    // Update time every minute
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Helper to safely extract array from various response formats
  const extractArray = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.printers && Array.isArray(response.printers)) return response.printers;
    if (response.jobs && Array.isArray(response.jobs)) return response.jobs;
    if (response.orders && Array.isArray(response.orders)) return response.orders;
    if (typeof response === 'object') {
      const values = Object.values(response);
      if (values.length > 0 && Array.isArray(values[0])) return values[0];
    }
    return [];
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [ordersRes, printersRes, jobsRes, alertsRes] = await Promise.all([
        api.getOrders().catch(() => []),
        api.getPrinters().catch(() => []),
        api.getJobQueue().catch(() => []),
        api.getInventoryAlerts().catch(() => []),
      ]);

      const orders = extractArray(unwrap(ordersRes));
      const printers = extractArray(unwrap(printersRes));
      const jobs = extractArray(unwrap(jobsRes));
      const alerts = extractArray(unwrap(alertsRes));

      setData({ orders, printers, jobs, alerts, recentActivity: [] });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayTasks = () => {
    const saved = localStorage.getItem('polywerk_daily_tasks');
    if (saved) {
      try {
        const tasks = JSON.parse(saved);
        // Only load today's tasks
        const today = new Date().toDateString();
        const todaysTasks = tasks.filter(t => new Date(t.created_at).toDateString() === today);
        setTodayTasks(todaysTasks);
      } catch (e) {
        setTodayTasks([]);
      }
    }
  };

  const saveTasks = (tasks) => {
    localStorage.setItem('polywerk_daily_tasks', JSON.stringify(tasks));
    setTodayTasks(tasks);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    const task = {
      id: `task-${Date.now()}`,
      text: newTask.trim(),
      completed: false,
      created_at: new Date().toISOString(),
      user: currentUser?.username,
    };
    const allTasks = JSON.parse(localStorage.getItem('polywerk_daily_tasks') || '[]');
    saveTasks([task, ...allTasks]);
    setNewTask('');
    setShowTaskInput(false);
  };

  const toggleTask = (taskId) => {
    const allTasks = JSON.parse(localStorage.getItem('polywerk_daily_tasks') || '[]');
    const updated = allTasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);
  };

  const deleteTask = (taskId) => {
    const allTasks = JSON.parse(localStorage.getItem('polywerk_daily_tasks') || '[]');
    saveTasks(allTasks.filter(t => t.id !== taskId));
  };

  // Calculate stats - with safety checks
  const safeArray = (arr) => Array.isArray(arr) ? arr : [];
  
  const urgentOrders = safeArray(data.orders).filter(o => {
    if (o.status === 'completed' || o.status === 'cancelled' || o.status === 'delivered') return false;
    if (!o.due_date) return false;
    const due = new Date(o.due_date);
    const hoursUntilDue = (due - new Date()) / (1000 * 60 * 60);
    return hoursUntilDue <= 24 && hoursUntilDue > 0;
  });

  const overdueOrders = safeArray(data.orders).filter(o => {
    if (o.status === 'completed' || o.status === 'cancelled' || o.status === 'delivered') return false;
    if (!o.due_date) return false;
    return new Date(o.due_date) < new Date();
  });

  const pendingOrders = safeArray(data.orders).filter(o => 
    o.status === 'pending' || o.status === 'quoted' || o.status === 'confirmed'
  );

  const inProgressOrders = safeArray(data.orders).filter(o => 
    o.status === 'in_progress' || o.status === 'printing' || o.status === 'accepted' || o.status === 'queued'
  );

  const readyOrders = safeArray(data.orders).filter(o => 
    o.status === 'ready' || o.status === 'ready_for_pickup'
  );

  const activePrinters = safeArray(data.printers).filter(p => 
    p.status === 'printing' || p.state === 'printing'
  );

  const idlePrinters = safeArray(data.printers).filter(p => 
    p.status === 'idle' || p.status === 'ready' || p.state === 'idle' || p.state === 'ready'
  );

  const offlinePrinters = safeArray(data.printers).filter(p => 
    p.status === 'offline' || p.status === 'error' || p.state === 'offline' || p.state === 'error'
  );

  const activeJobs = safeArray(data.jobs).filter(j => j.status === 'printing');
  const queuedJobs = safeArray(data.jobs).filter(j => j.status === 'queued' || j.status === 'pending');

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('home.goodMorning') || 'Good morning';
    if (hour < 17) return t('home.goodAfternoon') || 'Good afternoon';
    return t('home.goodEvening') || 'Good evening';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  };

  const getTimeUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const hours = Math.round((new Date(dueDate) - new Date()) / (1000 * 60 * 60));
    if (hours < 0) return { text: `${Math.abs(hours)}h ${t('home.overdue') || 'overdue'}`, urgent: true };
    if (hours < 24) return { text: `${hours}h ${t('home.left') || 'left'}`, urgent: true };
    if (hours < 48) return { text: t('home.tomorrow') || 'Tomorrow', urgent: false };
    return { text: `${Math.round(hours / 24)}d ${t('home.left') || 'left'}`, urgent: false };
  };

  // Get user's first name for greeting
  const getUserFirstName = () => {
    if (currentUser?.full_name) {
      return currentUser.full_name.split(' ')[0];
    }
    return currentUser?.username || t('home.user') || 'User';
  };

  // Get shift info
  const getShiftInfo = () => {
    const hour = currentTime.getHours();
    if (hour >= 6 && hour < 14) return { name: 'Morning Shift', icon: '🌅' };
    if (hour >= 14 && hour < 22) return { name: 'Day Shift', icon: '☀️' };
    return { name: 'Night Shift', icon: '🌙' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalPrinters = safeArray(data.printers).length;
  const hasNoPrinters = totalPrinters === 0;
  const hasNoOrders = safeArray(data.orders).length === 0;
  const shiftInfo = getShiftInfo();
  const completedTasks = todayTasks.filter(t => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Header with Greeting */}
      <div className="rounded-xl p-6" style={{ 
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
        borderColor: 'rgba(168, 85, 247, 0.3)',
        border: '1px solid rgba(168, 85, 247, 0.3)'
      }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {getUserFirstName()}! 👋
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-slate-400">
                {formatDate(currentTime)} • {formatTime(currentTime)}
              </p>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                {shiftInfo.icon} {shiftInfo.name}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick Summary */}
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-lg bg-slate-800/50">
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{pendingOrders.length + inProgressOrders.length}</p>
                <p className="text-xs text-slate-500">{t('home.active') || 'Active'}</p>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div className="text-center">
                <p className="text-lg font-bold text-cyan-400">{activePrinters.length}/{totalPrinters || '-'}</p>
                <p className="text-xs text-slate-500">{t('home.printing') || 'Printing'}</p>
              </div>
            </div>
            
            <button
              onClick={loadDashboardData}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title={t('common.refresh') || 'Refresh'}
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Banner */}
      {(overdueOrders.length > 0 || safeArray(data.alerts).length > 0 || offlinePrinters.length > 0) && (
        <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div className="flex-1">
              <p className="font-medium text-red-400">{t('home.attentionRequired') || 'Attention Required'}</p>
              <ul className="text-sm text-red-400/80 mt-1 space-y-1">
                {overdueOrders.length > 0 && (
                  <li>• {overdueOrders.length} {t('home.overdueOrders') || 'overdue order'}{overdueOrders.length !== 1 ? 's' : ''}</li>
                )}
                {offlinePrinters.length > 0 && (
                  <li>• {offlinePrinters.length} {t('home.printersOffline') || 'printer'}{offlinePrinters.length !== 1 ? 's' : ''} offline</li>
                )}
                {safeArray(data.alerts).length > 0 && (
                  <li>• {safeArray(data.alerts).length} {t('home.lowStockAlerts') || 'low stock alert'}{safeArray(data.alerts).length !== 1 ? 's' : ''}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats - Compact Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatCard
          icon="📋"
          label={t('home.pending') || 'Pending'}
          value={pendingOrders.length}
          color="yellow"
          onClick={() => onNavigate?.('business')}
          compact
        />
        <StatCard
          icon="🏭"
          label={t('home.inProgress') || 'In Progress'}
          value={inProgressOrders.length}
          color="blue"
          onClick={() => onNavigate?.('business')}
          compact
        />
        <StatCard
          icon="✅"
          label={t('home.ready') || 'Ready'}
          value={readyOrders.length}
          color="green"
          onClick={() => onNavigate?.('business')}
          compact
        />
        <StatCard
          icon="🖨️"
          label={t('home.printing') || 'Printing'}
          value={hasNoPrinters ? '-' : activePrinters.length}
          subtext={totalPrinters > 0 ? `/${totalPrinters}` : null}
          color="purple"
          onClick={() => onNavigate?.('printers')}
          empty={hasNoPrinters}
          compact
        />
        <StatCard
          icon="⏳"
          label={t('home.queue') || 'Queue'}
          value={queuedJobs.length}
          color="cyan"
          onClick={() => onNavigate?.('production')}
          compact
        />
        <StatCard
          icon="💤"
          label={t('home.idle') || 'Idle'}
          value={hasNoPrinters ? '-' : idlePrinters.length}
          color="slate"
          onClick={() => onNavigate?.('printers')}
          empty={hasNoPrinters}
          compact
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Priority Content (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Urgent Orders */}
          {(urgentOrders.length > 0 || overdueOrders.length > 0) && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                🔥 {t('home.urgentOrders') || 'Urgent Orders'}
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                  {overdueOrders.length + urgentOrders.length}
                </span>
              </h3>
              <div className="space-y-2">
                {[...overdueOrders, ...urgentOrders].slice(0, 5).map(order => {
                  const timeInfo = getTimeUntilDue(order.due_date);
                  return (
                    <div 
                      key={order.order_id || order.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                      style={{ backgroundColor: '#0f172a' }}
                      onClick={() => onNavigate?.('business')}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${timeInfo?.urgent ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                        <div>
                          <p className="font-medium text-white">
                            {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
                          </p>
                          <p className="text-xs text-slate-400">{order.client_name || order.customer_name || t('common.unknown') || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${timeInfo?.urgent ? 'text-red-400' : 'text-yellow-400'}`}>
                          {timeInfo?.text || t('home.noDeadline') || 'No deadline'}
                        </p>
                        <p className="text-xs text-slate-500 capitalize">{order.status?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Prints */}
          {activeJobs.length > 0 && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  🖨️ {t('home.activePrints')}
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                    {activeJobs.length}
                  </span>
                </h3>
                <button
                  onClick={() => onNavigate?.('printers')}
                  className="text-sm text-purple-400 hover:text-purple-300 transition"
                >
                  {t('common.view')} →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeJobs.slice(0, 4).map(job => {
                  const progress = job.progress || 0;
                  const printer = safeArray(data.printers).find(p => p.printer_id === job.printer_id || p.id === job.printer_id);
                  // Get file name from path if needed
                  const fileName = job.file_name || job.name || (job.gcode_file ? job.gcode_file.split(/[\\/]/).pop() : null) || t('home.unknownJob');
                  return (
                    <div 
                      key={job.job_id || job.id}
                      className="p-3 rounded-lg cursor-pointer hover:bg-slate-700/50 transition"
                      style={{ backgroundColor: '#0f172a' }}
                      onClick={() => onNavigate?.('printers')}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-medium text-white truncate" title={fileName}>{fileName}</p>
                          <p className="text-xs text-slate-400">{printer?.name || t('home.unknownPrinter')}</p>
                        </div>
                        <span className="text-lg font-bold text-purple-400">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, #a855f7 0%, #06b6d4 100%)'
                          }}
                        />
                      </div>
                      {job.time_remaining && (
                        <p className="text-xs text-slate-500 mt-1">
                          ~{Math.round(job.time_remaining / 60)} min {t('home.remaining')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                📋 {t('home.pendingOrders') || 'Pending Orders'}
                <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                  {pendingOrders.length}
                </span>
              </h3>
              <div className="space-y-2">
                {pendingOrders.slice(0, 5).map(order => (
                  <div 
                    key={order.order_id || order.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                    style={{ backgroundColor: '#0f172a' }}
                    onClick={() => onNavigate?.('business')}
                  >
                    <div>
                      <p className="font-medium text-white">
                        {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
                      </p>
                      <p className="text-xs text-slate-400">{order.client_name || order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-400">
                        {formatCurrency(order.total_price || order.total || order.quote?.total)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {pendingOrders.length > 5 && (
                <button 
                  onClick={() => onNavigate?.('business')}
                  className="w-full mt-3 text-center text-sm text-purple-400 hover:underline"
                >
                  {t('home.viewAll') || 'View all'} {pendingOrders.length} →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions & Tools */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-lg font-semibold text-white mb-3">⚡ {t('home.quickActions')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton
                icon="➕"
                label={t('home.newOrder')}
                onClick={() => onNavigate?.('business', 'newOrder')}
                primary
              />
              <QuickActionButton
                icon="👤"
                label={t('home.newClient')}
                onClick={() => onNavigate?.('business', 'newClient')}
              />
              <QuickActionButton
                icon="🖨️"
                label={t('home.startPrint')}
                onClick={() => onNavigate?.('production', 'jobs')}
              />
              <QuickActionButton
                icon="⏱️"
                label={t('home.trackTime')}
                onClick={() => onNavigate?.('production', 'time')}
              />
            </div>
          </div>

          {/* Today's Tasks */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                ✓ {t('home.todayTasks') || "Today's Tasks"}
                {todayTasks.length > 0 && (
                  <span className="text-xs text-slate-400 font-normal">
                    {completedTasks}/{todayTasks.length}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowTaskInput(!showTaskInput)}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                + {t('common.add') || 'Add'}
              </button>
            </div>

            {showTaskInput && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                  placeholder={t('home.taskPlaceholder') || 'What needs to be done?'}
                  className="flex-1 px-3 py-2 rounded-lg text-white text-sm"
                  style={{ backgroundColor: '#334155' }}
                  autoFocus
                />
                <button
                  onClick={addTask}
                  className="px-3 py-2 rounded-lg text-white text-sm"
                  style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
                >
                  ✓
                </button>
              </div>
            )}

            {todayTasks.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">
                <p>📝</p>
                <p>{t('home.noTasks') || 'No tasks for today'}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todayTasks.map(task => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-2 p-2 rounded-lg group hover:bg-slate-700/50"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs border transition ${
                        task.completed 
                          ? 'bg-green-500/20 border-green-500 text-green-400' 
                          : 'border-slate-600 hover:border-purple-500'
                      }`}
                    >
                      {task.completed && '✓'}
                    </button>
                    <span className={`flex-1 text-sm ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                      {task.text}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Printer Status */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <h3 className="text-lg font-semibold text-white mb-3">🖨️ {t('nav.printers') || 'Printers'}</h3>
            {hasNoPrinters ? (
              <div className="text-center py-4 text-slate-400">
                <p className="text-2xl mb-2">🖨️</p>
                <p className="text-sm">{t('home.noPrintersConfigured') || 'No printers configured'}</p>
                <button 
                  onClick={() => onNavigate?.('printers')}
                  className="mt-2 text-sm text-purple-400 hover:underline"
                >
                  {t('home.addPrinter') || 'Add a printer'} →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {safeArray(data.printers).slice(0, 5).map(printer => {
                  const status = printer.status || printer.state || 'unknown';
                  const statusColors = {
                    printing: 'bg-green-500',
                    idle: 'bg-slate-500',
                    ready: 'bg-blue-500',
                    offline: 'bg-red-500',
                    error: 'bg-red-500',
                    paused: 'bg-yellow-500',
                  };
                  return (
                    <div 
                      key={printer.printer_id || printer.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                      onClick={() => onNavigate?.('printers')}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-slate-500'}`}></span>
                        <span className="text-sm text-white">{printer.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 capitalize">{status}</span>
                    </div>
                  );
                })}
                {safeArray(data.printers).length > 5 && (
                  <button 
                    onClick={() => onNavigate?.('printers')}
                    className="w-full text-center text-sm text-purple-400 hover:underline mt-2"
                  >
                    {t('home.viewAllPrinters') || 'View all printers'} →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ready for Pickup */}
          {readyOrders.length > 0 && (
            <div className="rounded-xl border p-4 bg-green-500/10 border-green-500/30">
              <h3 className="text-lg font-semibold text-green-400 mb-3">✅ {t('home.readyForPickup') || 'Ready for Pickup'}</h3>
              <div className="space-y-2">
                {readyOrders.slice(0, 3).map(order => (
                  <div 
                    key={order.order_id || order.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 cursor-pointer"
                    onClick={() => onNavigate?.('business')}
                  >
                    <div>
                      <p className="font-medium text-white text-sm">
                        {order.order_number || `#${(order.order_id || order.id || '').slice(-6)}`}
                      </p>
                      <p className="text-xs text-green-400/70">{order.client_name || order.customer_name}</p>
                    </div>
                    <span className="text-green-400">📦</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock Alerts */}
          {safeArray(data.alerts).length > 0 && (
            <div className="rounded-xl border p-4 bg-yellow-500/10 border-yellow-500/30">
              <h3 className="text-lg font-semibold text-yellow-400 mb-3">⚠️ {t('home.lowStock') || 'Low Stock'}</h3>
              <div className="space-y-2">
                {safeArray(data.alerts).slice(0, 3).map(alert => (
                  <div 
                    key={alert.alert_id || alert.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-yellow-500/10 cursor-pointer"
                    onClick={() => onNavigate?.('inventory')}
                  >
                    <div>
                      <p className="font-medium text-white text-sm">{alert.product_name || alert.name}</p>
                      <p className="text-xs text-yellow-400/70">{alert.current_stock || alert.quantity || 0} {t('home.left') || 'left'}</p>
                    </div>
                    <span className="text-yellow-400">📦</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty State - Only show if no orders AND no active jobs */}
      {hasNoOrders && activeJobs.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <span className="text-4xl mb-4 block">🎉</span>
          <h3 className="text-lg font-semibold text-white mb-2">{t('home.allCaughtUp') || 'All caught up!'}</h3>
          <p className="text-slate-400 mb-4">{t('home.noUrgentTasks') || 'No urgent tasks right now. Time to create new orders or start some prints!'}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => onNavigate?.('business', 'newOrder')}
              className="px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
            >
              ➕ {t('home.newOrder') || 'New Order'}
            </button>
            <button
              onClick={() => onNavigate?.('business')}
              className="px-4 py-2 rounded-lg font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10"
            >
              📋 {t('home.viewOrders') || 'View Orders'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, subtext, color, onClick, empty, compact }) {
  const colorClasses = {
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };

  return (
    <div 
      onClick={onClick}
      className={`rounded-xl border cursor-pointer hover:border-purple-500/50 transition ${compact ? 'p-3' : 'p-4'}`}
      style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={compact ? 'text-sm' : ''}>{icon}</span>
        <span className={`text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
      </div>
      <p className={`font-bold ${empty ? 'text-slate-600' : colorClasses[color] || 'text-white'} ${compact ? 'text-xl' : 'text-2xl'}`}>
        {empty ? '-' : value}
        {subtext && !empty && <span className={`font-normal text-slate-500 ${compact ? 'text-xs' : 'text-sm'}`}>{subtext}</span>}
      </p>
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg text-center transition ${
        primary 
          ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 hover:border-purple-500/50' 
          : 'border hover:border-purple-500/50 hover:bg-purple-500/10'
      }`}
      style={!primary ? { backgroundColor: '#0f172a', borderColor: '#334155' } : {}}
    >
      <span className="text-xl block mb-1">{icon}</span>
      <span className={`text-xs ${primary ? 'text-purple-300' : 'text-slate-400'}`}>{label}</span>
    </button>
  );
}

export default TodayDashboard;
