import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDiscordUserGuilds, isBotInGuild } from '@/lib/discord-api';

const ADMIN_PERMISSION = BigInt(0x8);
const MANAGE_GUILD_PERMISSION = BigInt(0x20);

export async function GET(req: NextRequest) {
  const session = getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Dynamically update the application URL cache in MongoDB for the Discord bot to read
    const appUrl = `${new URL(req.url).origin}`;
    try {
      const { getDb } = await import('@/lib/mongodb');
      const db = await getDb();
      await db.collection('system_settings').updateOne(
        { _id: 'global_settings' as any },
        { $set: { appUrl, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (dbErr) {
      console.error('Failed to update dynamic appUrl in database:', dbErr);
    }

    const guilds = await getDiscordUserGuilds(session.accessToken);

    // Filter guilds where user is owner or has admin/manage guild permissions
    const adminGuilds = guilds.filter((guild) => {
      if (guild.owner) return true;
      try {
        const perms = BigInt(guild.permissions);
        return (
          (perms & ADMIN_PERMISSION) === ADMIN_PERMISSION ||
          (perms & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION
        );
      } catch (err) {
        return false;
      }
    });

    // Check which guilds the bot is in
    const guildsWithBotStatus = await Promise.all(
      adminGuilds.map(async (guild) => {
        try {
          const inGuild = await isBotInGuild(guild.id);
          return {
            ...guild,
            botInGuild: inGuild,
          };
        } catch {
          return {
            ...guild,
            botInGuild: false,
          };
        }
      })
    );

    return NextResponse.json({ guilds: guildsWithBotStatus });
  } catch (err: any) {
    console.error('Failed to load user guilds:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch guilds' }, { status: 500 });
  }
}
