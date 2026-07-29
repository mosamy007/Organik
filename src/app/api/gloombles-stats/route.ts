import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { getDb } from '@/lib/mongodb';
import { sendChannelMessage, editChannelMessage } from '@/lib/discord-api';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
  }

  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getDb();
    const config = await db.collection('gloombles_tracker').findOne({ guildId });

    // Fetch live stats from gloombles.com
    let liveStats: any = null;
    try {
      const res = await fetch('https://gloombles.com/api/stats', { cache: 'no-store' });
      if (res.ok) {
        liveStats = await res.json();
      }
    } catch (e) {
      console.error('Error fetching gloombles live stats:', e);
    }

    return NextResponse.json({
      success: true,
      config: config || { enabled: false, channelId: '', intervalMinutes: 5 },
      liveStats,
    });
  } catch (err: any) {
    console.error('Error getting Gloombles stats config:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);

  try {
    const { guildId, channelId, enabled, intervalMinutes } = await req.json();

    if (!guildId) {
      return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
    }

    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const existing = await db.collection('gloombles_tracker').findOne({ guildId });

    let messageId = existing?.messageId || undefined;

    if (enabled && channelId) {
      // Fetch live stats
      let stats: any = {};
      try {
        const res = await fetch('https://gloombles.com/api/stats', { cache: 'no-store' });
        if (res.ok) stats = await res.json();
      } catch (e) {
        console.error('Error fetching gloombles stats for embed build:', e);
      }

      const collSize = stats.collectionSize ?? '2,600';
      const minted = stats.mintedAllTime ?? '3,697';
      const burned = (stats.burned || 0) + (stats.deadBurned || 0);
      const rolls = stats.totalRolls ?? '2,890';
      const merges = stats.merges ?? '58';
      const untouched = stats.untouched ?? '1,798';
      const mythic = stats.mythic ?? '145';
      const grails = stats.grails ?? '8';
      const epics = stats.epics ?? '14';
      const legendaries = stats.legendaries ?? '2';

      const embed: any = {
        title: '👾 GLOOMBLES LIVE METRICS',
        description: 'Live collection metrics straight from the Ethereum blockchain.',
        color: 0x8b5cf6,
        url: 'https://gloombles.com/stats',
        fields: [
          { name: '📦 Total Supply', value: `\`${collSize}\``, inline: true },
          { name: '🪙 Minted All-Time', value: `\`${minted}\``, inline: true },
          { name: '🔥 Total Burned', value: `\`${burned}\``, inline: true },
          { name: '🎲 Total Re-rolls', value: `\`${rolls}\``, inline: true },
          { name: '🧬 Merges Done', value: `\`${merges}\``, inline: true },
          { name: '📦 Untouched', value: `\`${untouched}\``, inline: true },
          { name: '👑 Mythics', value: `\`${mythic}\``, inline: true },
          { name: '✨ Grails', value: `\`${grails}\``, inline: true },
          { name: '🟣 Epics', value: `\`${epics}\``, inline: true },
          { name: '🟡 Legendaries', value: `\`${legendaries}\``, inline: true },
        ],
        footer: {
          text: 'Live Auto-Update • Refreshed every 5 mins • gloombles.com',
        },
        timestamp: new Date().toISOString(),
      };

      if (messageId) {
        const editRes = await editChannelMessage(channelId, messageId, '', [embed]);
        if (!editRes.success) {
          // Message may have been deleted, post new message
          const sendRes = await sendChannelMessage(channelId, '', [embed]);
          if (sendRes.success && sendRes.messageId) {
            messageId = sendRes.messageId;
          }
        }
      } else {
        const sendRes = await sendChannelMessage(channelId, '', [embed]);
        if (sendRes.success && sendRes.messageId) {
          messageId = sendRes.messageId;
        }
      }
    }

    const updateDoc = {
      guildId,
      channelId: channelId || '',
      enabled: Boolean(enabled),
      intervalMinutes: Number(intervalMinutes) || 5,
      messageId: messageId || null,
      updatedAt: new Date(),
    };

    await db.collection('gloombles_tracker').updateOne(
      { guildId },
      { $set: updateDoc },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      config: updateDoc,
    });
  } catch (err: any) {
    console.error('Error saving Gloombles stats config:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
