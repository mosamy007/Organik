import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { sendChannelMessage } from '@/lib/discord-api';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId parameter' }, { status: 400 });
  }

  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getDb();
    const config = await db.collection('tickets_config').findOne({ guildId });
    return NextResponse.json({ config: config || null });
  } catch (err: any) {
    console.error('Error fetching tickets config:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);

  try {
    const {
      guildId,
      channelId,
      staffRoleIds,
      embedTitle,
      embedDesc,
      embedColor,
      buttonText,
      buttonEmoji,
    } = await req.json();

    if (!guildId || !channelId) {
      return NextResponse.json({ error: 'Missing required parameters: guildId and channelId' }, { status: 400 });
    }

    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();

    // Save ticket configuration to MongoDB
    const config = {
      guildId,
      channelId,
      staffRoleIds: Array.isArray(staffRoleIds) ? staffRoleIds : [],
      embedTitle: embedTitle || '?? Support & Help Desk',
      embedDesc: embedDesc || 'Click the button below to open a private support ticket with our server team.',
      embedColor: embedColor || '#5865f2',
      buttonText: buttonText || 'Open Ticket',
      buttonEmoji: buttonEmoji || '??',
      updatedAt: new Date(),
    };

    await db.collection('tickets_config').updateOne(
      { guildId },
      { $set: config },
      { upsert: true }
    );

    // Convert hex color to integer
    const colorInt = parseInt((embedColor || '#5865f2').replace('#', ''), 16) || 5793010;

    // Construct panel embed
    const embed = {
      title: config.embedTitle,
      description: config.embedDesc,
      color: colorInt,
      footer: { text: 'Organik Bot Support System' },
      timestamp: new Date().toISOString(),
    };

    // Construct button component
    const components = [
      {
        type: 1, // ActionRow
        components: [
          {
            type: 2, // Button
            style: 1, // Primary (Blurple)
            custom_id: 'ticket_open',
            label: config.buttonText,
            emoji: config.buttonEmoji ? { name: config.buttonEmoji } : { name: '??' },
          },
        ],
      },
    ];

    const result = await sendChannelMessage(channelId, '', [embed], components);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to post ticket panel' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error('Error deploying ticket panel:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
