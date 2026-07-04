/**
 * @module ai/agents/verifier
 * @description Verifier — compares requested state against actual server state after execution.
 */
import { Guild, ChannelType } from 'discord.js';
import { createLogger } from '../../logger.js';
import type { ActionResult, VerificationResult, VerificationDiscrepancy, PlannedAction } from '../../types.js';

const log = createLogger('agent:verifier');

/**
 * Verify that executed actions produced the expected server state.
 */
export async function verifyExecution(
  guild: Guild,
  actions: PlannedAction[],
  results: ActionResult[],
): Promise<VerificationResult> {
  log.info({ guildId: guild.id, actionCount: actions.length }, 'Verifying execution');

  // Refresh the guild cache
  await guild.channels.fetch();
  await guild.roles.fetch();

  const discrepancies: VerificationDiscrepancy[] = [];
  let expected = 0;
  let actual = 0;

  for (const action of actions) {
    const result = results.find((r) => r.actionId === action.id);
    if (!result || !result.success) continue;

    expected++;
    const p = action.params as Record<string, any>;

    switch (action.type) {
      case 'CREATE_CATEGORY': {
        const found = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === p.name.toLowerCase(),
        );
        if (found) { actual++; } else {
          discrepancies.push({ actionId: action.id, expected: `Category "${p.name}" exists`, actual: 'Not found' });
        }
        break;
      }
      case 'CREATE_TEXT_CHANNEL':
      case 'CREATE_VOICE_CHANNEL':
      case 'CREATE_FORUM_CHANNEL':
      case 'CREATE_ANNOUNCEMENT_CHANNEL':
      case 'CREATE_STAGE_CHANNEL': {
        const found = guild.channels.cache.find(
          (c) => c.type !== ChannelType.GuildCategory && c.name.toLowerCase() === p.name.toLowerCase(),
        );
        if (found) { actual++; } else {
          discrepancies.push({ actionId: action.id, expected: `Channel "${p.name}" exists`, actual: 'Not found' });
        }
        break;
      }
      case 'CREATE_ROLE': {
        const found = guild.roles.cache.find((r) => r.name.toLowerCase() === p.name.toLowerCase());
        if (found) { actual++; } else {
          discrepancies.push({ actionId: action.id, expected: `Role "${p.name}" exists`, actual: 'Not found' });
        }
        break;
      }
      case 'DELETE_CHANNEL':
      case 'DELETE_CATEGORY': {
        const found = guild.channels.cache.find((c) => c.name.toLowerCase() === p.name.toLowerCase());
        if (!found) { actual++; } else {
          discrepancies.push({ actionId: action.id, expected: `"${p.name}" deleted`, actual: 'Still exists' });
        }
        break;
      }
      case 'DELETE_ROLE': {
        const found = guild.roles.cache.find((r) => r.name.toLowerCase() === p.name.toLowerCase());
        if (!found) { actual++; } else {
          discrepancies.push({ actionId: action.id, expected: `Role "${p.name}" deleted`, actual: 'Still exists' });
        }
        break;
      }
      default:
        // For edit/permission actions, assume success if API didn't error
        actual++;
    }
  }

  const passed = discrepancies.length === 0;
  log.info({ passed, expected, actual, discrepancies: discrepancies.length }, 'Verification complete');

  return { passed, expected, actual, discrepancies };
}
