import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { getChannelMessage, editChannelMessage, sendChannelMessage } from '@/lib/discord-api';

function normalizeUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }
  return trimmed;
}

export function extractImageUrlFromText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const m1 = text.match(/https?:\/\/[^\s<>\'\"]+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<>\'\"]*)?/i);
  if (m1) return m1[0];
  const m2 = text.match(/https?:\/\/i\.postimg\.cc\/[^\s<>\'\"]+/i);
  if (m2) return m2[0];
  const m3 = text.match(/https?:\/\/postimg\.cc\/[^\s<>\'\"]+/i);
  if (m3) return m3[0];
  const m4 = text.match(/https?:\/\/(?:i\.)?imgur\.com\/[^\s<>\'\"]+/i);
  if (m4) return m4[0];
  return undefined;
}

export function normalizeImageUrl(rawUrl: string | undefined | null): string | undefined {
  if (!rawUrl) return undefined;
  let trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }
  const postimgMatch = trimmed.match(/^https?:\/\/postimg\.cc\/([a-zA-Z0-9]+)$/);
  if (postimgMatch) {
    trimmed = `https://i.postimg.cc/${postimgMatch[1]}/image.png`;
  }
  const imgurMatch = trimmed.match(/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/);
  if (imgurMatch) {
    trimmed = `https://i.imgur.com/${imgurMatch[1]}.png`;
  }
  return trimmed;
}

export function processEmbed(embed: any): any {
  if (!embed) return undefined;
  const cleanEmbed = { ...embed };

  if (cleanEmbed.image) {
    const rawImg = typeof cleanEmbed.image === 'string' ? cleanEmbed.image : cleanEmbed.image.url;
    const norm = normalizeImageUrl(rawImg);
    if (norm) {
      cleanEmbed.image = { url: norm };
    } else {
      delete cleanEmbed.image;
    }
  }

  if (cleanEmbed.thumbnail) {
    const rawThumb = typeof cleanEmbed.thumbnail === 'string' ? cleanEmbed.thumbnail : cleanEmbed.thumbnail.url;
    const norm = normalizeImageUrl(rawThumb);
    if (norm) {
      cleanEmbed.thumbnail = { url: norm };
    } else {
      delete cleanEmbed.thumbnail;
    }
  }

  // Discord UI Client Requirement:
  // An embed without title, description, or author is hidden by Discord's client UI.
  // If title & description are empty, anchor with an invisible zero-width space ('\u200b').
  if (!cleanEmbed.title && !cleanEmbed.description && (cleanEmbed.image || cleanEmbed.thumbnail)) {
    cleanEmbed.description = '\u200b';
  }

  return cleanEmbed;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');
  const channelId = searchParams.get('channelId');
  const messageId = searchParams.get('messageId');

  if (!guildId || !channelId || !messageId) {
    return NextResponse.json({ error: 'Missing required parameters: guildId, channelId, and messageId' }, { status: 400 });
  }

  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await getChannelMessage(channelId, messageId);
    if (!result.success || !result.message) {
      return NextResponse.json({ error: result.error || 'Message not found' }, { status: 404 });
    }

    const msg = result.message;

    // Parse buttons from Discord components
    const buttons: any[] = [];
    if (Array.isArray(msg.components)) {
      for (const row of msg.components) {
        if (row.type === 1 && Array.isArray(row.components)) {
          for (const btn of row.components) {
            if (btn.type === 2) {
              let styleName = 'primary';
              if (btn.style === 2) styleName = 'secondary';
              if (btn.style === 3) styleName = 'success';
              if (btn.style === 4) styleName = 'danger';
              if (btn.style === 5) styleName = 'link';

              let urlVal = btn.url || '';
              if (btn.custom_id && btn.custom_id.startsWith('url_click:')) {
                urlVal = btn.custom_id.replace('url_click:', '');
              }

              buttons.push({
                id: btn.id || btn.custom_id || Date.now().toString() + Math.random(),
                label: btn.label || '',
                style: styleName,
                url: urlVal,
                emoji: btn.emoji?.name || '',
              });
            }
          }
        }
      }
    }

    // Parse embed if present
    let embedObj: any = null;
    if (Array.isArray(msg.embeds) && msg.embeds.length > 0) {
      const e = msg.embeds[0];
      const hexColor = e.color ? `#${e.color.toString(16).padStart(6, '0')}` : '#5865f2';
      embedObj = {
        title: e.title || '',
        description: e.description || '',
        color: hexColor,
        footer: e.footer?.text || '',
        thumbnail: e.thumbnail?.url || '',
        image: e.image?.url || '',
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        msgMode: embedObj ? 'embed' : 'text',
        textContent: msg.content || '',
        embed: embedObj,
        buttons,
      },
    });
  } catch (err: any) {
    console.error('Error fetching message:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

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

    let finalEmbed = embed ? { ...embed } : undefined;
    const detectedImg = extractImageUrlFromText(content) || extractImageUrlFromText(finalEmbed?.description);
    if (detectedImg) {
      if (!finalEmbed) {
        finalEmbed = { color: 0x5865f2, image: { url: detectedImg } };
      } else if (!finalEmbed.image || !finalEmbed.image.url) {
        finalEmbed.image = { url: detectedImg };
      }
    }

    const processedEmbed = processEmbed(finalEmbed);
    const embeds = processedEmbed ? [processedEmbed] : undefined;

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
        const cleanUrl = normalizeUrl(b.url);
        const hasUrl = Boolean(cleanUrl);
        const styleNum = styleMap[b.style] || (b.style === 'link' ? 5 : 1);

        const btnObj: any = {
          type: 2,
          style: styleNum,
          label: b.label || 'Button',
        };

        if (styleNum === 5) {
          btnObj.url = hasUrl ? cleanUrl : 'https://organikbot.com';
        } else {
          if (hasUrl) {
            // Encode target URL into custom_id so the bot can respond with the link upon click
            btnObj.custom_id = `url_click:${cleanUrl}`;
          } else {
            btnObj.custom_id = b.customId || `custom_action_btn_${index}_${Date.now()}`;
          }
        }

        if (b.emoji && b.emoji.trim()) {
          btnObj.emoji = { name: b.emoji.trim() };
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

export async function PATCH(req: NextRequest) {
  const session = getSession(req);

  try {
    const { guildId, channelId, messageId, content, embed, buttons } = await req.json();

    if (!guildId || !channelId || !messageId) {
      return NextResponse.json({ error: 'Missing required parameters: guildId, channelId, and messageId' }, { status: 400 });
    }

    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let finalEmbed = embed ? { ...embed } : undefined;
    const detectedImg = extractImageUrlFromText(content) || extractImageUrlFromText(finalEmbed?.description);
    if (detectedImg) {
      if (!finalEmbed) {
        finalEmbed = { color: 0x5865f2, image: { url: detectedImg } };
      } else if (!finalEmbed.image || !finalEmbed.image.url) {
        finalEmbed.image = { url: detectedImg };
      }
    }

    const processedEmbed = processEmbed(finalEmbed);
    const embeds = processedEmbed ? [processedEmbed] : undefined;

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
        const cleanUrl = normalizeUrl(b.url);
        const hasUrl = Boolean(cleanUrl);
        const styleNum = styleMap[b.style] || (b.style === 'link' ? 5 : 1);

        const btnObj: any = {
          type: 2,
          style: styleNum,
          label: b.label || 'Button',
        };

        if (styleNum === 5) {
          btnObj.url = hasUrl ? cleanUrl : 'https://organikbot.com';
        } else {
          if (hasUrl) {
            btnObj.custom_id = `url_click:${cleanUrl}`;
          } else {
            btnObj.custom_id = b.customId || `custom_action_btn_${index}_${Date.now()}`;
          }
        }

        if (b.emoji && b.emoji.trim()) {
          btnObj.emoji = { name: b.emoji.trim() };
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

    const result = await editChannelMessage(channelId, messageId, content, embeds, components);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to edit message' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error('Error editing message:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
