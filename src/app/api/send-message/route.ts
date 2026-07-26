import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { sendChannelMessage } from '@/lib/discord-api';

export async function POST(req: NextRequest) {
  const session = getSession(req);

  try {
    const { guildId, channelId, content, embed, buttons } = await req.json();

    if (!guildId || !channelId) {
      return NextResponse.json({ error: 'Missing required parameters: guildId and channelId' }, { status: 400 });
    }

    // Authorize admin
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const embeds = embed ? [embed] : undefined;

    let components: any[] | undefined = undefined;
    if (Array.isArray(buttons) && buttons.length > 0) {
      const buttonComponents = buttons.map((b: any, index: number) => {
        const styleMap: Record<string, number> = {
          primary: 1,
          secondary: 2,
          success: 3,
          danger: 4,
          link: 5,
        };
        const styleNum = styleMap[b.style] || (b.url ? 5 : 1);
        const btnObj: any = {
          type: 2,
          style: styleNum,
          label: b.label || 'Button',
        };
        if (styleNum === 5) {
          btnObj.url = b.url || 'https://discord.com';
        } else {
          btnObj.custom_id = b.customId || `custom_btn_${index}_${Date.now()}`;
        }
        if (b.emoji) {
          btnObj.emoji = { name: b.emoji };
        }
        return btnObj;
      });

      components = [
        {
          type: 1, // ActionRow
          components: buttonComponents,
        },
      ];
    }

    const result = await sendChannelMessage(channelId, content, embeds, components);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error('Error sending message:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
