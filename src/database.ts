/**
 * @module database
 * @description Firebase Firestore database models and repositories that replace Prisma.
 */
import { 
  collection, doc, getDoc, getDocs, updateDoc, 
  deleteDoc, query, where, orderBy, limit, Timestamp, addDoc
} from 'firebase/firestore';
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

// ─── Collections ────────────────────────────────────────────────────────
const COLLECTIONS = {
  GUILD_SETTINGS: 'guildSettings',
  ACTION_LOGS: 'actionLogs',
  UNDO_SNAPSHOTS: 'undoSnapshots',
  SERVER_BACKUPS: 'serverBackups',
  TICKETS: 'tickets',
  TICKET_PANELS: 'ticketPanels',
  RESPONSE_CACHE: 'responseCache',
} as const;

// ─── Prisma-Compatible Firebase Adapter ─────────────────────────────────

export const prisma = {
  guildSettings: {
    async findUnique(args: { where: { guildId: string } }): Promise<GuildSettings | null> {
      const q = query(collection(db, COLLECTIONS.GUILD_SETTINGS), where('guildId', '==', args.where.guildId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as GuildSettings;
    },
    async upsert(args: { where: { guildId: string }, update: Partial<GuildSettings>, create: any }): Promise<GuildSettings> {
      const existing = await this.findUnique({ where: { guildId: args.where.guildId } });
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.GUILD_SETTINGS, existing.id), {
          ...args.update,
          updatedAt: Timestamp.now(),
        });
        return { ...existing, ...args.update } as GuildSettings;
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.GUILD_SETTINGS), {
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
        const snap = await getDoc(ref);
        return { id: ref.id, ...snap.data() } as GuildSettings;
      }
    }
  },

  actionLog: {
    async create(args: { data: Omit<ActionLog, 'id' | 'createdAt'> }): Promise<ActionLog> {
      const ref = await addDoc(collection(db, COLLECTIONS.ACTION_LOGS), {
        status: 'SUCCESS',
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: ref.id, ...snap.data() } as ActionLog;
    },
    async findMany(args: { where?: { guildId: string }, orderBy?: any, take?: number }): Promise<ActionLog[]> {
      let q = query(collection(db, COLLECTIONS.ACTION_LOGS));
      if (args.where?.guildId) q = query(q, where('guildId', '==', args.where.guildId));
      if (args.orderBy?.createdAt) {
        q = query(q, orderBy('createdAt', args.orderBy.createdAt));
      }
      if (args.take) q = query(q, limit(args.take));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActionLog));
    },
    async findUnique(args: { where: { id: string } }): Promise<ActionLog | null> {
      const snap = await getDoc(doc(db, COLLECTIONS.ACTION_LOGS, args.where.id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ActionLog;
    }
  },

  undoSnapshot: {
    async create(args: { data: Omit<UndoSnapshot, 'id' | 'createdAt' | 'undone'> }): Promise<UndoSnapshot> {
      const ref = await addDoc(collection(db, COLLECTIONS.UNDO_SNAPSHOTS), {
        ...args.data,
        undone: false,
        createdAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: ref.id, ...snap.data() } as UndoSnapshot;
    },
    async findUnique(args: { where: { id: string } }): Promise<UndoSnapshot | null> {
      const snap = await getDoc(doc(db, COLLECTIONS.UNDO_SNAPSHOTS, args.where.id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as UndoSnapshot;
    },
    async update(args: { where: { id: string }, data: Partial<UndoSnapshot> }): Promise<UndoSnapshot> {
      const ref = doc(db, COLLECTIONS.UNDO_SNAPSHOTS, args.where.id);
      await updateDoc(ref, args.data);
      const snap = await getDoc(ref);
      return { id: snap.id, ...snap.data() } as UndoSnapshot;
    },
    async findMany(args: { where?: any, orderBy?: any, take?: number }): Promise<UndoSnapshot[]> {
      let q = query(collection(db, COLLECTIONS.UNDO_SNAPSHOTS));
      if (args.where?.guildId) q = query(q, where('guildId', '==', args.where.guildId));
      if (args.where?.actionLogId) q = query(q, where('actionLogId', '==', args.where.actionLogId));
      if (args.where?.undone !== undefined) q = query(q, where('undone', '==', args.where.undone));
      if (args.orderBy?.createdAt) q = query(q, orderBy('createdAt', args.orderBy.createdAt));
      if (args.take) q = query(q, limit(args.take));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UndoSnapshot));
    }
  },

  serverBackup: {
    async create(args: { data: Omit<ServerBackup, 'id' | 'createdAt'> }): Promise<ServerBackup> {
      const ref = await addDoc(collection(db, COLLECTIONS.SERVER_BACKUPS), {
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: ref.id, ...snap.data() } as ServerBackup;
    },
    async findMany(args: { where: { guildId: string }, orderBy?: any, take?: number }): Promise<ServerBackup[]> {
      let q = query(collection(db, COLLECTIONS.SERVER_BACKUPS), where('guildId', '==', args.where.guildId));
      if (args.orderBy?.createdAt) q = query(q, orderBy('createdAt', args.orderBy.createdAt));
      if (args.take) q = query(q, limit(args.take));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ServerBackup));
    },
    async findUnique(args: { where: { id: string } }): Promise<ServerBackup | null> {
      const snap = await getDoc(doc(db, COLLECTIONS.SERVER_BACKUPS, args.where.id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ServerBackup;
    }
  },

  responseCache: {
    async findUnique(args: { where: { cacheKey: string } }): Promise<ResponseCache | null> {
      const q = query(collection(db, COLLECTIONS.RESPONSE_CACHE), where('cacheKey', '==', args.where.cacheKey));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ResponseCache;
    },
    async create(args: { data: Omit<ResponseCache, 'id' | 'createdAt'> }): Promise<ResponseCache> {
      const ref = await addDoc(collection(db, COLLECTIONS.RESPONSE_CACHE), {
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: ref.id, ...snap.data() } as ResponseCache;
    },
    async upsert(args: { where: { cacheKey: string }, update: any, create: any }): Promise<ResponseCache> {
      const existing = await this.findUnique({ where: { cacheKey: args.where.cacheKey } });
      if (existing) {
        await updateDoc(doc(db, COLLECTIONS.RESPONSE_CACHE, existing.id), args.update);
        return { ...existing, ...args.update } as ResponseCache;
      } else {
        const ref = await addDoc(collection(db, COLLECTIONS.RESPONSE_CACHE), {
          ...args.create,
          createdAt: Timestamp.now(),
        });
        const snap = await getDoc(ref);
        return { id: ref.id, ...snap.data() } as ResponseCache;
      }
    }
  },
  
  ticketPanel: {
    async create(args: { data: Omit<TicketPanel, 'id' | 'createdAt'> }): Promise<TicketPanel> {
      const ref = await addDoc(collection(db, COLLECTIONS.TICKET_PANELS), {
        ...args.data,
        createdAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: ref.id, ...snap.data() } as TicketPanel;
    },
    async findUnique(args: { where: { messageId: string } }): Promise<TicketPanel | null> {
      const q = query(collection(db, COLLECTIONS.TICKET_PANELS), where('messageId', '==', args.where.messageId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TicketPanel;
    }
  },

  ticket: {
    async create(args: { data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'> }): Promise<Ticket> {
      const ref = await addDoc(collection(db, COLLECTIONS.TICKETS), {
        ...args.data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: ref.id, ...snap.data() } as Ticket;
    },
    async findUnique(args: { where: { channelId: string } }): Promise<Ticket | null> {
      const q = query(collection(db, COLLECTIONS.TICKETS), where('channelId', '==', args.where.channelId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ticket;
    },
    async findFirst(args: { where: any, orderBy?: any }): Promise<Ticket | null> {
      let q = query(collection(db, COLLECTIONS.TICKETS));
      if (args.where?.channelId) q = query(q, where('channelId', '==', args.where.channelId));
      if (args.where?.status) q = query(q, where('status', '==', args.where.status));
      if (args.orderBy?.createdAt) q = query(q, orderBy('createdAt', args.orderBy.createdAt));
      q = query(q, limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ticket;
    },
    async update(args: { where: { id: string }, data: Partial<Ticket> }): Promise<Ticket> {
      const ref = doc(db, COLLECTIONS.TICKETS, args.where.id);
      await updateDoc(ref, {
        ...args.data,
        updatedAt: Timestamp.now(),
      });
      const snap = await getDoc(ref);
      return { id: snap.id, ...snap.data() } as Ticket;
    }
  }
};

/** Connect to the database. */
export async function connectDatabase(): Promise<void> {
  log.info('Firebase database connected');
}

/** Disconnect from the database. */
export async function disconnectDatabase(): Promise<void> {
  log.info('Firebase database disconnected');
}
