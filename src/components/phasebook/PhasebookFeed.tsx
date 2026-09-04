import React, { useState } from 'react';
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Send,
  Sparkles,
  AlertTriangle,
  RotateCw,
  CheckCircle,
  Globe,
  Loader2,
} from 'lucide-react';
import { PhasebookPost } from '../../types';

interface PhasebookFeedProps {
  posts: PhasebookPost[];
  feedError: string | null;
  isLoading: boolean;
  onRetryFeed: () => void;
  onLikePost: (postId: string) => Promise<void>;
  onCommentPost: (postId: string, commentText: string) => Promise<boolean>;
  onOpenTipModal: (post: PhasebookPost) => void;
}

export const PhasebookFeed: React.FC<PhasebookFeedProps> = ({
  posts,
  feedError,
  isLoading,
  onRetryFeed,
  onLikePost,
  onCommentPost,
  onOpenTipModal,
}) => {
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<{ postId: string; message: string } | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  const handleCommentSubmit = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    setSubmittingCommentPostId(postId);
    setCommentError(null);

    const success = await onCommentPost(postId, text);
    setSubmittingCommentPostId(null);

    if (success) {
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    } else {
      setCommentError({
        postId,
        message: 'Database error: Failed to commit comment row (Connection offline).',
      });
    }
  };

  const handleShare = (postId: string) => {
    setCopiedPostId(postId);
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  // -------------------------------------------------------------
  // Genuine Feed Outage State (Observable Application Failure)
  // -------------------------------------------------------------
  if (feedError) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 mx-auto flex items-center justify-center text-red-600">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h3 className="font-bold text-slate-900 text-lg">Unable to load feed</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Phasebook is experiencing a service degradation while fetching your personal timeline.
          </p>
        </div>

        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-left max-w-lg mx-auto">
          <p className="text-[11px] font-bold text-red-800 uppercase tracking-wide">
            Observed Production Error:
          </p>
          <p className="font-mono text-xs text-red-700 mt-1 break-words leading-relaxed">
            {feedError}
          </p>
        </div>

        <button
          onClick={onRetryFeed}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-[#1877F2] hover:bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors shadow-xs cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Re-probing Feed...' : 'Try Again'}</span>
        </button>
      </div>
    );
  }

  // Loading skeleton
  if (isLoading && posts.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2].map((n) => (
          <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-slate-200 rounded-sm w-32" />
                <div className="h-2.5 bg-slate-200 rounded-sm w-20" />
              </div>
            </div>
            <div className="h-4 bg-slate-200 rounded-sm w-full" />
            <div className="h-4 bg-slate-200 rounded-sm w-3/4" />
            <div className="h-48 bg-slate-200 rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const isCommentOpen = activeCommentPostId === post.id;
        const currentInput = commentInputs[post.id] || '';

        return (
          <article
            key={post.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-shadow hover:shadow-md"
          >
            {/* Post Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-sm hover:underline cursor-pointer">
                      {post.author.name}
                    </span>
                    {post.author.verified && (
                      <span className="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[10px] font-extrabold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>{post.timestamp}</span>
                    <span>&bull;</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>

              <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Post Text Content */}
            <div className="px-4 pb-3">
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {post.content}
              </p>
            </div>

            {/* Post Media / Image */}
            {(post.image || post.imageUrl) && (
              <div className="bg-slate-100 overflow-hidden max-h-[500px] border-y border-slate-100">
                <img
                  src={post.image || post.imageUrl}
                  alt="Post visual"
                  className="w-full h-full object-cover max-h-[500px] hover:opacity-95 transition-opacity cursor-pointer"
                />
              </div>
            )}

            {/* Reactions & Engagement Summary */}
            <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                  👍
                </span>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs -ml-2">
                  ❤️
                </span>
                <span className="font-medium ml-1">{post.likes}</span>
              </div>

              <div className="flex items-center gap-3">
                <span>{post.comments.length} comments</span>
                <span>{post.shares} shares</span>
              </div>
            </div>

            {/* Action Buttons: Like, Comment, Share, Tip */}
            <div className="px-2 py-1 flex items-center justify-between gap-1 text-slate-600 font-semibold text-xs border-b border-slate-100">
              <button
                onClick={() => onLikePost(post.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-100 transition-colors ${
                  post.userLiked ? 'text-[#1877F2]' : ''
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${post.userLiked ? 'fill-[#1877F2]' : ''}`} />
                <span>Like</span>
              </button>

              <button
                onClick={() => setActiveCommentPostId(isCommentOpen ? null : post.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Comment</span>
              </button>

              <button
                onClick={() => handleShare(post.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {copiedPostId === post.id ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Shared
                  </span>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onOpenTipModal(post)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                title="Send creator tip (Tests Payment API dependency)"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Tip</span>
              </button>
            </div>

            {/* Comments Section */}
            {isCommentOpen && (
              <div className="p-4 bg-slate-50/50 space-y-3">
                {/* Existing Comments list */}
                {post.comments.length > 0 && (
                  <div className="space-y-2.5">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2.5 text-xs">
                        <img
                          src={comment.author.avatar}
                          alt={comment.author.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
                        />
                        <div className="bg-slate-100 hover:bg-slate-200/70 p-2.5 rounded-2xl max-w-[85%] transition-colors">
                          <p className="font-bold text-slate-900">{comment.author.name}</p>
                          <p className="text-slate-800 mt-0.5 leading-relaxed">{comment.text}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {comment.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Error Alert if DB down */}
                {commentError && commentError.postId === post.id && (
                  <div className="p-2 bg-red-100 border border-red-200 rounded-lg text-xs text-red-700 font-mono">
                    {commentError.message}
                  </div>
                )}

                {/* New Comment Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={currentInput}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommentSubmit(post.id);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-xs text-slate-900 px-3.5 py-2 rounded-full border border-transparent focus:border-blue-500 focus:outline-none transition-all"
                  />

                  <button
                    onClick={() => handleCommentSubmit(post.id)}
                    disabled={!currentInput.trim() || submittingCommentPostId === post.id}
                    className="w-8 h-8 rounded-full bg-[#1877F2] hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer"
                  >
                    {submittingCommentPostId === post.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
