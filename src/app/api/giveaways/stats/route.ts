import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');
  const timeframe = searchParams.get('timeframe') || '30d'; // 7d, 30d, 90d, 1y, all
  const session = getSession(req);

  if (!guildId) {
    return NextResponse.json({ error: 'Missing required parameter: guildId' }, { status: 400 });
  }

  // Verify Admin Authorization
  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getDb();
    const nowMs = Date.now();
    let cutoffMs = 0;

    if (timeframe === '7d') cutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    else if (timeframe === '30d') cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    else if (timeframe === '90d') cutoffMs = nowMs - 90 * 24 * 60 * 60 * 1000;
    else if (timeframe === '1y') cutoffMs = nowMs - 365 * 24 * 60 * 60 * 1000;

    const allGiveaways = await db
      .collection('giveaways')
      .find({ guildId })
      .sort({ endTime: -1 })
      .toArray();

    // Filter giveaways by cutoff timeframe
    const filteredGiveaways = allGiveaways.filter((gw) => {
      if (timeframe === 'all' || cutoffMs === 0) return true;
      let dateMs = gw.createdAt ? new Date(gw.createdAt).getTime() : 0;
      if (!dateMs && gw._id) {
        try {
          dateMs = typeof gw._id.getTimestamp === 'function' ? gw._id.getTimestamp().getTime() : 0;
        } catch {
          dateMs = 0;
        }
      }
      if (!dateMs && gw.endTime) {
        dateMs = new Date(gw.endTime).getTime();
      }
      return dateMs >= cutoffMs;
    });

    const giveawayStringIds = filteredGiveaways.map((gw) => String(gw._id));
    const giveawayObjectIds = filteredGiveaways.map((gw) => gw._id);

    const allEntries = await db
      .collection('giveaway_entries')
      .find({
        $or: [
          { giveawayId: { $in: giveawayStringIds } },
          { giveawayId: { $in: giveawayObjectIds } },
        ],
      })
      .toArray();

    // Count entries per giveaway
    const entriesPerGiveawayMap = new Map<string, number>();
    const uniqueUserSet = new Set<string>();

    for (const entry of allEntries) {
      if (entry.discordId) {
        uniqueUserSet.add(entry.discordId);
      }
      const gwIdStr = String(entry.giveawayId);
      entriesPerGiveawayMap.set(gwIdStr, (entriesPerGiveawayMap.get(gwIdStr) || 0) + 1);
    }

    let totalWins = 0;
    const enrichedGiveaways = filteredGiveaways.map((gw) => {
      const gwIdStr = String(gw._id);
      const entriesCount = entriesPerGiveawayMap.get(gwIdStr) || 0;
      const winnerCount = Array.isArray(gw.winners) ? gw.winners.length : 0;
      totalWins += winnerCount;

      return {
        _id: gwIdStr,
        prize: gw.prize || 'Giveaway Prize',
        description: gw.description || '',
        status: gw.status || 'active',
        winnerCountRequired: gw.winnerCount || 1,
        winnerCountActual: winnerCount,
        winners: gw.winners || [],
        entriesCount,
        endTime: gw.endTime,
        createdAt: gw.createdAt || (gw._id?.getTimestamp ? gw._id.getTimestamp() : gw.endTime),
      };
    });

    // Sort top giveaways by entries count descending
    const topGiveaways = [...enrichedGiveaways]
      .sort((a, b) => b.entriesCount - a.entriesCount)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      timeframe,
      stats: {
        totalGiveaways: filteredGiveaways.length,
        uniqueUsers: uniqueUserSet.size,
        totalWins,
        totalEntries: allEntries.length,
        topGiveaways,
        allGiveaways: enrichedGiveaways,
      },
    });
  } catch (err: any) {
    console.error('Error fetching giveaway stats:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
