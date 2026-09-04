import React, { useState } from 'react';
import {
  Search,
  Home,
  Tv,
  Store,
  Users,
  Gamepad2,
  Bell,
  MessageCircle,
  Plus,
  ShieldAlert,
  CheckCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { CURRENT_USER } from '../../lib/phasebookData';
import { PhasebookNotification, SimulatorState } from '../../types';

interface PhasebookNavProps {
  simulatorState: SimulatorState;
  onNavigateToAdmin: () => void;
  notifications: PhasebookNotification[];
  onOpenNotifications: () => void;
  showNotificationsModal: boolean;
  onCloseNotifications: () => void;
  notificationError: string | null;
  onOpenPlusModal: () => void;
}

export const PhasebookNav: React.FC<PhasebookNavProps> = ({
  simulatorState,
  onNavigateToAdmin,
  notifications,
  onOpenNotifications,
  showNotificationsModal,
  onCloseNotifications,
  notificationError,
  onOpenPlusModal,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'watch' | 'marketplace' | 'groups' | 'gaming'>('home');
  const [searchQuery, setSearchQuery] = useState('');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isSystemUnhealthy = simulatorState.systemHealth !== 'HEALTHY';

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs h-14 px-4 flex items-center justify-between">
      {/* Left: Logo & Search */}
      <div className="flex items-center gap-2 lg:w-80">
        {/* Phasebook classic blue circular logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-extrabold text-2xl tracking-tighter shadow-sm select-none">
            p
          </div>
          <span className="hidden sm:inline font-bold text-2xl tracking-tight text-[#1877F2]">
            phasebook
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative ml-1 hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Phasebook"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-sm text-slate-800 pl-9 pr-3 py-2 rounded-full border border-transparent focus:border-blue-500 focus:outline-none transition-all w-48 lg:w-60"
          />
        </div>
      </div>

      {/* Center: Main Navigation Tabs */}
      <div className="hidden sm:flex items-center justify-center gap-1 md:gap-2 flex-1 max-w-xl h-full">
        <button
          onClick={() => setActiveTab('home')}
          className={`relative h-full px-6 flex items-center justify-center border-b-4 transition-colors ${
            activeTab === 'home'
              ? 'border-[#1877F2] text-[#1877F2]'
              : 'border-transparent text-slate-500 hover:bg-slate-100'
          }`}
          title="Home"
        >
          <Home className="w-7 h-7" />
        </button>

        <button
          onClick={() => setActiveTab('watch')}
          className={`relative h-full px-6 flex items-center justify-center border-b-4 transition-colors ${
            activeTab === 'watch'
              ? 'border-[#1877F2] text-[#1877F2]'
              : 'border-transparent text-slate-500 hover:bg-slate-100'
          }`}
          title="Video"
        >
          <Tv className="w-7 h-7" />
        </button>

        <button
          onClick={() => setActiveTab('marketplace')}
          className={`relative h-full px-6 flex items-center justify-center border-b-4 transition-colors ${
            activeTab === 'marketplace'
              ? 'border-[#1877F2] text-[#1877F2]'
              : 'border-transparent text-slate-500 hover:bg-slate-100'
          }`}
          title="Marketplace"
        >
          <Store className="w-7 h-7" />
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`relative h-full px-6 flex items-center justify-center border-b-4 transition-colors ${
            activeTab === 'groups'
              ? 'border-[#1877F2] text-[#1877F2]'
              : 'border-transparent text-slate-500 hover:bg-slate-100'
          }`}
          title="Groups"
        >
          <Users className="w-7 h-7" />
        </button>

        <button
          onClick={() => setActiveTab('gaming')}
          className={`relative h-full px-6 flex items-center justify-center border-b-4 transition-colors ${
            activeTab === 'gaming'
              ? 'border-[#1877F2] text-[#1877F2]'
              : 'border-transparent text-slate-500 hover:bg-slate-100'
          }`}
          title="Gaming"
        >
          <Gamepad2 className="w-7 h-7" />
        </button>
      </div>

      {/* Right: User menu & SRE Admin Button */}
      <div className="flex items-center gap-2 lg:w-80 justify-end">
        {/* Phasebook Plus badge trigger */}
        <button
          onClick={onOpenPlusModal}
          className="hidden md:flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-[#1877F2] text-xs font-bold px-3 py-1.5 rounded-full transition-colors border border-blue-200"
          title="Phasebook Plus Subscription (Tests Payment API)"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Phasebook Plus
        </button>

        {/* Notifications Icon with Badge */}
        <div className="relative">
          <button
            onClick={onOpenNotifications}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[11px] rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Modal */}
          {showNotificationsModal && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-base">Notifications</h3>
                <button
                  onClick={onCloseNotifications}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {notificationError ? (
                <div className="p-4 m-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    Failed to fetch notifications
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-red-600">{notificationError}</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors ${
                        !notif.read ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <img
                        src={notif.user.avatar}
                        alt={notif.user.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0 text-xs text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900">{notif.user.name}</span>{' '}
                        <span>{notif.action}</span>
                        {notif.target && (
                          <span className="font-medium text-slate-800"> {notif.target}</span>
                        )}
                        <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                          {notif.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Avatar Pill */}
        <div className="flex items-center gap-2 pl-1 cursor-pointer hover:opacity-90">
          <img
            src={CURRENT_USER.avatar}
            alt={CURRENT_USER.name}
            className="w-9 h-9 rounded-full object-cover border border-slate-300"
          />
          <span className="hidden xl:inline text-xs font-semibold text-slate-800">
            {CURRENT_USER.name.split(' ')[0]}
          </span>
        </div>

        {/* Discreet SRE Admin Access Button */}
        <button
          id="btn-nav-admin"
          onClick={onNavigateToAdmin}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ml-1 ${
            isSystemUnhealthy
              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
          title="Open SRE Admin & Chaos Control Panel (/admin)"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>SRE Admin</span>
          {isSystemUnhealthy && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          )}
        </button>
      </div>
    </nav>
  );
};
