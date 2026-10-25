import {
  PhasebookPost,
  PhasebookStory,
  PhasebookNotification,
  PhasebookUser,
} from '../types';

export const CURRENT_USER: PhasebookUser = {
  id: 'usr_me',
  name: 'Alex Morgan',
  username: 'alexmorgan',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  verified: true,
  role: 'Software Engineer',
};

export const INITIAL_FRIENDS: PhasebookUser[] = [
  {
    id: 'usr_1',
    name: 'Sarah Connor',
    username: 'sarahc',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  {
    id: 'usr_2',
    name: 'David Miller',
    username: 'davidm',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr_3',
    name: 'Elena Rostov',
    username: 'elenar',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    verified: true,
  },
  {
    id: 'usr_4',
    name: 'Marcus Vance',
    username: 'marcusv',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr_5',
    name: 'Chloe Bennett',
    username: 'chloeb',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'usr_6',
    name: 'Lucas Thorne',
    username: 'lucast',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
];

export const INITIAL_STORIES: PhasebookStory[] = [
  {
    id: 'story_1',
    user: INITIAL_FRIENDS[0], // Sarah
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    hasUnseen: true,
  },
  {
    id: 'story_2',
    user: INITIAL_FRIENDS[1], // David
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop&q=80',
    hasUnseen: true,
  },
  {
    id: 'story_3',
    user: INITIAL_FRIENDS[2], // Elena
    image: 'https://images.unsplash.com/photo-1515260268569-9271009adfdb?w=600&auto=format&fit=crop&q=80',
    hasUnseen: false,
  },
  {
    id: 'story_4',
    user: INITIAL_FRIENDS[3], // Marcus
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    hasUnseen: false,
  },
];

export const INITIAL_POSTS: PhasebookPost[] = [
  {
    id: 'post_1',
    author: INITIAL_FRIENDS[0], // Sarah
    timestamp: '25 mins ago',
    content:
      'Excited to announce that our team just deployed the new high-throughput feed architecture! Millisecond query latency across all 5 clusters. Big thanks to the SRE and platform engineering groups for keeping everything resilient! 🚀🎉 #TechLife #DistributedSystems',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
    likes: 84,
    userLiked: false,
    shares: 12,
    comments: [
      {
        id: 'c_1',
        author: INITIAL_FRIENDS[1],
        text: 'Incredible achievement Sarah! The speedup is noticeably instant.',
        timestamp: '18 mins ago',
        likes: 6,
      },
      {
        id: 'c_2',
        author: INITIAL_FRIENDS[2],
        text: 'So proud of this launch! SRE-Zero helped keep the deployment guardrails green.',
        timestamp: '10 mins ago',
        likes: 3,
      },
    ],
  },
  {
    id: 'post_2',
    author: INITIAL_FRIENDS[3], // Marcus
    timestamp: '2 hours ago',
    content:
      'Weekend getaway to Yosemite Valley. Nothing resets the mind like cold mountain air and clear skies. Remember to disconnect and take a breather away from the screens! 🌲🏔️',
    image: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200&auto=format&fit=crop&q=80',
    likes: 142,
    userLiked: true,
    shares: 8,
    comments: [
      {
        id: 'c_3',
        author: INITIAL_FRIENDS[4],
        text: 'Stunning photo Marcus! Which trail did you hike up?',
        timestamp: '1 hour ago',
        likes: 2,
      },
    ],
  },
  {
    id: 'post_3',
    author: {
      id: 'usr_phasebook',
      name: 'Phasebook Official',
      username: 'phasebook',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
      verified: true,
      role: 'Platform',
    },
    timestamp: '5 hours ago',
    content:
      'Introducing Phasebook Plus! You can now tip creators, access custom profile verification, and experience high-priority media streaming. Try tipping a creator or upgrading your account directly in the right sidebar!',
    image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&auto=format&fit=crop&q=80',
    likes: 389,
    userLiked: false,
    shares: 54,
    comments: [
      {
        id: 'c_4',
        author: INITIAL_FRIENDS[2],
        text: 'The payment integration is super fast and smooth! Great job product team.',
        timestamp: '4 hours ago',
        likes: 15,
      },
    ],
  },
  {
    id: 'post_4',
    author: INITIAL_FRIENDS[2], // Elena
    timestamp: 'Yesterday at 7:45 PM',
    content:
      'Working on a new open source observability dashboard for microservices. Who else here loves writing custom eBPF filters? 💻🔍 Let me know your favorite tracing tricks!',
    likes: 67,
    userLiked: false,
    shares: 4,
    comments: [],
  },
];

export const INITIAL_NOTIFICATIONS: PhasebookNotification[] = [
  {
    id: 'notif_1',
    user: INITIAL_FRIENDS[0],
    action: 'liked your post',
    target: '"Excited to share our team update..."',
    timestamp: '5 mins ago',
    read: false,
  },
  {
    id: 'notif_2',
    user: INITIAL_FRIENDS[1],
    action: 'commented on your photo',
    target: '"Great conference weekend!"',
    timestamp: '42 mins ago',
    read: false,
  },
  {
    id: 'notif_3',
    user: INITIAL_FRIENDS[2],
    action: 'invited you to join the group',
    target: 'Cloud & SRE Practitioners',
    timestamp: '2 hours ago',
    read: true,
  },
  {
    id: 'notif_4',
    user: INITIAL_FRIENDS[3],
    action: 'shared your story',
    target: '',
    timestamp: 'Yesterday',
    read: true,
  },
];
