/**
 * @module types
 * @description Core type definitions for the multi-agent architecture.
 */
import { z } from 'zod';

// ─── AI Provider ─────────────────────────────────────────────────────

/** Role a model serves in the pipeline. */
export type AgentRole = 'planner' | 'reviewer' | 'optimizer';

/** A message in a chat completion request. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Options for an AI completion request. */
export interface CompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeout?: number;
}

/** Result from an AI completion. */
export interface CompletionResult {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  cached: boolean;
}

// ─── Action Types ────────────────────────────────────────────────────

export type ActionType =
  | 'CREATE_CATEGORY' | 'EDIT_CATEGORY' | 'DELETE_CATEGORY'
  | 'CREATE_TEXT_CHANNEL' | 'CREATE_VOICE_CHANNEL' | 'CREATE_FORUM_CHANNEL'
  | 'CREATE_ANNOUNCEMENT_CHANNEL' | 'CREATE_STAGE_CHANNEL'
  | 'EDIT_CHANNEL' | 'DELETE_CHANNEL'
  | 'CREATE_ROLE' | 'EDIT_ROLE' | 'DELETE_ROLE'
  | 'SET_PERMISSIONS' | 'SET_CHANNEL_PERMISSIONS'
  | 'MOVE_CHANNEL' | 'SET_ROLE_HIERARCHY'
  | 'CREATE_TICKET_PANEL' | 'SETUP_WELCOME' | 'SETUP_LOGGING';

export interface PlannedAction {
  id: string;
  type: ActionType;
  description: string;
  params: Record<string, unknown>;
  destructive: boolean;
}

// ─── Pipeline Types ──────────────────────────────────────────────────

/** Output of the Planner agent. */
export interface ExecutionPlan {
  summary: string;
  actions: PlannedAction[];
  warnings: string[];
}

/** Output of the Reviewer agent. */
export interface ReviewResult {
  approved: boolean;
  issues: ReviewIssue[];
  suggestions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReviewIssue {
  actionId: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  suggestion?: string;
}

/** Output of the Optimizer agent. */
export interface OptimizedPlan {
  plan: ExecutionPlan;
  optimizations: string[];
  estimatedApiCalls: number;
  estimatedTimeMs: number;
  groupedActions: ActionGroup[];
}

export interface ActionGroup {
  name: string;
  actions: PlannedAction[];
  parallel: boolean;
}

/** Result of executing a single action. */
export interface ActionResult {
  actionId: string;
  type: ActionType;
  success: boolean;
  message: string;
  error?: string;
  createdId?: string; // Discord ID of created resource
}

/** Full pipeline result. */
export interface PipelineResult {
  plan: ExecutionPlan;
  review: ReviewResult;
  optimized: OptimizedPlan;
  results: ActionResult[];
  verification: VerificationResult;
  totalActions: number;
  successCount: number;
  failCount: number;
  executionTimeMs: number;
  tokensUsed: number;
  modelUsed: string;
  undoSnapshotId?: string;
}

/** Output of the Verifier. */
export interface VerificationResult {
  passed: boolean;
  expected: number;
  actual: number;
  discrepancies: VerificationDiscrepancy[];
}

export interface VerificationDiscrepancy {
  actionId: string;
  expected: string;
  actual: string;
}

/** Dry-run report (no execution). */
export interface DryRunReport {
  plan: ExecutionPlan;
  review: ReviewResult;
  optimized: OptimizedPlan;
  warnings: string[];
}

// ─── Server Blueprint (templates & backup) ───────────────────────────

export interface ChannelBlueprint {
  name: string;
  type: 'text' | 'voice' | 'forum' | 'announcement' | 'stage';
  topic?: string;
  nsfw?: boolean;
  slowMode?: number;
  userLimit?: number;
  permissionOverwrites?: PermissionOverwriteBlueprint[];
}

export interface CategoryBlueprint {
  name: string;
  channels: ChannelBlueprint[];
  permissionOverwrites?: PermissionOverwriteBlueprint[];
}

export interface RoleBlueprint {
  name: string;
  color?: string;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string[];
  position?: number;
}

export interface PermissionOverwriteBlueprint {
  target: string;
  type: 'role' | 'member';
  allow?: string[];
  deny?: string[];
}

export interface ServerBlueprint {
  name: string;
  description?: string;
  roles: RoleBlueprint[];
  categories: CategoryBlueprint[];
}

export interface ServerSnapshot {
  guildId: string;
  guildName: string;
  snapshotAt: string;
  roles: RoleBlueprint[];
  categories: CategoryBlueprint[];
}

// ─── Undo ────────────────────────────────────────────────────────────

export interface UndoEntry {
  type: 'created' | 'deleted' | 'modified';
  resourceType: 'channel' | 'role' | 'category' | 'permission';
  resourceId?: string;
  resourceName: string;
  previousState?: Record<string, unknown>;
}

export interface UndoSnapshotData {
  entries: UndoEntry[];
  guildId: string;
  description: string;
}

// ─── Server Analysis ─────────────────────────────────────────────────

export interface ServerHealthReport {
  score: number; // 0-100
  categories: HealthCategory[];
  suggestions: string[];
}

export interface HealthCategory {
  name: string;
  score: number;
  issues: string[];
}

// ─── Zod Schemas ─────────────────────────────────────────────────────

export const ActionTypeSchema = z.enum([
  'CREATE_CATEGORY', 'EDIT_CATEGORY', 'DELETE_CATEGORY',
  'CREATE_TEXT_CHANNEL', 'CREATE_VOICE_CHANNEL', 'CREATE_FORUM_CHANNEL',
  'CREATE_ANNOUNCEMENT_CHANNEL', 'CREATE_STAGE_CHANNEL',
  'EDIT_CHANNEL', 'DELETE_CHANNEL',
  'CREATE_ROLE', 'EDIT_ROLE', 'DELETE_ROLE',
  'SET_PERMISSIONS', 'SET_CHANNEL_PERMISSIONS',
  'MOVE_CHANNEL', 'SET_ROLE_HIERARCHY',
  'CREATE_TICKET_PANEL', 'SETUP_WELCOME', 'SETUP_LOGGING',
]);

export const PlannedActionSchema = z.object({
  id: z.string(),
  type: ActionTypeSchema,
  description: z.string(),
  params: z.record(z.unknown()),
  destructive: z.boolean(),
});

export const ExecutionPlanSchema = z.object({
  summary: z.string(),
  actions: z.array(PlannedActionSchema),
  warnings: z.array(z.string()),
});

export const ReviewResultSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.object({
    actionId: z.string(),
    severity: z.enum(['warning', 'error', 'critical']),
    message: z.string(),
    suggestion: z.string().optional(),
  })),
  suggestions: z.array(z.string()),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
});

export const OptimizedPlanSchema = z.object({
  plan: ExecutionPlanSchema,
  optimizations: z.array(z.string()),
  estimatedApiCalls: z.number(),
  estimatedTimeMs: z.number(),
  groupedActions: z.array(z.object({
    name: z.string(),
    actions: z.array(PlannedActionSchema),
    parallel: z.boolean(),
  })),
});
