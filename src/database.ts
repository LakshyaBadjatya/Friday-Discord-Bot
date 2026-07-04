import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { createLogger } from './logger.js';

export interface GuildSettings {
  id: string;
  guildId: string;
  aiControlChannelId: string | null;
  aiLogChannelId: string | null;
  aiErrorLogChannelId: string | null;
  aiNotifyChannelId: string | null;
  allowedRoleIds: string | null;
  allowedUserIds: string | null;
  confirmationMode: boolean;
  dryRunMode: boolean;
  aiReviewerEnabled: boolean;
  autoBackupEnabled: boolean;
  aiModel: string;
  plannerModel: string | null;
  reviewerModel: string | null;
  optimizerModel: string | null;
  serverLanguage: string;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  goodbyeMessage: string | null;
  autoRoleIds: string | null;
  logChannelId: string | null;
  ticketCategoryId: string | null;
  ticketLogChannelId: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface ActionLog {
  id: string;
  guildId: string;
  userId: string;
  userName: string;
  action: string;
  originalPrompt?: string | null;
  executionPlan?: string | null;
  aiResponse?: string | null;
  apiActions?: string | null;
  details: string;
  status?: string;
  executionTimeMs?: number | null;
  modelUsed?: string | null;
  tokensUsed?: number | null;
  undoSnapshotId?: string | null;
  createdAt?: any;
}

export interface UndoSnapshot {
  id: string;
  guildId: string;
  actionLogId?: string | null;
  description: string;
  snapshot: string;
  undone: boolean;
  createdAt: any;
}

export interface ServerBackup {
  id: string;
  guildId: string;
  name: string;
  data: string;
  trigger: string;
  createdBy: string;
  createdAt: any;
}

export interface Ticket {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  userName: string;
  subject?: string;
  status?: string;
  transcript?: string | null;
  closedBy?: string | null;
  closedAt?: any | null;
  createdAt: any;
  updatedAt: any;
}

export interface TicketPanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description: string;
  createdAt: any;
}

export interface ResponseCache {
  id: string;
  cacheKey: string;
  response: string;
  model: string;
  expiresAt: any;
  createdAt: any;
}

const log = createLogger('database');

const COLLECTIONS = {
  GUILD_SETTINGS: 'guildSettings',
  ACTION_LOGS: 'actionLogs',
  UNDO_SNAPSHOTS: 'undoSnapshots',
  SERVER_BACKUPS: 'serverBackups',
  TICKETS: 'tickets',
  TICKET_PANELS: 'ticketPanels',
  RESPONSE_CACHE: 'responseCache',
} as const;

function docToData<T>(snap: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T;
}

export const prisma = {
  guildSettings: {
    async findUnique(args: { where: { guildId: string } }): Promise<GuildSettings | null> {
      const snapshot = await db.collection(COLLECTIONS.GUILD_SETTINGS)
        .where('guildId', '==', args.where.guildId)
        .limit(1).get();
      if (snapshot.empty) return null;
      return docToData<GuildSettings>(snapshot.docs[0]);
    },
    async upsert(args: { where: { guildId: string }, update: Partial<GuildSettings>, create: any }): Promise<GuildSettings> {
      const existing = await this.findUnique({ where: { guildId: args.where.guildId } });
      if (existing) {
        await db.collection(COLLECTIONS.GUILD_SETTINGS).doc(existing.id).update({
          ...args.update,
          updatedAt: Timestamp.now(),
        });
        return { ...existing, ...args.update } as GuildSettings;
      } else {
        const ref = await db.collection(COLLECTIONS.GUILD_SETTINGS).add({
          confirmationMode: true,
          dryRunMode: false,
          aiReviewerEnabled: true,
          autoBackupEnabled: true,
          aiModel: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
          serverLanguage: "en",
          ...args.create,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        const snap = await ref.get();
        return docToData<GuildSettings>(snap)!;
      }
    }
  },

  actionLog: {
    async create(args: { data: Omit<ActionLog, 'id' | 'createdAt'> }): Promise<ActionLog> {
      const ref = await db.collection(COLLECTIONS.ACTION_LOGS).add({
        status: 'SUCCESS',
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await ref.get();
      return docToData<ActionLog>(snap)!;
    },
    async findMany(args: { where?: { guildId: string }, orderBy?: any, take?: number }): Promise<ActionLog[]> {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ACTION_LOGS);
      if (args.where?.guildId) query = query.where('guildId', '==', args.where.guildId);
      if (args.orderBy?.createdAt) query = query.orderBy('createdAt', args.orderBy.createdAt);
      if (args.take) query = query.limit(args.take);
      const snapshot = await query.get();
      return snapshot.docs.map(d => docToData<ActionLog>(d)!);
    },
    async findUnique(args: { where: { id: string } }): Promise<ActionLog | null> {
      const snap = await db.collection(COLLECTIONS.ACTION_LOGS).doc(args.where.id).get();
      return docToData<ActionLog>(snap);
    }
  },

  undoSnapshot: {
    async create(args: { data: Omit<UndoSnapshot, 'id' | 'createdAt' | 'undone'> }): Promise<UndoSnapshot> {
      const ref = await db.collection(COLLECTIONS.UNDO_SNAPSHOTS).add({
        ...args.data,
        undone: false,
        createdAt: Timestamp.now(),
      });
      const snap = await ref.get();
      return docToData<UndoSnapshot>(snap)!;
    },
    async findUnique(args: { where: { id: string } }): Promise<UndoSnapshot | null> {
      const snap = await db.collection(COLLECTIONS.UNDO_SNAPSHOTS).doc(args.where.id).get();
      return docToData<UndoSnapshot>(snap);
    },
    async update(args: { where: { id: string }, data: Partial<UndoSnapshot> }): Promise<UndoSnapshot> {
      const ref = db.collection(COLLECTIONS.UNDO_SNAPSHOTS).doc(args.where.id);
      await ref.update(args.data);
      const snap = await ref.get();
      return docToData<UndoSnapshot>(snap)!;
    },
    async findMany(args: { where?: any, orderBy?: any, take?: number }): Promise<UndoSnapshot[]> {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.UNDO_SNAPSHOTS);
      if (args.where?.guildId) query = query.where('guildId', '==', args.where.guildId);
      if (args.where?.actionLogId) query = query.where('actionLogId', '==', args.where.actionLogId);
      if (args.where?.undone !== undefined) query = query.where('undone', '==', args.where.undone);
      if (args.orderBy?.createdAt) query = query.orderBy('createdAt', args.orderBy.createdAt);
      if (args.take) query = query.limit(args.take);
      const snapshot = await query.get();
      return snapshot.docs.map(d => docToData<UndoSnapshot>(d)!);
    }
  },

  serverBackup: {
    async create(args: { data: Omit<ServerBackup, 'id' | 'createdAt'> }): Promise<ServerBackup> {
      const ref = await db.collection(COLLECTIONS.SERVER_BACKUPS).add({
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await ref.get();
      return docToData<ServerBackup>(snap)!;
    },
    async findMany(args: { where: { guildId: string }, orderBy?: any, take?: number }): Promise<ServerBackup[]> {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.SERVER_BACKUPS)
        .where('guildId', '==', args.where.guildId);
      if (args.orderBy?.createdAt) query = query.orderBy('createdAt', args.orderBy.createdAt);
      if (args.take) query = query.limit(args.take);
      const snapshot = await query.get();
      return snapshot.docs.map(d => docToData<ServerBackup>(d)!);
    },
    async findUnique(args: { where: { id: string } }): Promise<ServerBackup | null> {
      const snap = await db.collection(COLLECTIONS.SERVER_BACKUPS).doc(args.where.id).get();
      return docToData<ServerBackup>(snap);
    }
  },

  responseCache: {
    async findUnique(args: { where: { cacheKey: string } }): Promise<ResponseCache | null> {
      const snapshot = await db.collection(COLLECTIONS.RESPONSE_CACHE)
        .where('cacheKey', '==', args.where.cacheKey)
        .limit(1).get();
      if (snapshot.empty) return null;
      return docToData<ResponseCache>(snapshot.docs[0]);
    },
    async create(args: { data: Omit<ResponseCache, 'id' | 'createdAt'> }): Promise<ResponseCache> {
      const ref = await db.collection(COLLECTIONS.RESPONSE_CACHE).add({
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await ref.get();
      return docToData<ResponseCache>(snap)!;
    },
    async upsert(args: { where: { cacheKey: string }, update: any, create: any }): Promise<ResponseCache> {
      const existing = await this.findUnique({ where: { cacheKey: args.where.cacheKey } });
      if (existing) {
        await db.collection(COLLECTIONS.RESPONSE_CACHE).doc(existing.id).update(args.update);
        return { ...existing, ...args.update } as ResponseCache;
      } else {
        const ref = await db.collection(COLLECTIONS.RESPONSE_CACHE).add({
          ...args.create,
          createdAt: Timestamp.now(),
        });
        const snap = await ref.get();
        return docToData<ResponseCache>(snap)!;
      }
    }
  },

  ticketPanel: {
    async create(args: { data: Omit<TicketPanel, 'id' | 'createdAt'> }): Promise<TicketPanel> {
      const ref = await db.collection(COLLECTIONS.TICKET_PANELS).add({
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await ref.get();
      return docToData<TicketPanel>(snap)!;
    },
    async findUnique(args: { where: { messageId: string } }): Promise<TicketPanel | null> {
      const snapshot = await db.collection(COLLECTIONS.TICKET_PANELS)
        .where('messageId', '==', args.where.messageId)
        .limit(1).get();
      if (snapshot.empty) return null;
      return docToData<TicketPanel>(snapshot.docs[0]);
    }
  },

  ticket: {
    async create(args: { data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'> }): Promise<Ticket> {
      const ref = await db.collection(COLLECTIONS.TICKETS).add({
        ...args.data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const snap = await ref.get();
      return docToData<Ticket>(snap)!;
    },
    async findUnique(args: { where: { channelId: string } }): Promise<Ticket | null> {
      const snapshot = await db.collection(COLLECTIONS.TICKETS)
        .where('channelId', '==', args.where.channelId)
        .limit(1).get();
      if (snapshot.empty) return null;
      return docToData<Ticket>(snapshot.docs[0]);
    },
    async findFirst(args: { where: any, orderBy?: any }): Promise<Ticket | null> {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.TICKETS);
      if (args.where?.channelId) query = query.where('channelId', '==', args.where.channelId);
      if (args.where?.status) query = query.where('status', '==', args.where.status);
      if (args.orderBy?.createdAt) query = query.orderBy('createdAt', args.orderBy.createdAt);
      query = query.limit(1);
      const snapshot = await query.get();
      if (snapshot.empty) return null;
      return docToData<Ticket>(snapshot.docs[0]);
    },
    async update(args: { where: { id: string }, data: Partial<Ticket> }): Promise<Ticket> {
      const ref = db.collection(COLLECTIONS.TICKETS).doc(args.where.id);
      await ref.update({ ...args.data, updatedAt: Timestamp.now() });
      const snap = await ref.get();
      return docToData<Ticket>(snap)!;
    }
  }
};

export async function connectDatabase(): Promise<void> {
  log.info('Firebase database connected (admin SDK)');
}

export async function disconnectDatabase(): Promise<void> {
  log.info('Firebase database disconnected');
}
