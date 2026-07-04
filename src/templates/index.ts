/**
 * @module templates
 * @description Built-in server blueprints for common community types.
 */
import type { ServerBlueprint } from '../types.js';

/** All built-in template names. */
export type TemplateName =
  | 'gaming' | 'study' | 'startup' | 'ai-community' | 'developer'
  | 'business' | 'school' | 'anime' | 'music' | 'creator' | 'open-source';

const gaming: ServerBlueprint = {
  name: 'Gaming Community',
  description: 'A fully-featured gaming server with matchmaking, LFG, and clan channels.',
  roles: [
    { name: 'Admin', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: 'Moderator', color: '#3498DB', hoist: true, permissions: ['ManageMessages', 'KickMembers', 'BanMembers', 'ManageChannels'] },
    { name: 'VIP', color: '#F1C40F', hoist: true },
    { name: 'Member', color: '#2ECC71' },
  ],
  categories: [
    { name: '📢 Information', channels: [
      { name: 'rules', type: 'text', topic: 'Server rules and guidelines' },
      { name: 'announcements', type: 'announcement', topic: 'Important updates' },
      { name: 'roles', type: 'text', topic: 'Get your roles here' },
    ]},
    { name: '💬 General', channels: [
      { name: 'general', type: 'text', topic: 'General chat' },
      { name: 'memes', type: 'text', topic: 'Share your memes' },
      { name: 'media', type: 'text', topic: 'Share clips and screenshots' },
    ]},
    { name: '🎮 Gaming', channels: [
      { name: 'lfg', type: 'text', topic: 'Looking for group' },
      { name: 'game-discussion', type: 'forum', topic: 'Discuss your favorite games' },
      { name: 'clips-and-highlights', type: 'text', topic: 'Share your best moments' },
    ]},
    { name: '🔊 Voice', channels: [
      { name: 'General Voice', type: 'voice' },
      { name: 'Gaming 1', type: 'voice', userLimit: 5 },
      { name: 'Gaming 2', type: 'voice', userLimit: 5 },
      { name: 'AFK', type: 'voice' },
    ]},
    { name: '🛡️ Staff', channels: [
      { name: 'staff-chat', type: 'text', topic: 'Staff discussions' },
      { name: 'mod-log', type: 'text', topic: 'Moderation log' },
    ]},
  ],
};

const study: ServerBlueprint = {
  name: 'Study Group',
  description: 'Collaborative study server with subject channels and focus rooms.',
  roles: [
    { name: 'Professor', color: '#9B59B6', hoist: true, permissions: ['Administrator'] },
    { name: 'Tutor', color: '#3498DB', hoist: true, permissions: ['ManageMessages'] },
    { name: 'Student', color: '#2ECC71' },
  ],
  categories: [
    { name: '📋 Information', channels: [
      { name: 'welcome', type: 'text', topic: 'Welcome and rules' },
      { name: 'resources', type: 'text', topic: 'Study resources and links' },
      { name: 'announcements', type: 'announcement', topic: 'Class announcements' },
    ]},
    { name: '📚 Subjects', channels: [
      { name: 'mathematics', type: 'text' }, { name: 'science', type: 'text' },
      { name: 'english', type: 'text' }, { name: 'history', type: 'text' },
      { name: 'homework-help', type: 'forum', topic: 'Post homework questions' },
    ]},
    { name: '🔇 Focus Rooms', channels: [
      { name: 'Study Room 1', type: 'voice', userLimit: 4 },
      { name: 'Study Room 2', type: 'voice', userLimit: 4 },
      { name: 'Group Project', type: 'voice', userLimit: 8 },
    ]},
  ],
};

const startup: ServerBlueprint = {
  name: 'Startup Hub',
  roles: [
    { name: 'Founder', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: 'Team Lead', color: '#E67E22', hoist: true, permissions: ['ManageChannels', 'ManageMessages'] },
    { name: 'Developer', color: '#3498DB' },
    { name: 'Designer', color: '#9B59B6' },
    { name: 'Marketing', color: '#2ECC71' },
  ],
  categories: [
    { name: '📢 Company', channels: [
      { name: 'announcements', type: 'announcement' }, { name: 'general', type: 'text' },
      { name: 'watercooler', type: 'text', topic: 'Off-topic chat' },
    ]},
    { name: '🔧 Engineering', channels: [
      { name: 'dev-general', type: 'text' }, { name: 'code-review', type: 'forum' },
      { name: 'bugs', type: 'forum' }, { name: 'devops', type: 'text' },
    ]},
    { name: '🎨 Design', channels: [
      { name: 'design-general', type: 'text' }, { name: 'feedback', type: 'forum' },
    ]},
    { name: '📈 Business', channels: [
      { name: 'marketing', type: 'text' }, { name: 'sales', type: 'text' },
      { name: 'metrics', type: 'text' },
    ]},
    { name: '🔊 Meetings', channels: [
      { name: 'Standup', type: 'voice', userLimit: 15 },
      { name: 'Brainstorm', type: 'voice' },
    ]},
  ],
};

const developer: ServerBlueprint = {
  name: 'Developer Community',
  roles: [
    { name: 'Core Team', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: 'Contributor', color: '#E67E22', hoist: true },
    { name: 'Helper', color: '#3498DB', hoist: true },
    { name: 'Developer', color: '#2ECC71' },
  ],
  categories: [
    { name: '📋 Info', channels: [
      { name: 'rules', type: 'text' }, { name: 'announcements', type: 'announcement' },
      { name: 'showcase', type: 'forum', topic: 'Show off your projects' },
    ]},
    { name: '💻 Programming', channels: [
      { name: 'javascript', type: 'text' }, { name: 'python', type: 'text' },
      { name: 'rust', type: 'text' }, { name: 'general-programming', type: 'text' },
      { name: 'help', type: 'forum', topic: 'Ask for help' },
    ]},
    { name: '🛠️ DevOps & Tools', channels: [
      { name: 'devops', type: 'text' }, { name: 'git', type: 'text' },
      { name: 'editors-and-ides', type: 'text' },
    ]},
    { name: '🔊 Voice', channels: [
      { name: 'Pair Programming', type: 'voice', userLimit: 2 },
      { name: 'Code Review', type: 'voice', userLimit: 5 },
      { name: 'General', type: 'voice' },
    ]},
  ],
};

const aiCommunity: ServerBlueprint = {
  name: 'AI Community',
  roles: [
    { name: 'Researcher', color: '#9B59B6', hoist: true, permissions: ['Administrator'] },
    { name: 'Engineer', color: '#3498DB', hoist: true },
    { name: 'Enthusiast', color: '#2ECC71' },
  ],
  categories: [
    { name: '📢 Hub', channels: [
      { name: 'announcements', type: 'announcement' }, { name: 'general', type: 'text' },
      { name: 'introductions', type: 'text' },
    ]},
    { name: '🤖 AI Topics', channels: [
      { name: 'llms', type: 'text' }, { name: 'computer-vision', type: 'text' },
      { name: 'papers', type: 'forum', topic: 'Discuss research papers' },
      { name: 'datasets', type: 'text' }, { name: 'prompt-engineering', type: 'text' },
    ]},
    { name: '🔊 Discussions', channels: [
      { name: 'Paper Review', type: 'stage' },
      { name: 'Office Hours', type: 'voice' },
    ]},
  ],
};

const business: ServerBlueprint = {
  name: 'Business Hub',
  roles: [
    { name: 'Director', color: '#C0392B', hoist: true, permissions: ['Administrator'] },
    { name: 'Manager', color: '#2980B9', hoist: true, permissions: ['ManageMessages', 'ManageChannels'] },
    { name: 'Employee', color: '#27AE60' },
  ],
  categories: [
    { name: '📢 Company', channels: [
      { name: 'announcements', type: 'announcement' }, { name: 'general', type: 'text' },
    ]},
    { name: '💼 Departments', channels: [
      { name: 'finance', type: 'text' }, { name: 'hr', type: 'text' },
      { name: 'operations', type: 'text' }, { name: 'sales', type: 'text' },
    ]},
    { name: '📊 Projects', channels: [
      { name: 'active-projects', type: 'forum' }, { name: 'completed', type: 'text' },
    ]},
    { name: '🔊 Meetings', channels: [
      { name: 'Board Room', type: 'voice', userLimit: 10 },
      { name: 'Conference', type: 'voice' },
    ]},
  ],
};

const school: ServerBlueprint = {
  name: 'School Server',
  roles: [
    { name: 'Teacher', color: '#8E44AD', hoist: true, permissions: ['Administrator'] },
    { name: 'Class Rep', color: '#2980B9', hoist: true },
    { name: 'Student', color: '#27AE60' },
  ],
  categories: [
    { name: '📋 School', channels: [
      { name: 'announcements', type: 'announcement' }, { name: 'calendar', type: 'text' },
      { name: 'rules', type: 'text' },
    ]},
    { name: '📚 Classes', channels: [
      { name: 'math', type: 'text' }, { name: 'science', type: 'text' },
      { name: 'english', type: 'text' }, { name: 'art', type: 'text' },
      { name: 'assignments', type: 'forum' },
    ]},
    { name: '🎉 Social', channels: [
      { name: 'hangout', type: 'text' }, { name: 'clubs', type: 'forum' },
    ]},
    { name: '🔊 Classrooms', channels: [
      { name: 'Classroom 1', type: 'voice' }, { name: 'Classroom 2', type: 'voice' },
      { name: 'Study Hall', type: 'voice', userLimit: 10 },
    ]},
  ],
};

const anime: ServerBlueprint = {
  name: 'Anime Community',
  roles: [
    { name: 'Senpai', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: 'Weeb', color: '#E91E63', hoist: true },
    { name: 'Newcomer', color: '#FF9800' },
  ],
  categories: [
    { name: '📢 Info', channels: [
      { name: 'rules', type: 'text' }, { name: 'announcements', type: 'announcement' },
    ]},
    { name: '🍥 Anime', channels: [
      { name: 'general', type: 'text' }, { name: 'recommendations', type: 'forum' },
      { name: 'seasonal-anime', type: 'text' }, { name: 'manga', type: 'text' },
      { name: 'spoilers', type: 'text', nsfw: false },
    ]},
    { name: '🎨 Creative', channels: [
      { name: 'fan-art', type: 'text' }, { name: 'wallpapers', type: 'text' },
      { name: 'cosplay', type: 'text' },
    ]},
    { name: '🔊 Hangout', channels: [
      { name: 'Watch Party', type: 'voice' }, { name: 'Chill', type: 'voice' },
    ]},
  ],
};

const music: ServerBlueprint = {
  name: 'Music Community',
  roles: [
    { name: 'Producer', color: '#9B59B6', hoist: true, permissions: ['Administrator'] },
    { name: 'Artist', color: '#E91E63', hoist: true },
    { name: 'Listener', color: '#3498DB' },
  ],
  categories: [
    { name: '📢 Info', channels: [
      { name: 'rules', type: 'text' }, { name: 'announcements', type: 'announcement' },
    ]},
    { name: '🎵 Music', channels: [
      { name: 'share-music', type: 'text' }, { name: 'production', type: 'forum' },
      { name: 'feedback', type: 'forum' }, { name: 'collabs', type: 'text' },
    ]},
    { name: '🔊 Sessions', channels: [
      { name: 'Listening Party', type: 'voice' },
      { name: 'Jam Session', type: 'stage' },
      { name: 'Chill Beats', type: 'voice' },
    ]},
  ],
};

const creator: ServerBlueprint = {
  name: 'Content Creator Hub',
  roles: [
    { name: 'Creator', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: 'Editor', color: '#3498DB', hoist: true },
    { name: 'Subscriber', color: '#2ECC71' },
  ],
  categories: [
    { name: '📢 Info', channels: [
      { name: 'announcements', type: 'announcement' }, { name: 'rules', type: 'text' },
    ]},
    { name: '🎬 Content', channels: [
      { name: 'uploads', type: 'text' }, { name: 'behind-the-scenes', type: 'text' },
      { name: 'ideas', type: 'forum' }, { name: 'feedback', type: 'forum' },
    ]},
    { name: '💬 Community', channels: [
      { name: 'general', type: 'text' }, { name: 'fan-art', type: 'text' },
    ]},
    { name: '🔊 Live', channels: [
      { name: 'Live Stream', type: 'stage' }, { name: 'Hangout', type: 'voice' },
    ]},
  ],
};

const openSource: ServerBlueprint = {
  name: 'Open Source Project',
  roles: [
    { name: 'Maintainer', color: '#E74C3C', hoist: true, permissions: ['Administrator'] },
    { name: 'Contributor', color: '#E67E22', hoist: true },
    { name: 'Community', color: '#3498DB' },
  ],
  categories: [
    { name: '📢 Project', channels: [
      { name: 'announcements', type: 'announcement' }, { name: 'releases', type: 'text' },
      { name: 'roadmap', type: 'text' },
    ]},
    { name: '🛠️ Development', channels: [
      { name: 'general', type: 'text' }, { name: 'issues', type: 'forum' },
      { name: 'pull-requests', type: 'text' }, { name: 'rfc', type: 'forum' },
    ]},
    { name: '❓ Support', channels: [
      { name: 'help', type: 'forum' }, { name: 'faq', type: 'text' },
    ]},
    { name: '🔊 Voice', channels: [
      { name: 'Office Hours', type: 'stage' }, { name: 'Pair Programming', type: 'voice', userLimit: 2 },
    ]},
  ],
};

/** Map of all built-in templates. */
export const templates: Record<TemplateName, ServerBlueprint> = {
  gaming, study, startup, 'ai-community': aiCommunity, developer,
  business, school, anime, music, creator, 'open-source': openSource,
};

/** Get list of template names with descriptions. */
export function listTemplates(): { name: TemplateName; description: string }[] {
  return (Object.entries(templates) as [TemplateName, ServerBlueprint][]).map(([key, bp]) => ({
    name: key,
    description: bp.description || bp.name,
  }));
}
