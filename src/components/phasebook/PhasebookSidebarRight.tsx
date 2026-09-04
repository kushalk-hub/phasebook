import React, { useState } from 'react';
import {
  Sparkles,
  Gift,
  Search,
  MoreHorizontal,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';
import { INITIAL_FRIENDS, CURRENT_USER } from '../../lib/phasebookData';
import { PhasebookUser } from '../../types';

interface PhasebookSidebarRightProps {
  onOpenPlusModal: () => void;
}

export const PhasebookSidebarRight: React.FC<PhasebookSidebarRightProps> = ({
  onOpenPlusModal,
}) => {
  const [activeChatUser, setActiveChatUser] = useState<PhasebookUser | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'me' | 'them'; text: string; time: string }>
  >([
    { sender: 'them', text: 'Hey Alex! Did you check out the new Phasebook release?', time: '10:42 AM' },
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: 'me', text: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setChatInput('');
  };

  return (
    <aside className="hidden xl:block w-80 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto p-3 text-slate-700 text-sm select-none">
      {/* Sponsored Section */}
      <div className="space-y-2 pb-3 border-b border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider px-1">
          <span>Sponsored</span>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group">
          <img
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200&auto=format&fit=crop&q=80"
            alt="Cloud platform ad"
            className="w-24 h-20 rounded-xl object-cover border border-slate-200"
          />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-xs leading-snug group-hover:text-blue-600 transition-colors">
              CloudScale Pro: Zero-Downtime Multi-Region K8s
            </p>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              cloudscale.io <ExternalLink className="w-2.5 h-2.5" />
            </p>
          </div>
        </div>
      </div>

      {/* Phasebook Plus Subscription Promotion (Tests Payment API dependency) */}
      <div className="my-3 p-3.5 bg-linear-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-xs font-bold uppercase tracking-wider">Phasebook Plus</span>
        </div>

        <p className="text-xs text-blue-100 leading-relaxed">
          Unlock the verified badge, creator tips, and priority post delivery for $4.99/mo.
        </p>

        <button
          onClick={onOpenPlusModal}
          className="w-full bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs py-2 px-3 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          Subscribe for $4.99
        </button>
      </div>

      {/* Birthdays Section */}
      <div className="py-2.5 border-b border-slate-200">
        <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 shrink-0">
            <Gift className="w-4 h-4" />
          </div>
          <div className="text-xs text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900">Sarah Connor</span> and{' '}
            <span className="font-bold text-slate-900">2 others</span> have birthdays today.
          </div>
        </div>
      </div>

      {/* Contacts List Header */}
      <div className="pt-3">
        <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          <span>Contacts ({INITIAL_FRIENDS.length})</span>
          <div className="flex items-center gap-2 text-slate-400">
            <Search className="w-3.5 h-3.5 hover:text-slate-600 cursor-pointer" />
            <MoreHorizontal className="w-3.5 h-3.5 hover:text-slate-600 cursor-pointer" />
          </div>
        </div>

        {/* Friends with Active Green Presence Dots */}
        <div className="space-y-0.5">
          {INITIAL_FRIENDS.map((friend) => (
            <div
              key={friend.id}
              onClick={() => setActiveChatUser(friend)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-200/60 cursor-pointer transition-colors"
            >
              <div className="relative shrink-0">
                <img
                  src={friend.avatar}
                  alt={friend.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{friend.name}</p>
                <p className="text-[10px] text-slate-400 truncate">Online now</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini Facebook-Style Chat Popup at Bottom Right */}
      {activeChatUser && (
        <div className="fixed bottom-3 right-5 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-bottom-5">
          {/* Chat Header */}
          <div className="bg-[#1877F2] text-white p-3 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={activeChatUser.avatar}
                  alt={activeChatUser.name}
                  className="w-7 h-7 rounded-full object-cover border border-white"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
              </div>
              <span className="font-bold text-xs truncate max-w-[140px]">
                {activeChatUser.name}
              </span>
            </div>

            <button
              onClick={() => setActiveChatUser(null)}
              className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="p-3 h-48 overflow-y-auto space-y-2 text-xs bg-slate-50/60">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`p-2.5 rounded-2xl max-w-[80%] leading-relaxed ${
                    msg.sender === 'me'
                      ? 'bg-[#1877F2] text-white'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`text-[9px] mt-1 block ${
                      msg.sender === 'me' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-2 border-t border-slate-200 bg-white flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Aa..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChat();
              }}
              className="flex-1 bg-slate-100 text-xs text-slate-800 px-3 py-1.5 rounded-full border border-transparent focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="p-1.5 rounded-full text-[#1877F2] hover:bg-blue-50 disabled:text-slate-300 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
