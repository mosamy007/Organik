import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { checkGuildAdmin } from '@/lib/auth-helpers';
import { getGuildRoles } from '@/lib/discord-api';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId parameter' }, { status: 400 });
  }

  // Authorize admin
  const authCheck = await checkGuildAdmin(session, guildId);
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.reason }, { status: 403 });
  }

  try {
    const roles = await getGuildRoles(guildId);
    // Filter out @everyone role or keep it but mark it, standard is to filter out managed/integration roles if they can't be assigned
    return NextResponse.json({ roles });
  } catch (err: any) {
    console.error('Error fetching guild roles:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch roles' }, { status: 500 });
  }
}
