import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import LoginPage from './components/LoginPage';
import ConfigTab from './components/ConfigTab';
import { api, setAuthToken } from './services/api';
import { LanguageProvider, LanguageSelector, useLanguage } from './i18n';
import { safeJsonParse } from './utils/safeJson';

// Permissions System
import { 
  PermissionsProvider, 
  usePermissions, 
  PermissionGate,
  OwnerOnly,
  AdminOnly 
} from './permissions';
import { 
  UserProfile as PermissionsUserProfile,
  RoleManager,
  UserPermissions,
  PermissionAuditLog 
} from './permissions';

// Business
import BusinessOverview from './components/BusinessOverview';
import QuoteCalculator from './components/QuoteCalculator';
import OrderManagement from './components/OrderManagement';
import InvoiceManagement from './components/InvoiceManagement';
import ClientList from './components/ClientList';
import ClientOrderHistory from './components/ClientOrderHistory';
import PaymentTracker from './components/PaymentTracker';
import OrderPipeline from './components/OrderPipeline';
import QuickPOS from './components/QuickPOS';
import TodayDashboard from './components/TodayDashboard';
import QCChecklist, { QCButton } from './components/QCChecklist';
import CustomerNotifications, { NotifyButton } from './components/CustomerNotifications';
import OrderTrackingPage from './components/OrderTrackingPage';
import TimeTracker from './components/TimeTracker';
import ShiftNotes from './components/ShiftNotes';
import NotificationCenter, { NotificationBell, useNotificationCount } from './components/NotificationCenter';

// Printers
import PrinterDashboard from './components/PrinterDashboard';
import PrinterTools from './components/PrinterTools';

// Production  
import JobQueue from './components/JobQueue';
import PrintHistory from './components/PrintHistory';
import PrintFailureLog from './components/PrintFailureLog';
import MaintenanceCalendar from './components/MaintenanceCalendar';
import MLPredictiveInsights from './components/MLPredictiveInsights';
import MLAnomalies from './components/MLAnomalies';

// Files
import STLSlicer from './components/STLSlicer';
import FileLibrary from './components/FileLibrary';
import InstantSTLQuote from './components/InstantSTLQuote';
import ModelQualityAnalyzer from './components/ModelQualityAnalyzer';
import SmartPrintScheduler from './components/SmartPrintScheduler';
import QuoteAnalytics from './components/QuoteAnalytics';
import EmailSettings from './components/EmailSettings';

// Inventory
import MaterialInventory from './components/MaterialInventory';
import MaterialProfiles from './components/MaterialProfiles';
import InventoryDashboard from './components/InventoryDashboard';
import SpoolManager from './components/SpoolManager';
import ConsumablesInventory from './components/ConsumablesInventory';
import ProductsInventory from './components/ProductsInventory';

// Reports
import CostDashboard from './components/CostDashboard';
import PrinterUtilization from './components/PrinterUtilization';
import ReportsGenerator from './components/ReportsGenerator';
import EnergySavings from './components/EnergySavings';
import FinancialReports from './components/FinancialReports';
import JobProfitability from './components/JobProfitability';
import ClientProfitability from './components/ClientProfitability';

// QR Manager
import SpoolQRManager from './components/SpoolQRManager';

// Calendar
import UnifiedCalendar from './components/UnifiedCalendar';
import CapacityTimeline from './components/CapacityTimeline';
import GoogleCalendarSync from './components/GoogleCalendarSync';

// Cameras
import PrinterCameraGrid from './components/BambuCameraView';

// Business - e-Invoice
import EstonianEInvoice from './components/EstonianEInvoice';

// AI Business Intelligence
import AIBusinessDashboard from './components/AIBusinessDashboard';
import CustomerInsights from './components/CustomerInsights';
import DemandForecasting from './components/DemandForecasting';
import LeadScoring from './components/LeadScoring';
import DynamicPricing from './components/DynamicPricing';
import CompetitorMonitor from './components/CompetitorMonitor';
import AIQuoteGenerator from './components/AIQuoteGenerator';
import { AIFeedbackProvider, AIFeedbackPanel } from './components/AIFeedbackSystem';
import SmartEmailAssistant from './components/SmartEmailAssistant';
import PrintCostCalculatorV2 from './components/PrintCostCalculatorV2';
import AutoMaterialReorder from './components/AutoMaterialReorder';
import AIPhotoToListing from './components/AIPhotoToListing';

// Marketing
import MarketingAutomation from './components/MarketingAutomation';

// AI - Owner only
import AIDashboard from './components/AIDashboard';
import DatasetsDashboard from './components/DatasetsDashboard';
import ImageTo3DGenerator from './components/ImageTo3DGenerator';
import FeedbackReviewQueue from './components/FeedbackReviewQueue';

// System (for Config)
import SystemStats from './components/SystemStats';
import DataManagement from './components/DataManagement';

// Team Chat
import TeamChat from './components/TeamChat';

// Feedback Reporter
import FeedbackReporter from './components/FeedbackReporter';

// User Profile
import UserProfile from './components/UserProfile';

// User Invitations
import InvitationList from './components/InvitationList';
import TeamManagement from './components/TeamManagement';
import AcceptInvitation from './components/AcceptInvitation';
import InviteUserModal from './components/InviteUserModal';

import './App.css';

const logo = process.env.PUBLIC_URL + '/Polywerk_newlogo_color.png';

// Role-based access:
// - owner: Full access to everything (business owner)
// - partner: Business partner - can manage team, NO AI tab
// - print_manager: Manages print operations, scheduling, QC
// - modeler: 3D modeling, file preparation, slicing
// - technician: Printer operation, maintenance
// - sales: Customer service, orders, quotes
const ROLE_PERMISSIONS = {
  owner: {
    home: true,
    business: true,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: true,
    ai: true,
    marketing: true,
    config: true,
    manageUsers: true,
  },
  partner: {
    home: true,
    business: true,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: true,
    ai: false,
    marketing: true,
    config: true,
    manageUsers: true,
  },
  print_manager: {
    home: true,
    business: true,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: true,
    ai: false,
    marketing: false,
    config: true,
    manageUsers: false,
  },
  modeler: {
    home: true,
    business: true,
    printers: false,
    production: false,
    calendar: true,
    files: true,
    inventory: false,
    reports: false,
    ai: false,
    marketing: false,
    config: false,
    manageUsers: false,
  },
  technician: {
    home: true,
    business: false,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: false,
    ai: false,
    marketing: false,
    config: false,
    manageUsers: false,
  },
  sales: {
    home: true,
    business: true,
    printers: false,
    production: false,
    calendar: true,
    files: false,
    inventory: true,
    reports: true,
    ai: false,
    marketing: true,
    config: false,
    manageUsers: false,
  },
  // Legacy support
  worker: {
    home: true,
    business: true,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: true,
    ai: false,
    marketing: false,
    config: false,
    manageUsers: false,
  },
  manager: {
    home: true,
    business: true,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: true,
    ai: false,
    marketing: false,
    config: true,
    manageUsers: false,
  },
  operator: {
    home: true,
    business: true,
    printers: true,
    production: true,
    calendar: true,
    files: true,
    inventory: true,
    reports: false,
    ai: false,
    marketing: false,
    config: false,
    manageUsers: false,
  },
};

function AppContent() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCount = useNotificationCount();

  useEffect(() => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const userData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');

    if (token && userData) {
      setAuthToken(token);

      api.validateToken(token)
        .then(response => {
          const valid = response?.data?.valid ?? response?.valid ?? false;
          if (valid) {
            const parsedUser = safeJsonParse(userData, null);
            if (!parsedUser) {
              sessionStorage.clear();
              localStorage.removeItem('authToken');
              localStorage.removeItem('currentUser');
              setAuthToken(null);
              return;
            }
            setCurrentUser(parsedUser);
          } else {
            sessionStorage.clear();
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            setAuthToken(null);
          }
        })
        .catch(() => {
          sessionStorage.clear();
          localStorage.removeItem('authToken');
          localStorage.removeItem('currentUser');
          setAuthToken(null);
        })
        .finally(() => {
          setAuthLoading(false);
        });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const handleLogin = (sessionData) => {
    const userData = {
      user_id: sessionData.user_id,
      username: sessionData.username,
      full_name: sessionData.full_name,
      role: sessionData.role || 'worker',
      token: sessionData.token
    };
    setCurrentUser(userData);
    const userDisplay = {
      user_id: sessionData.user_id,
      username: sessionData.username,
      full_name: sessionData.full_name,
      role: sessionData.role || 'worker'
    };
    sessionStorage.setItem('currentUser', JSON.stringify(userDisplay));
    localStorage.setItem('currentUser', JSON.stringify(userDisplay));
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    if (token) {
      try {
        await api.logout(token);
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setActiveTab('home');
  };

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(prev => ({ ...prev, ...updatedUser }));
    const updated = { ...currentUser, ...updatedUser };
    sessionStorage.setItem('currentUser', JSON.stringify(updated));
    localStorage.setItem('currentUser', JSON.stringify(updated));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0a0a0b' }}>
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-zinc-500 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Get permissions for current user's role (legacy system - kept for backward compatibility)
  const userRole = currentUser.role?.toLowerCase() || 'worker';
  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.worker;

  // Wrap authenticated content with PermissionsProvider
  return (
    <PermissionsProvider user={currentUser}>
      <AuthenticatedAppContent 
        currentUser={currentUser}
        permissions={permissions}
        handleLogout={handleLogout}
        handleUserUpdate={handleUserUpdate}
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        showInviteModal={showInviteModal}
        setShowInviteModal={setShowInviteModal}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        notificationCount={notificationCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </PermissionsProvider>
  );
}

// Authenticated app content - wrapped with PermissionsProvider
function AuthenticatedAppContent({ 
  currentUser, 
  permissions, 
  handleLogout, 
  handleUserUpdate,
  showProfileModal,
  setShowProfileModal,
  showUserMenu,
  setShowUserMenu,
  showInviteModal,
  setShowInviteModal,
  showNotifications,
  setShowNotifications,
  notificationCount,
  activeTab,
  setActiveTab
}) {
  const { t } = useLanguage();
  const { can, isOwner, isAdmin } = usePermissions();

  const tabIcons = {
    'home': '🏠',
    'business': '💼',
    'printers': '🖨️',
    'production': '🏭',
    'calendar': '📅',
    'files': '📁',
    'inventory': '📦',
    'reports': '📊',
    'ai': '🤖',
    'marketing': '📱',
    'config': '⚙️'
  };

  // Tabs now use translation keys
  const tabs = [
    { id: 'home', nameKey: 'nav.home' },
    { id: 'business', nameKey: 'nav.business' },
    { id: 'printers', nameKey: 'nav.printers' },
    { id: 'production', nameKey: 'nav.production' },
    { id: 'calendar', nameKey: 'nav.calendar' },
    { id: 'files', nameKey: 'nav.files' },
    { id: 'inventory', nameKey: 'nav.inventory' },
    { id: 'reports', nameKey: 'nav.reports' },
    { id: 'ai', nameKey: 'nav.ai' },
    { id: 'marketing', nameKey: 'nav.marketing' },
    { id: 'config', nameKey: 'nav.config' }
  ];

  // Filter tabs based on role permissions
  const visibleTabs = tabs.filter(tab => permissions[tab.id]);

  // Get translated role name
  const getRoleDisplayName = (role) => {
    return t(`role.${role}`) || role?.charAt(0).toUpperCase() + role?.slice(1);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0a0b' }}>
      {/* Header with gradient accent */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo with subtle glow */}
            <div className="logo-container">
              <img src={logo} alt="Polywerk" className="h-12 w-auto relative z-10" />
            </div>

            <div className="flex items-center gap-3">
              <LanguageSelector className="btn-ghost" />
              
              {/* Notification Bell */}
              <NotificationBell 
                currentUser={currentUser}
                onClick={() => setShowNotifications(true)}
                count={notificationCount}
              />
              
              {/* User Menu Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="user-badge cursor-pointer hover:opacity-80 transition"
                >
                  <div className="user-avatar">
                    {currentUser.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-sm font-medium text-zinc-100">{currentUser.full_name || currentUser.username}</div>
                  </div>
                  <svg className="w-4 h-4 ml-1 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div 
                      className="absolute right-0 mt-2 w-56 rounded-xl shadow-xl border z-50 overflow-hidden"
                      style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                    >
                      {/* User Info Header */}
                      <div className="px-4 py-3 border-b" style={{ borderColor: '#334155' }}>
                        <p className="text-sm font-medium text-white">{currentUser.full_name || currentUser.username}</p>
                        <p className="text-xs text-slate-400">@{currentUser.username}</p>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowProfileModal(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3"
                        >
                          <span>👤</span>
                          {t('user.profile')}
                        </button>
                        
                        {permissions.manageUsers && (
                          <>
                            <button
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowInviteModal(true);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3"
                            >
                              <span>✉️</span>
                              {t('user.inviteTeam')}
                            </button>
                          </>
                        )}
                        
                        {permissions.config && (
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setActiveTab('config');
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3"
                          >
                            <span>⚙️</span>
                            {t('user.settings')}
                          </button>
                        )}
                      </div>

                      {/* Logout */}
                      <div className="border-t py-1" style={{ borderColor: '#334155' }}>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            handleLogout();
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3"
                        >
                          <span>🚪</span>
                          {t('user.logout')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="sticky top-0 z-10" style={{ backgroundColor: '#0a0a0b', borderBottom: '1px solid #27272a' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="mr-2 opacity-70">{tabIcons[tab.id]}</span>
                {t(tab.nameKey)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Content with gradient border */}
      <div className="tab-content-wrapper">
        <div className="tab-content-inner">
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
            
            {/* HOME TAB */}
            {activeTab === 'home' && (
              <TodayDashboard 
                currentUser={currentUser} 
                onNavigate={(tab, action) => {
                  if (tab === 'pos') {
                    setActiveTab('business');
                    setTimeout(() => window.dispatchEvent(new CustomEvent('setBusinessSubTab', { detail: 'pos' })), 50);
                  } else if (tab === 'business' && action === 'newOrder') {
                    // Navigate to quotes tab where QuoteCalculator is
                    setActiveTab('business');
                    setTimeout(() => window.dispatchEvent(new CustomEvent('setBusinessSubTab', { detail: 'quotes' })), 50);
                  } else if (tab === 'business' && action === 'newClient') {
                    setActiveTab('business');
                    // First switch to clients tab, then open modal
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('setBusinessSubTab', { detail: 'clients' }));
                      // Trigger new client modal after tab switch
                      setTimeout(() => window.dispatchEvent(new CustomEvent('openNewClient')), 100);
                    }, 50);
                  } else if (tab === 'production' && action) {
                    // Handle production sub-tab navigation (jobs, time, etc.)
                    setActiveTab('production');
                    setTimeout(() => window.dispatchEvent(new CustomEvent('setProductionSubTab', { detail: action })), 50);
                  } else {
                    setActiveTab(tab);
                  }
                }}
              />
            )}

            {/* BUSINESS TAB */}
            {activeTab === 'business' && (
              <BusinessTabContent currentUser={currentUser} />
            )}

            {/* PRINTERS TAB */}
            {activeTab === 'printers' && (
              <PrintersTabContent />
            )}

            {/* PRODUCTION TAB */}
            {activeTab === 'production' && (
              <ProductionTabContent currentUser={currentUser} />
            )}

            {/* CALENDAR TAB */}
            {activeTab === 'calendar' && (
              <CalendarTabContent currentUser={currentUser} />
            )}

            {/* FILES TAB */}
            {activeTab === 'files' && (
              <FilesTabContent />
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <InventoryTabContent />
            )}

            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              <ReportsTabContent />
            )}

            {/* AI TAB - Owner only */}
            {activeTab === 'ai' && permissions.ai && (
              <div className="space-y-6">
                <AITabContent />
              </div>
            )}

            {/* MARKETING TAB */}
            {activeTab === 'marketing' && (
              <MarketingAutomation />
            )}

            {/* CONFIG TAB - Now includes System Stats and User Profile */}
            {activeTab === 'config' && (
              <ConfigTabContent currentUser={currentUser} onUserUpdate={handleUserUpdate} />
            )}

          </main>
        </div>
      </div>

      {/* Team Chat */}
      <TeamChat currentUser={currentUser} />

      {/* Feedback Reporter */}
      <FeedbackReporter currentUser={currentUser} />

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowProfileModal(false)}
          />
          
          {/* Modal Content */}
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Profile Component */}
            <div className="p-6">
              <UserProfile 
                currentUser={currentUser} 
                onUserUpdate={(user) => {
                  handleUserUpdate(user);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        currentUser={currentUser}
      />

      {/* Notification Center */}
      <NotificationCenter
        currentUser={currentUser}
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Footer with gradient accent */}
      <footer className="app-footer mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p className="footer-text">
            {t('footer.company')} • {t('footer.location')} • {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

// AI Tab with sub-navigation - Business Intelligence + ML Tools
// EXPERIMENTAL: Read-only analysis, does not modify real data
function AITabContent() {
  const { t } = useLanguage();
  const [aiSubTab, setAiSubTab] = useState('command');

  // Business Intelligence sub-tabs
  const businessTabs = [
    { id: 'command', nameKey: 'nav.command', icon: '🎯' },
    { id: 'insights', nameKey: 'nav.customerInsights', icon: '🧠' },
    { id: 'demand', nameKey: 'nav.demand', icon: '📈' },
    { id: 'leads', nameKey: 'nav.leads', icon: '🎯' },
    { id: 'pricing', nameKey: 'nav.pricing', icon: '💰' },
    { id: 'competitors', nameKey: 'nav.competitors', icon: '🔍' },
  ];

  // ML/Training sub-tabs
  const mlTabs = [
    { id: 'generator', nameKey: 'nav.generator', icon: '🎨' },
    { id: 'dashboard', nameKey: 'nav.mlDashboard', icon: '⚙️' },
    { id: 'datasets', nameKey: 'nav.datasets', icon: '📊' },
    { id: 'feedback', nameKey: 'nav.feedback', icon: '🎓' },
  ];

  const handleNavigate = (tabId) => {
    setAiSubTab(tabId);
  };

  return (
    <AIFeedbackProvider>
      {/* Experimental Header */}
      <div className="mb-6 p-4 rounded-xl border bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div>
              <h2 className="text-white font-bold">{t('ai.labTitle')}</h2>
              <p className="text-slate-400 text-sm">
                {t('ai.labDescription')}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            {t('ai.beta')}
          </span>
        </div>
      </div>

      {/* Business Intelligence Section */}
      <div className="mb-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">📊 {t('ai.businessIntelligence')}</p>
        <div className="sub-nav mb-4">
          {businessTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAiSubTab(tab.id)}
              className={`sub-nav-tab ${aiSubTab === tab.id ? 'active' : ''}`}
            >
              <span className="mr-2 opacity-70">{tab.icon}</span>
              {t(tab.nameKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ML Tools Section */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">🤖 {t('ai.mlTraining')}</p>
        <div className="sub-nav mb-4">
          {mlTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAiSubTab(tab.id)}
              className={`sub-nav-tab ${aiSubTab === tab.id ? 'active' : ''}`}
            >
              <span className="mr-2 opacity-70">{tab.icon}</span>
              {t(tab.nameKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {aiSubTab === 'command' && <AIBusinessDashboard onNavigate={handleNavigate} />}
      {aiSubTab === 'insights' && <CustomerInsights />}
      {aiSubTab === 'demand' && <DemandForecasting />}
      {aiSubTab === 'leads' && <LeadScoring />}
      {aiSubTab === 'pricing' && <DynamicPricing />}
      {aiSubTab === 'competitors' && <CompetitorMonitor />}
      {aiSubTab === 'generator' && <ImageTo3DGenerator />}
      {aiSubTab === 'dashboard' && <AIDashboard />}
      {aiSubTab === 'datasets' && <DatasetsDashboard />}
      {aiSubTab === 'feedback' && <AIFeedbackPanel />}
    </AIFeedbackProvider>
  );
}

// Printers Tab with sub-navigation
function PrintersTabContent() {
  const { t } = useLanguage();
  const [printersSubTab, setPrintersSubTab] = useState('dashboard');
  const [printers, setPrinters] = useState([]);

  // Load printers for tools
  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const data = await api.getPrinters();
        // Normalize printer data
        const printerList = data?.printers || data?.data?.printers || [];
        setPrinters(printerList.map(p => ({
          name: p.name,
          state: p.state || p.status || 'unknown',
          connected: p.connected ?? p.is_online ?? false,
          nozzle_temp: p.nozzle_temp ?? p.temperatures?.nozzle?.actual ?? 0,
          bed_temp: p.bed_temp ?? p.temperatures?.bed?.actual ?? 0,
          job: p.job || {},
        })));
      } catch (err) {
        console.error('Failed to load printers:', err);
      }
    };
    loadPrinters();
    const interval = setInterval(loadPrinters, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const subTabs = [
    { id: 'dashboard', nameKey: 'nav.dashboard', icon: '🖨️' },
    { id: 'tools', label: 'Tools', icon: '🔧' },
    { id: 'cameras', nameKey: 'nav.cameras', icon: '📷' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPrintersSubTab(tab.id)}
            className={`sub-nav-tab ${printersSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {tab.nameKey ? t(tab.nameKey) : tab.label}
          </button>
        ))}
      </div>
      
      {printersSubTab === 'dashboard' && <PrinterDashboard />}
      {printersSubTab === 'tools' && <PrinterTools printers={printers} />}
      {printersSubTab === 'cameras' && <PrinterCameraGrid />}
    </>
  );
}

// Calendar Tab with sub-navigation
function CalendarTabContent({ currentUser }) {
  const { t } = useLanguage();
  const [calendarSubTab, setCalendarSubTab] = useState('calendar');
  const [importedEvents, setImportedEvents] = useState([]);

  const subTabs = [
    { id: 'calendar', nameKey: 'nav.calendar', icon: '📅' },
    { id: 'capacity', nameKey: 'nav.capacity', icon: '📈' },
    { id: 'google', nameKey: 'nav.google', icon: '🔄' },
  ];

  const handleEventsImport = (events) => {
    setImportedEvents(events);
    // Switch to calendar view to show imported events
    setCalendarSubTab('calendar');
  };

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCalendarSubTab(tab.id)}
            className={`sub-nav-tab ${calendarSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {t(tab.nameKey)}
          </button>
        ))}
      </div>
      
      {calendarSubTab === 'calendar' && <UnifiedCalendar currentUser={currentUser} importedEvents={importedEvents} />}
      {calendarSubTab === 'capacity' && <CapacityTimeline />}
      {calendarSubTab === 'google' && (
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <GoogleCalendarSync onEventsImport={handleEventsImport} />
        </div>
      )}
    </>
  );
}

// Business Tab with sub-navigation
function BusinessTabContent({ currentUser }) {
  const { t } = useLanguage();
  const [businessSubTab, setBusinessSubTab] = useState('overview');

  // Listen for external navigation events
  useEffect(() => {
    const handleSetSubTab = (e) => setBusinessSubTab(e.detail);
    window.addEventListener('setBusinessSubTab', handleSetSubTab);
    return () => window.removeEventListener('setBusinessSubTab', handleSetSubTab);
  }, []);

  // POS temporarily disabled for V1 launch
  const subTabs = [
    { id: 'overview', nameKey: 'nav.overview', icon: '📊' },
    { id: 'pipeline', nameKey: 'nav.pipeline', icon: '📝' },
    { id: 'orders', nameKey: 'nav.orders', icon: '📦' },
    { id: 'invoices', nameKey: 'nav.invoices', icon: '🧾' },
    { id: 'clients', nameKey: 'nav.clients', icon: '👥' },
    { id: 'quotes', nameKey: 'nav.quotes', icon: '💰' },
    { id: 'einvoice', nameKey: 'nav.einvoice', icon: '🇪🇪' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setBusinessSubTab(tab.id)}
            className={`sub-nav-tab ${businessSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {t(tab.nameKey)}
          </button>
        ))}
      </div>
      
      {businessSubTab === 'overview' && (
        <div className="space-y-6">
          <BusinessOverview />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OrderManagement />
            <QuoteCalculator />
          </div>
        </div>
      )}
      {businessSubTab === 'pipeline' && <OrderPipeline />}
      {/* POS temporarily disabled for V1 launch */}
      {/* {businessSubTab === 'pos' && <QuickPOS currentUser={currentUser} />} */}
      {businessSubTab === 'orders' && <OrderManagement />}
      {businessSubTab === 'invoices' && <InvoiceManagement />}
      {businessSubTab === 'clients' && <ClientList />}
      {businessSubTab === 'quotes' && <QuoteCalculator />}
      {businessSubTab === 'einvoice' && <EstonianEInvoice />}
    </>
  );
}

// Production Tab with sub-navigation
function ProductionTabContent({ currentUser }) {
  const { t } = useLanguage();
  const [productionSubTab, setProductionSubTab] = useState('jobs');

  // Listen for external navigation events
  useEffect(() => {
    const handleSetSubTab = (e) => setProductionSubTab(e.detail);
    window.addEventListener('setProductionSubTab', handleSetSubTab);
    return () => window.removeEventListener('setProductionSubTab', handleSetSubTab);
  }, []);

  const subTabs = [
    { id: 'jobs', nameKey: 'nav.jobs', icon: '📥' },
    { id: 'scheduler', label: 'Smart Scheduler', icon: '🧠' },
    { id: 'history', nameKey: 'nav.history', icon: '📃' },
    { id: 'failures', nameKey: 'nav.failures', icon: '❌' },
    { id: 'time', nameKey: 'nav.time', icon: '⏱️' },
    { id: 'notes', nameKey: 'nav.notes', icon: '📝' },
    { id: 'maintenance', nameKey: 'nav.maintenance', icon: '🔧' },
    { id: 'insights', nameKey: 'nav.insights', icon: '🧠' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setProductionSubTab(tab.id)}
            className={`sub-nav-tab ${productionSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {tab.nameKey ? t(tab.nameKey) : tab.label}
          </button>
        ))}
      </div>
      
      {productionSubTab === 'jobs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <JobQueue />
          <PrintHistory />
        </div>
      )}
      {productionSubTab === 'scheduler' && <SmartPrintScheduler currentUser={currentUser} />}
      {productionSubTab === 'history' && <PrintHistory />}
      {productionSubTab === 'failures' && <PrintFailureLog currentUser={currentUser} />}
      {productionSubTab === 'time' && <TimeTracker currentUser={currentUser} />}
      {productionSubTab === 'notes' && <ShiftNotes currentUser={currentUser} />}
      {productionSubTab === 'maintenance' && <MaintenanceCalendar />}
      {productionSubTab === 'insights' && (
        <div className="space-y-6">
          <MLPredictiveInsights />
          <MLAnomalies />
        </div>
      )}
    </>
  );
}

// Reports Tab with sub-navigation
function ReportsTabContent() {
  const { t } = useLanguage();
  const [reportsSubTab, setReportsSubTab] = useState('financial');

  const subTabs = [
    { id: 'financial', nameKey: 'nav.financial', icon: '💰' },
    { id: 'profitability', nameKey: 'nav.profitability', icon: '📈' },
    { id: 'clients', nameKey: 'nav.clientProfit', icon: '👥' },
    { id: 'costs', nameKey: 'nav.costs', icon: '📊' },
    { id: 'energy', nameKey: 'nav.energy', icon: '⚡' },
    { id: 'utilization', nameKey: 'nav.utilization', icon: '📈' },
    { id: 'export', nameKey: 'nav.export', icon: '📄' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportsSubTab(tab.id)}
            className={`sub-nav-tab ${reportsSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {t(tab.nameKey)}
          </button>
        ))}
      </div>
      
      {reportsSubTab === 'financial' && <FinancialReports />}
      {reportsSubTab === 'profitability' && <JobProfitability />}
      {reportsSubTab === 'clients' && <ClientProfitability />}
      {reportsSubTab === 'costs' && <CostDashboard />}
      {reportsSubTab === 'energy' && <EnergySavings />}
      {reportsSubTab === 'utilization' && <PrinterUtilization printers={[]} />}
      {reportsSubTab === 'export' && <ReportsGenerator />}
    </>
  );
}

// Inventory Tab with sub-navigation
function InventoryTabContent() {
  const { t } = useLanguage();
  const [inventorySubTab, setInventorySubTab] = useState('overview');
  const [spools, setSpools] = useState([]);

  // Load spools for QR manager
  useEffect(() => {
    const savedSpools = localStorage.getItem('polywerk_spools');
    if (savedSpools) {
      try {
        setSpools(JSON.parse(savedSpools));
      } catch (e) {
        console.error('Failed to parse spools:', e);
      }
    }
  }, [inventorySubTab]);

  const handleSpoolUpdate = (spoolId, updates) => {
    const savedSpools = localStorage.getItem('polywerk_spools');
    let spoolsList = savedSpools ? JSON.parse(savedSpools) : [];
    spoolsList = spoolsList.map(s => s.id === spoolId ? { ...s, ...updates } : s);
    localStorage.setItem('polywerk_spools', JSON.stringify(spoolsList));
    setSpools(spoolsList);
  };

  const subTabs = [
    { id: 'overview', nameKey: 'nav.overview', icon: '📊' },
    { id: 'spools', nameKey: 'nav.spools', icon: '🧵' },
    { id: 'qr', nameKey: 'nav.qr', icon: '📱' },
    { id: 'consumables', nameKey: 'nav.consumables', icon: '🔧' },
    { id: 'profiles', nameKey: 'nav.profiles', icon: '⚙️' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInventorySubTab(tab.id)}
            className={`sub-nav-tab ${inventorySubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {t(tab.nameKey)}
          </button>
        ))}
      </div>
      
      {inventorySubTab === 'overview' && <InventoryDashboard />}
      {inventorySubTab === 'spools' && <SpoolManager />}
      {inventorySubTab === 'qr' && <SpoolQRManager spools={spools} onSpoolUpdate={handleSpoolUpdate} />}
      {inventorySubTab === 'consumables' && <ConsumablesInventory />}
      {inventorySubTab === 'profiles' && <MaterialProfiles />}
    </>
  );
}

// Files Tab with sub-navigation
function FilesTabContent() {
  const { t } = useLanguage();
  const [filesSubTab, setFilesSubTab] = useState('library');

  const subTabs = [
    { id: 'library', nameKey: 'nav.library', icon: '📁' },
    { id: 'quote', label: 'Instant Quote', icon: '💰' },
    { id: 'analyze', label: 'Quality Check', icon: '🔍' },
    { id: 'slicer', nameKey: 'nav.slicer', icon: '🔪' },
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilesSubTab(tab.id)}
            className={`sub-nav-tab ${filesSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {tab.nameKey ? t(tab.nameKey) : tab.label}
          </button>
        ))}
      </div>
      
      {filesSubTab === 'library' && <FileLibrary />}
      {filesSubTab === 'quote' && <InstantSTLQuote />}
      {filesSubTab === 'analyze' && <ModelQualityAnalyzer />}
      {filesSubTab === 'slicer' && <STLSlicer />}
    </>
  );
}

// Config Tab with sub-navigation
function ConfigTabContent({ currentUser, onUserUpdate }) {
  const { t } = useLanguage();
  const [configSubTab, setConfigSubTab] = useState('profile');
  const [customRoles, setCustomRoles] = useState([]);

  // Check if user has permission to manage users
  const userRole = currentUser?.role?.toLowerCase() || 'operator';
  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.operator;
  const canManageUsers = permissions.manageUsers;
  const isOwner = userRole === 'owner';

  // Load custom roles from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('polywerk_custom_roles');
    if (saved) {
      try {
        setCustomRoles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse custom roles:', e);
      }
    }
  }, []);

  const handleCreateRole = (newRole) => {
    const updated = [...customRoles, newRole];
    setCustomRoles(updated);
    localStorage.setItem('polywerk_custom_roles', JSON.stringify(updated));
  };

  const handleUpdateRole = (updatedRole) => {
    const updated = customRoles.map(r => r.id === updatedRole.id ? updatedRole : r);
    setCustomRoles(updated);
    localStorage.setItem('polywerk_custom_roles', JSON.stringify(updated));
  };

  const subTabs = [
    { id: 'profile', nameKey: 'nav.profile', icon: '👤' },
    { id: 'system', nameKey: 'nav.system', icon: '💻' },
    { id: 'settings', nameKey: 'nav.settings', icon: '⚙️' },
    ...(canManageUsers ? [
      { id: 'team', nameKey: 'nav.team', icon: '👥' },
      { id: 'roles', label: 'Roles', icon: '🛡️' },
      { id: 'audit', label: 'Audit Log', icon: '📜' },
    ] : []),
    ...(isOwner ? [
      { id: 'data', label: 'Data Management', icon: '🗄️' },
    ] : []),
  ];

  return (
    <>
      <div className="sub-nav mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setConfigSubTab(tab.id)}
            className={`sub-nav-tab ${configSubTab === tab.id ? 'active' : ''}`}
          >
            <span className="mr-2 opacity-70">{tab.icon}</span>
            {tab.nameKey ? t(tab.nameKey) : tab.label}
          </button>
        ))}
      </div>
      
      {configSubTab === 'profile' && <UserProfile currentUser={currentUser} onUserUpdate={onUserUpdate} />}
      {configSubTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SystemStats />
        </div>
      )}
      {configSubTab === 'settings' && <ConfigTab canManageUsers={canManageUsers} />}
      {configSubTab === 'team' && canManageUsers && (
        <TeamManagement currentUser={currentUser} />
      )}
      {configSubTab === 'roles' && canManageUsers && (
        <RoleManager 
          customRoles={customRoles}
          onRoleCreate={handleCreateRole}
          onRoleUpdate={handleUpdateRole}
        />
      )}
      {configSubTab === 'audit' && canManageUsers && (
        <PermissionAuditLog />
      )}
      {configSubTab === 'data' && isOwner && (
        <DataManagement currentUser={currentUser} />
      )}
    </>
  );
}

function App() {
  // Check if this is an invitation URL
  const [inviteToken, setInviteToken] = useState(null);
  // Check if this is a tracking URL
  const [trackingOrderId, setTrackingOrderId] = useState(null);

  useEffect(() => {
    // Check URL for /invite/:token pattern
    const path = window.location.pathname;
    const inviteMatch = path.match(/\/invite\/([a-zA-Z0-9_-]+)/);
    if (inviteMatch) {
      setInviteToken(inviteMatch[1]);
    }
    // Check URL for /track/:orderId pattern
    const trackMatch = path.match(/\/track\/([a-zA-Z0-9_-]+)/);
    if (trackMatch) {
      setTrackingOrderId(trackMatch[1]);
    }
  }, []);

  // If this is a tracking URL, show public tracking page (no login required)
  if (trackingOrderId) {
    return (
      <LanguageProvider>
        <OrderTrackingPage 
          orderId={trackingOrderId}
          onBack={() => {
            setTrackingOrderId(null);
            window.history.pushState({}, '', '/');
            window.location.reload();
          }}
        />
      </LanguageProvider>
    );
  }

  // If this is an invitation URL, show the AcceptInvitation page
  if (inviteToken) {
    return (
      <AcceptInvitation 
        token={inviteToken} 
        onComplete={() => {
          // Clear token and redirect to login
          setInviteToken(null);
          window.history.pushState({}, '', '/');
        }} 
      />
    );
  }

  return (
    <LanguageProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fafafa',
            border: '1px solid #27272a',
          },
        }}
      />
      <AppContent />
    </LanguageProvider>
  );
}

// Wrapper component that provides permissions context after login
function AppWithPermissions({ children }) {
  return children;
}

export default App;
