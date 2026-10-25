import React, { useState } from 'react';
import {
  Video,
  Image as ImageIcon,
  Smile,
  X,
  Send,
  Loader2,
  AlertCircle,
  Tag,
  Sparkles,
} from 'lucide-react';
import { CURRENT_USER } from '../../lib/phasebookData';

interface PhasebookCreatePostProps {
  onSubmitPost: (content: string, image?: string) => Promise<boolean>;
  isPosting: boolean;
  postError: string | null;
  onClearError: () => void;
}

const PHOTO_PRESETS = [
  {
    label: 'Architecture',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80',
  },
  {
    label: 'Coding & Tech',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
  },
  {
    label: 'Nature',
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1000&auto=format&fit=crop&q=80',
  },
  {
    label: 'Coffee & Work',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80',
  },
];

export const PhasebookCreatePost: React.FC<PhasebookCreatePostProps> = ({
  onSubmitPost,
  isPosting,
  postError,
  onClearError,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  const handleSubmit = async () => {
    if (!postContent.trim() || isPosting) return;

    const success = await onSubmitPost(postContent, selectedImage || undefined);
    if (success) {
      setPostContent('');
      setSelectedImage(null);
      setIsModalOpen(false);
      setShowPhotoPicker(false);
    }
  };

  return (
    <>
      {/* Inline Post Trigger Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 select-none">
        <div className="flex items-center gap-3">
          <img
            src={CURRENT_USER.avatar}
            alt={CURRENT_USER.name}
            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
          />
          <button
            onClick={() => {
              onClearError();
              setIsModalOpen(true);
            }}
            className="flex-1 bg-slate-100 hover:bg-slate-200/80 text-left text-slate-500 text-sm px-4 py-2.5 rounded-full transition-colors cursor-pointer"
          >
            What's on your mind, {CURRENT_USER.name.split(' ')[0]}?
          </button>
        </div>

        <hr className="my-3 border-slate-100" />

        {/* Quick action triggers */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <button
            onClick={() => {
              onClearError();
              setIsModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-100 rounded-xl text-slate-600 font-semibold text-xs transition-colors"
          >
            <Video className="w-5 h-5 text-red-500" />
            <span className="hidden sm:inline">Live video</span>
          </button>

          <button
            onClick={() => {
              onClearError();
              setShowPhotoPicker(true);
              setIsModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-100 rounded-xl text-slate-600 font-semibold text-xs transition-colors"
          >
            <ImageIcon className="w-5 h-5 text-emerald-500" />
            <span>Photo/video</span>
          </button>

          <button
            onClick={() => {
              onClearError();
              setIsModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-slate-100 rounded-xl text-slate-600 font-semibold text-xs transition-colors"
          >
            <Smile className="w-5 h-5 text-amber-500" />
            <span className="hidden sm:inline">Feeling/activity</span>
          </button>
        </div>
      </div>

      {/* Expanded Modal Composer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="relative border-b border-slate-200 py-3.5 px-4 text-center">
              <h3 className="font-bold text-slate-900 text-base">Create post</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  onClearError();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Author details */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={CURRENT_USER.avatar}
                  alt={CURRENT_USER.name}
                  className="w-11 h-11 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <p className="font-bold text-slate-900 text-sm">{CURRENT_USER.name}</p>
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                    Public &bull; Phasebook Feed
                  </span>
                </div>
              </div>

              {/* Text Area */}
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder={`What's on your mind, ${CURRENT_USER.name.split(' ')[0]}?`}
                rows={4}
                className="w-full text-base text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none"
                autoFocus
              />

              {/* Attached Image Preview */}
              {selectedImage && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-56 bg-slate-100">
                  <img
                    src={selectedImage}
                    alt="Selected attachment"
                    className="w-full h-full object-cover max-h-56"
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center shadow-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Photo Preset Picker */}
              {showPhotoPicker && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-slate-600">Select a high-res photo:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PHOTO_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setSelectedImage(p.url)}
                        className={`group relative h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImage === p.url ? 'border-blue-600 scale-95' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={p.url}
                          alt={p.label}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold py-0.5 text-center truncate px-1">
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Post Toolbar */}
              <div className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Add to your post</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                    className="p-2 rounded-full hover:bg-slate-100 text-emerald-600 transition-colors"
                    title="Add Photo"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-full hover:bg-slate-100 text-blue-500 transition-colors"
                    title="Tag people"
                  >
                    <Tag className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-full hover:bg-slate-100 text-amber-500 transition-colors"
                    title="Feeling"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Real Backend Error State Display */}
              {postError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Failed to publish post (API Failure)</span>
                  </div>
                  <p className="font-mono text-[11px] text-red-600 leading-relaxed break-words pl-5">
                    {postError}
                  </p>
                </div>
              )}

              {/* Submit Post Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!postContent.trim() || isPosting}
                className="w-full bg-[#1877F2] hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Posting to Phasebook...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Post</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
