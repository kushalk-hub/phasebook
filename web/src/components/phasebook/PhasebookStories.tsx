import React from 'react';
import { Plus } from 'lucide-react';
import { CURRENT_USER, INITIAL_STORIES } from '../../lib/phasebookData';

export const PhasebookStories: React.FC = () => {
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none select-none">
      {/* Create Story Tile */}
      <div className="relative w-28 sm:w-32 h-44 sm:h-48 rounded-2xl bg-white border border-slate-200 overflow-hidden shrink-0 shadow-xs cursor-pointer hover:shadow-md transition-all group flex flex-col justify-between">
        <div className="h-32 sm:h-36 overflow-hidden bg-slate-100">
          <img
            src={CURRENT_USER.avatar}
            alt={CURRENT_USER.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="absolute top-28 sm:top-32 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#1877F2] border-3 border-white flex items-center justify-center text-white shadow-md">
          <Plus className="w-5 h-5 font-bold" />
        </div>

        <div className="pb-2 pt-4 text-center">
          <p className="text-[11px] font-bold text-slate-800">Create story</p>
        </div>
      </div>

      {/* Friend Story Cards */}
      {INITIAL_STORIES.map((story) => (
        <div
          key={story.id}
          className="relative w-28 sm:w-32 h-44 sm:h-48 rounded-2xl overflow-hidden shrink-0 shadow-xs cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all group"
        >
          {/* Story Background Image */}
          <img
            src={story.image}
            alt={story.user.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/70" />

          {/* User Avatar with Blue Unseen Ring */}
          <div className="absolute top-3 left-3">
            <img
              src={story.user.avatar}
              alt={story.user.name}
              className={`w-9 h-9 rounded-full object-cover border-3 shadow-md ${
                story.hasUnseen ? 'border-[#1877F2]' : 'border-slate-300'
              }`}
            />
          </div>

          {/* User Name */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <p className="text-white text-xs font-bold truncate drop-shadow-sm">
              {story.user.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
