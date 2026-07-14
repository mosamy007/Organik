import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { getGuildChannels } from '@/lib/discord-api';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId parameter' }, { status: 400 });
  }

  // Authorize admin
  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const channels = await getGuildChannels(guildId);
    return NextResponse.json({ channels });
  } catch (err: any) {
    console.error('Error fetching guild channels:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch channels' }, { status: 500 });
  }
}
