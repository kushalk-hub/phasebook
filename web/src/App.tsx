import React, { useState, useEffect, useCallback } from 'react';
import { PhasebookNav } from './components/phasebook/PhasebookNav';
import { PhasebookSidebarLeft } from './components/phasebook/PhasebookSidebarLeft';
import { PhasebookSidebarRight } from './components/phasebook/PhasebookSidebarRight';
import { PhasebookStories } from './components/phasebook/PhasebookStories';
import { PhasebookCreatePost } from './components/phasebook/PhasebookCreatePost';
import { PhasebookFeed } from './components/phasebook/PhasebookFeed';
import { PhasebookPaymentModal } from './components/phasebook/PhasebookPaymentModal';
import { AdminControlPanel } from './components/admin/AdminControlPanel';
import {
  createInitialSimulatorState,
} from './lib/simulatorEngine';
import {
  PhasebookPost,
  PhasebookNotification,
  SimulatorState,
  ServiceName,
  SREZeroToolName,
  FailureType,
} from './types';
import { INITIAL_POSTS, INITIAL_NOTIFICATIONS } from './lib/phasebookData';

export function App() {
  // Navigation Route ('phasebook' or 'admin')
  const [currentRoute, setCurrentRoute] = useState<'phasebook' | 'admin'>(() => {
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'phasebook';
  });

  // Simulator State
  const [simulatorState, setSimulatorState] = useState<SimulatorState>(createInitialSimulatorState());

  // Phasebook Social State
  const [posts, setPosts] = useState<PhasebookPost[]>(INITIAL_POSTS);
  const [notifications, setNotifications] = useState<PhasebookNotification[]>(INITIAL_NOTIFICATIONS);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Modals
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
  const [plusModalConfig, setPlusModalConfig] = useState<{ title: string; amount: number }>({
    title: 'Phasebook Plus VIP Subscription',
    amount: 4.99,
  });

  // Sync browser back/forward history
  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(window.location.pathname.startsWith('/admin') ? 'admin' : 'phasebook');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState(null, '', '/admin');
    setCurrentRoute('admin');
  };

  const navigateToPhasebook = () => {
    window.history.pushState(null, '', '/');
    setCurrentRoute('phasebook');
  };

  // -------------------------------------------------------------------
  // Server State Polling
  // -------------------------------------------------------------------
  const fetchSimulatorState = useCallback(async () => {
    try {
      const resp = await fetch('/api/system/state');
      if (resp.ok) {
        const data = await resp.json();
        setSimulatorState(data);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  // Poll simulator state every 4s
  useEffect(() => {
    fetchSimulatorState();
    const interval = setInterval(fetchSimulatorState, 4000);
    return () => clearInterval(interval);
  }, [fetchSimulatorState]);

  // -------------------------------------------------------------------
  // Fetch Phasebook Feed (Tests real Feed API)
  // -------------------------------------------------------------------
  const fetchFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    setFeedError(null);
    try {
      const resp = await fetch('/api/feed');
      const data = await resp.json();

      if (resp.ok && data.success) {
        setPosts(data.feed || []);
        setFeedError(null);
      } else {
        setFeedError(
          data.message ||
            `${data.error || 'HTTP ' + resp.status}: Failed to reach Phasebook feed service`
        );
      }
    } catch (err: any) {
      setFeedError(err.message || 'Network error fetching feed');
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  // Fetch feed on initial load and route return
  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // -------------------------------------------------------------------
  // Fetch Notifications
  // -------------------------------------------------------------------
  const fetchNotifications = async () => {
    setNotificationError(null);
    try {
      const resp = await fetch('/api/notifications');
      const data = await resp.json();
      if (resp.ok && data.success) {
        setNotifications(data.notifications || []);
      } else {
        setNotificationError(data.message || 'Notification service unreachable');
      }
    } catch (err: any) {
      setNotificationError(err.message || 'Network error fetching notifications');
    }
  };

  // -------------------------------------------------------------------
  // Social Actions (Posts, Likes, Comments)
  // -------------------------------------------------------------------
  const handleCreatePost = async (content: string, image?: string): Promise<boolean> => {
    setIsPosting(true);
    setPostError(null);
    try {
      const resp = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, image }),
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        setPosts((prev) => [data.post, ...prev]);
        setPostError(null);
        return true;
      } else {
        setPostError(
          data.message || `${data.error || 'HTTP ' + resp.status}: Failed to commit post`
        );
        return false;
      }
    } catch (err: any) {
      setPostError(err.message || 'Network error publishing post');
      return false;
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const resp = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
      }
    } catch (err) {
      console.warn('Like failed:', err);
    }
  };

  const handleCommentPost = async (postId: string, text: string): Promise<boolean> => {
    try {
      const resp = await fetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post : p)));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleOpenTip = (post: PhasebookPost) => {
    setPlusModalConfig({
      title: `Send $2 Tip to ${post.author.name}`,
      amount: 2.0,
    });
    setIsPlusModalOpen(true);
  };

  const handleOpenPlus = () => {
    setPlusModalConfig({
      title: 'Phasebook Plus VIP Subscription',
      amount: 4.99,
    });
    setIsPlusModalOpen(true);
  };

  // -------------------------------------------------------------------
  // SRE Admin & Chaos Fault Injections
  // -------------------------------------------------------------------
  const handleInjectFailure = async (type: FailureType, service?: ServiceName) => {
    let endpoint = '';
    let body: any = undefined;

    switch (type) {
      case 'BAD_DEPLOYMENT':
        endpoint = '/api/inject/bad-deployment';
        break;
      case 'DATABASE_FAILURE':
        endpoint = '/api/inject/database-failure';
        break;
      case 'SERVICE_CRASH':
        endpoint = '/api/inject/service-crash';
        body = { service: service || 'feed' };
        break;
      case 'DEPENDENCY_FAILURE':
        endpoint = '/api/inject/dependency-failure';
        break;
      case 'HIGH_MEMORY':
        endpoint = '/api/inject/high-memory';
        body = { service: service || 'feed' };
        break;
    }

    if (endpoint) {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await resp.json();
      if (data.state) {
        setSimulatorState(data.state);
      }
      // Re-check feed to reflect live failure immediately
      fetchFeed();
    }
  };

  const handleResetSystem = async () => {
    const resp = await fetch('/api/remediate/reset', { method: 'POST' });
    const data = await resp.json();
    if (data.state) {
      setSimulatorState(data.state);
    }
    fetchFeed();
  };

  const handleRunInvestigation = async () => {
    const resp = await fetch('/api/sre-zero/investigate', { method: 'POST' });
    const data = await resp.json();
    fetchSimulatorState();
  };

  const handleApproveRemediation = async () => {
    const resp = await fetch('/api/sre-zero/approve', { method: 'POST' });
    const data = await resp.json();
    if (data.state) {
      setSimulatorState(data.state);
    }
    fetchFeed();
  };

  const handleVerifyRecovery = async () => {
    const resp = await fetch('/api/sre-zero/verify', { method: 'POST' });
    const data = await resp.json();
    if (data.state) {
      setSimulatorState(data.state);
    }
    fetchFeed();
  };

  const handleExecuteTool = async (toolName: SREZeroToolName) => {
    const resp = await fetch(`/api/sre-zero/tools/${toolName}`);
    return await resp.json();
  };

  // -------------------------------------------------------------------
  // Render Route
  // -------------------------------------------------------------------
  if (currentRoute === 'admin') {
    return (
      <AdminControlPanel
        simulatorState={simulatorState}
        onNavigateToPhasebook={navigateToPhasebook}
        onInjectFailure={handleInjectFailure}
        onResetSystem={handleResetSystem}
        onRunInvestigation={handleRunInvestigation}
        onApproveRemediation={handleApproveRemediation}
        onVerifyRecovery={handleVerifyRecovery}
        onExecuteTool={handleExecuteTool}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans">
      {/* Facebook-style Top Navigation Bar */}
      <PhasebookNav
        simulatorState={simulatorState}
        onNavigateToAdmin={navigateToAdmin}
        notifications={notifications}
        onOpenNotifications={() => {
          fetchNotifications();
          setShowNotificationsModal(!showNotificationsModal);
        }}
        showNotificationsModal={showNotificationsModal}
        onCloseNotifications={() => setShowNotificationsModal(false)}
        notificationError={notificationError}
        onOpenPlusModal={handleOpenPlus}
      />

      {/* Main 3-Column Layout */}
      <div className="max-w-[1920px] mx-auto flex justify-between">
        {/* Left Sidebar */}
        <PhasebookSidebarLeft
          onOpenPlusModal={handleOpenPlus}
          onNavigateToAdmin={navigateToAdmin}
        />

        {/* Center Timeline / Feed */}
        <main className="flex-1 max-w-2xl mx-auto px-2 sm:px-4 py-4 space-y-4">
          {/* Stories Carousel */}
          <PhasebookStories />

          {/* Create Post Component */}
          <PhasebookCreatePost
            onSubmitPost={handleCreatePost}
            isPosting={isPosting}
            postError={postError}
            onClearError={() => setPostError(null)}
          />

          {/* Main Feed Content */}
          <PhasebookFeed
            posts={posts}
            feedError={feedError}
            isLoading={isLoadingFeed}
            onRetryFeed={fetchFeed}
            onLikePost={handleLikePost}
            onCommentPost={handleCommentPost}
            onOpenTipModal={handleOpenTip}
          />
        </main>

        {/* Right Sidebar */}
        <PhasebookSidebarRight onOpenPlusModal={handleOpenPlus} />
      </div>

      {/* Phasebook Plus Checkout Modal (Tests Payment API dependency) */}
      <PhasebookPaymentModal
        isOpen={isPlusModalOpen}
        onClose={() => setIsPlusModalOpen(false)}
        title={plusModalConfig.title}
        amount={plusModalConfig.amount}
      />
    </div>
  );
}
export default App;
