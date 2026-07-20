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

  const allowedAdminIds = process.env.ALLOWED_ADMIN_IDS
    ? process.env.ALLOWED_ADMIN_IDS.split(',')
    : [];

  if (!allowedAdminIds.includes(session.discordId)) {
    console.log(`[verifyGuildAdmin] Authorization failed: User "${session.username}" (ID: ${session.discordId}) is not in the allowed admin list.`);
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

/**
 * Diagnostic version of verifyGuildAdmin returning detailed authorization reasons.
 */
export async function checkGuildAdmin(
  session: SessionData | null,
  guildId: string
): Promise<{ authorized: boolean; reason: string }> {
  if (!session) {
    return { authorized: false, reason: 'No active login session. Please log out and log in again.' };
  }

  const allowedAdminIds = process.env.ALLOWED_ADMIN_IDS
    ? process.env.ALLOWED_ADMIN_IDS.split(',')
    : [];

  if (!allowedAdminIds.includes(session.discordId)) {
    return { authorized: false, reason: 'Forbidden: You do not have permission to manage this bot.' };
  }

  try {
    const guilds = await getDiscordUserGuilds(session.accessToken);
    const target = guilds.find((g) => g.id === guildId);

    if (!target) {
      return {
        authorized: false,
        reason: `Your account is not a member of server ${guildId}, or your token lacks permissions. Please try logging out and logging in again to refresh your session.`
      };
    }

    if (target.owner) {
      return { authorized: true, reason: 'Owner' };
    }

    const perms = BigInt(target.permissions);
    const hasAdmin = (perms & ADMIN_PERMISSION) === ADMIN_PERMISSION;
    const hasManage = (perms & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;

    if (hasAdmin || hasManage) {
      return { authorized: true, reason: 'Authorized' };
    }

    return {
      authorized: false,
      reason: `Required permissions missing on server "${target.name}". You need Administrator or Manage Server permissions.`
    };
  } catch (err: any) {
    console.error('[checkGuildAdmin] Error:', err);
    return {
      authorized: false,
      reason: `Failed to fetch Discord server permissions: ${err.message || 'Unknown error'}. Try logging out and back in.`
    };
  }
}
