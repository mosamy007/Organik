import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { sendChannelMessage } from '@/lib/discord-api';

export async function POST(req: NextRequest) {
  const session = getSession(req);

  try {
    const { guildId, channelId, content, embed } = await req.json();

    if (!guildId || !channelId) {
      return NextResponse.json({ error: 'Missing required parameters: guildId and channelId' }, { status: 400 });
    }

    // Authorize admin
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const embeds = embed ? [embed] : undefined;
    const result = await sendChannelMessage(channelId, content, embeds);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error('Error sending message:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
