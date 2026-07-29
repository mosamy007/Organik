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
      panelType = 'support',
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

    // Default configuration values depending on panelType
    let defaultTitle = '🎟️ Support & Help Desk';
    let defaultDesc = 'Click the button below to open a private support ticket with our server team.';
    let defaultColor = '#5865f2';

    if (panelType === 'idea') {
      defaultTitle = '💡 Idea & Suggestions Desk';
      defaultDesc = 'Click the button below to open a private idea ticket and share your suggestions with our team!';
      defaultColor = '#facc15';
    } else if (panelType === 'collab') {
      defaultTitle = '🤝 Partnership & Collab Desk';
      defaultDesc = 'Click the button below to open a private collab ticket and propose a partnership with our team!';
      defaultColor = '#3b82f6';
    } else if (panelType === 'all') {
      defaultTitle = '🎟️ Server Support & Request Desk';
      defaultDesc = 'Click a button below to open a support ticket, submit an idea, or propose a collaboration!';
      defaultColor = '#8b5cf6';
    }

    // Save ticket configuration to MongoDB
    const config = {
      guildId,
      channelId,
      staffRoleIds: Array.isArray(staffRoleIds) ? staffRoleIds : [],
      panelType,
      embedTitle: embedTitle || defaultTitle,
      embedDesc: embedDesc || defaultDesc,
      embedColor: embedColor || defaultColor,
      buttonText: buttonText || (panelType === 'collab' ? 'Request Collab' : panelType === 'idea' ? 'Submit Idea' : 'Open Ticket'),
      buttonEmoji: buttonEmoji || (panelType === 'collab' ? '🤝' : panelType === 'idea' ? '💡' : '🎟️'),
      updatedAt: new Date(),
    };

    await db.collection('tickets_config').updateOne(
      { guildId },
      { $set: config },
      { upsert: true }
    );

    // Convert hex color to integer
    const colorInt = parseInt((config.embedColor).replace('#', ''), 16) || 5793010;

    // Construct panel embed
    const embed = {
      title: config.embedTitle,
      description: config.embedDesc,
      color: colorInt,
      footer: { text: 'Organik Bot Ticket System' },
      timestamp: new Date().toISOString(),
    };

    // Construct button components based on panelType
    const buttonComponents: any[] = [];

    if (panelType === 'all') {
      buttonComponents.push({
        type: 2, // Button
        style: 1, // Primary (Blurple)
        custom_id: 'ticket_open',
        label: 'Open Support Ticket',
        emoji: { name: '🎟️' },
      });
      buttonComponents.push({
        type: 2, // Button
        style: 2, // Secondary
        custom_id: 'ticket_idea_open',
        label: 'Submit Idea Ticket',
        emoji: { name: '💡' },
      });
      buttonComponents.push({
        type: 2, // Button
        style: 3, // Success / Green
        custom_id: 'ticket_collab_open',
        label: 'Request Collab Ticket',
        emoji: { name: '🤝' },
      });
    } else if (panelType === 'collab') {
      buttonComponents.push({
        type: 2, // Button
        style: 1, // Primary
        custom_id: 'ticket_collab_open',
        label: config.buttonText || 'Request Collab',
        emoji: config.buttonEmoji ? { name: config.buttonEmoji } : { name: '🤝' },
      });
    } else if (panelType === 'idea') {
      buttonComponents.push({
        type: 2, // Button
        style: 2, // Secondary
        custom_id: 'ticket_idea_open',
        label: config.buttonText || 'Submit Idea',
        emoji: config.buttonEmoji ? { name: config.buttonEmoji } : { name: '💡' },
      });
    } else {
      buttonComponents.push({
        type: 2, // Button
        style: 1, // Primary
        custom_id: 'ticket_open',
        label: config.buttonText || 'Open Ticket',
        emoji: config.buttonEmoji ? { name: config.buttonEmoji } : { name: '🎟️' },
      });
    }

    const components = [
      {
        type: 1, // ActionRow
        components: buttonComponents,
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
