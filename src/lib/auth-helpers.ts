import { getSession, SessionData } from './session';
import { getDiscordUserGuilds } from './discord-api';

const ADMIN_PERMISSION = BigInt(0x8);
const MANAGE_GUILD_PERMISSION = BigInt(0x20);

/**
 * Checks if the user in the session has permission to manage the guild.
 */
export async function verifyGuildAdmin(session: SessionData | null, guildId: string): Promise<boolean> {
  if (!session) {
    console.log('[verifyGuildAdmin] Authorization failed: No session found.');
    return false;
  }

  try {
    const guilds = await getDiscordUserGuilds(session.accessToken);
    const target = guilds.find((g) => g.id === guildId);

    if (!target) {
      console.log(`[verifyGuildAdmin] Authorization failed: User "${session.username}" is not in guild ${guildId} or access token lacks 'guilds' scope. Total guilds returned: ${guilds.length}`);
      return false;
    }

    if (target.owner) {
      console.log(`[verifyGuildAdmin] Authorization success: User "${session.username}" is the owner of guild ${guildId}`);
      return true;
    }

    const perms = BigInt(target.permissions);
    const hasAdmin = (perms & ADMIN_PERMISSION) === ADMIN_PERMISSION;
    const hasManage = (perms & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;

    console.log(`[verifyGuildAdmin] Permissions check for user "${session.username}": hasAdmin=${hasAdmin}, hasManage=${hasManage} (raw permissions: ${target.permissions})`);

    return hasAdmin || hasManage;
  } catch (err) {
    console.error('[verifyGuildAdmin] Error verifying guild admin:', err);
    return false;
  }
}
