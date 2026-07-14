import { getSession, SessionData } from './session';
import { getDiscordUserGuilds } from './discord-api';

const ADMIN_PERMISSION = BigInt(0x8);
const MANAGE_GUILD_PERMISSION = BigInt(0x20);

/**
 * Checks if the user in the session has permission to manage the guild.
 */
export async function verifyGuildAdmin(session: SessionData | null, guildId: string): Promise<boolean> {
  if (!session) return false;

  try {
    const guilds = await getDiscordUserGuilds(session.accessToken);
    const target = guilds.find((g) => g.id === guildId);

    if (!target) return false;
    if (target.owner) return true;

    const perms = BigInt(target.permissions);
    return (
      (perms & ADMIN_PERMISSION) === ADMIN_PERMISSION ||
      (perms & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION
    );
  } catch (err) {
    console.error('Error verifying guild admin:', err);
    return false;
  }
}
