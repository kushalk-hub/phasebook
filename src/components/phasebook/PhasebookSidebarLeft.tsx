import React from 'react';
import {
  Users,
  Tv,
  Store,
  Bookmark,
  Calendar,
  Clock,
  Sparkles,
  Shield,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { CURRENT_USER } from '../../lib/phasebookData';

interface PhasebookSidebarLeftProps {
  onOpenPlusModal: () => void;
  onNavigateToAdmin: () => void;
}

export const PhasebookSidebarLeft: React.FC<PhasebookSidebarLeftProps> = ({
  onOpenPlusModal,
  onNavigateToAdmin,
}) => {
  return (
    <aside className="hidden lg:block w-72 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto p-3 text-slate-700 text-sm select-none">
      {/* Current User Profile Item */}
      <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-200/60 cursor-pointer transition-colors">
        <img
          src={CURRENT_USER.avatar}
          alt={CURRENT_USER.name}
          className="w-9 h-9 rounded-full object-cover border border-slate-300"
        />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">{CURRENT_USER.name}</p>
          <p className="text-[11px] text-slate-500 truncate">{CURRENT_USER.role}</p>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="mt-1 space-y-0.5">
        <button className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-200/60 text-left transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#1877F2]">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-slate-800">Friends</span>
            <span className="ml-2 text-xs bg-blue-100 text-[#1877F2] font-bold px-1.5 py-0.5 rounded-full">
              3 new
            </span>
          </div>
        </button>

        <button className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-200/60 text-left transition-colors">
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
            <Clock className="w-5 h-5" />
          </div>
          <span className="font-semibold text-slate-800">Feeds & Memories</span>
        </button>

        <button className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-200/60 text-left transition-colors">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
          <span className="font-semibold text-slate-800">Groups</span>
        </button>

        <button className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-200/60 text-left transition-colors">
          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-semibold text-slate-800">Marketplace</span>
        </button>

        <button className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-200/60 text-left transition-colors">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <Tv className="w-5 h-5" />
          </div>
          <span className="font-semibold text-slate-800">Video</span>
        </button>

        <button className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-200/60 text-left transition-colors">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
            <Bookmark className="w-5 h-5" />
          </div>
          <span className="font-semibold text-slate-800">Saved</span>
        </button>

        <button
          onClick={onOpenPlusModal}
          className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-blue-50 text-left transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-slate-900 group-hover:text-blue-600">Phasebook Plus</span>
            <p className="text-[11px] text-slate-500">Creator tipping & verification</p>
          </div>
        </button>
      </div>

      <hr className="my-3 border-slate-200" />

      {/* SRE Developer Quick Access */}
      <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            SRE Control Deck
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mb-2.5">
          Inject chaos faults, observe real telemetry, or trigger SRE-Zero remediation.
        </p>
        <button
          onClick={onNavigateToAdmin}
          className="w-full bg-[#1877F2] hover:bg-blue-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          Open /admin Portal
        </button>
      </div>

      {/* Shortcuts */}
      <div className="mt-4">
        <p className="text-xs font-bold text-slate-500 uppercase px-2 mb-1">Your Shortcuts</p>
        <div className="space-y-0.5 text-xs">
          <div className="p-2 rounded-lg hover:bg-slate-200/60 cursor-pointer flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-white font-bold text-[10px]">
              SRE
            </div>
            <span className="font-medium text-slate-800">Reliability & Chaos Engineering</span>
          </div>
          <div className="p-2 rounded-lg hover:bg-slate-200/60 cursor-pointer flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-white font-bold text-[10px]">
              TS
            </div>
            <span className="font-medium text-slate-800">TypeScript & Modern Web</span>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="mt-6 px-2 text-[11px] text-slate-400 space-y-1">
        <p>Privacy &bull; Terms &bull; Advertising &bull; Cookies &bull; Phasebook &copy; 2026</p>
      </div>
    </aside>
  );
};
