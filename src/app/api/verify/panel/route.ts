import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { sendChannelMessage } from '@/lib/discord-api';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Please log in with Discord first' }, { status: 401 });
  }

  try {
    const { guildId, channelId, title, description, imageUrl } = await req.json();

    if (!guildId || !channelId) {
      return NextResponse.json({ error: 'Missing guildId or channelId' }, { status: 400 });
    }

    // Authorize admin
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appUrl = `${new URL(req.url).origin}`;
    const verifyUrl = `${appUrl}/verify?guildId=${guildId}`;

    const embed: any = {
      title: title || '🔐 Wallet NFT Verification',
      description: description || 'Click the buttons below to verify your NFT holdings and receive your exclusive roles.',
      color: 0x8b5cf6, // Hex code: #8b5cf6 (violet)
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Organik Bot Verification',
      },
    };

    if (imageUrl && imageUrl.trim()) {
      embed.image = { url: imageUrl.trim() };
    }

    const components = [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS (Green)
            label: 'Verify NFT Roles',
            custom_id: 'auto_verify_btn',
            emoji: { name: '🔐' },
          },
          {
            type: 2, // BUTTON
            style: 5, // LINK
            label: 'Link New Wallet',
            url: verifyUrl,
            emoji: { name: '🔗' },
          },
        ],
      },
    ];

    const result = await sendChannelMessage(channelId, '', [embed], components);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error('Verify panel setup error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
