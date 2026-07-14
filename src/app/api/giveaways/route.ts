import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { assignGuildRole, sendChannelMessage } from '@/lib/discord-api';
import { ObjectId } from 'mongodb';

/**
 * GET: Fetch giveaways for a guild or a specific giveaway.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');
  const giveawayId = searchParams.get('giveawayId');
  const session = getSession(req);

  try {
    const db = await getDb();

    // 1. Fetch single giveaway details
    if (giveawayId) {
      let giveaway;
      try {
        giveaway = await db.collection('giveaways').findOne({ _id: new ObjectId(giveawayId) });
      } catch {
        return NextResponse.json({ error: 'Invalid giveaway ID' }, { status: 400 });
      }

      if (!giveaway) {
        return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 });
      }

      // Check if logged-in user has entered
      let hasEntered = false;
      let userEntryDetails = null;

      if (session) {
        const entry = await db.collection('giveaway_entries').findOne({
          giveawayId,
          discordId: session.discordId,
        });
        if (entry) {
          hasEntered = true;
          userEntryDetails = entry;
        }
      }

      const totalEntries = await db.collection('giveaway_entries').countDocuments({ giveawayId });

      return NextResponse.json({
        giveaway,
        hasEntered,
        userEntryDetails,
        totalEntries,
      });
    }

    // 2. Fetch giveaways for a guild
    if (!guildId) {
      return NextResponse.json({ error: 'Missing guildId or giveawayId' }, { status: 400 });
    }

    const giveaways = await db
      .collection('giveaways')
      .find({ guildId })
      .sort({ endTime: -1 })
      .toArray();

    return NextResponse.json({ giveaways });
  } catch (err: any) {
    console.error('Error fetching giveaways:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Create a new giveaway (Admin only).
 */
export async function POST(req: NextRequest) {
  const session = getSession(req);

  try {
    const { guildId, title, description, prize, allowedRoles, winnerRoleRewardId, endTime, winnerCount, tasks, channelId, imageUrl } =
      await req.json();

    const actualTitle = title?.trim() || prize?.trim();

    if (!guildId || !actualTitle || !prize || !endTime || !winnerCount) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Authorize admin
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const newGiveaway: any = {
      guildId,
      title: actualTitle,
      description: description?.trim() || '',
      prize: prize.trim(),
      imageUrl: imageUrl?.trim() || null,
      allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [],
      winnerRoleRewardId: winnerRoleRewardId || null,
      endTime: new Date(endTime),
      winnerCount: Math.max(1, Number(winnerCount) || 1),
      tasks: Array.isArray(tasks) ? tasks : [],
      status: 'active',
      createdAt: new Date(),
      winners: [],
    };

    const result = await db.collection('giveaways').insertOne(newGiveaway);

    // If channelId is provided, automatically announce the giveaway in Discord
    if (channelId) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const giveawayUrl = `${appUrl}/giveaways?id=${result.insertedId}&guildId=${guildId}`;
        const embed: any = {
          title: `🎉 NEW GIVEAWAY: ${newGiveaway.prize} 🎉`,
          description: `${newGiveaway.description}\n\n**Prize:** ${newGiveaway.prize}\n**Winners:** ${newGiveaway.winnerCount}\n**Ends At:** <t:${Math.floor(newGiveaway.endTime.getTime() / 1000)}:R>`,
          color: 0x5865f2,
          url: giveawayUrl,
          fields: [
            {
              name: 'Requirements',
              value: newGiveaway.allowedRoles.length > 0 
                ? `Specific roles required. Check requirements on the portal.` 
                : 'Open to everyone!',
            },
            {
              name: 'How to Enter',
              value: `Click the "Enter Giveaway" button below, log in, complete tasks, and join!`,
            },
          ],
        };

        if (newGiveaway.imageUrl) {
          embed.image = { url: newGiveaway.imageUrl };
        }

        const components = [
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 2, // BUTTON
                style: 5, // LINK
                label: 'Enter Giveaway',
                url: giveawayUrl,
                emoji: { name: '🎉' },
              },
            ],
          },
        ];

        await sendChannelMessage(channelId, '', [embed], components);
      } catch (err) {
        console.error('Failed to announce giveaway in Discord channel:', err);
      }
    }

    return NextResponse.json({
      success: true,
      giveaway: {
        _id: result.insertedId,
        ...newGiveaway,
      },
    });
  } catch (err: any) {
    console.error('Error creating giveaway:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PUT: Enter/join a giveaway (User only).
 */
export async function PUT(req: NextRequest) {
  const session = getSession(req);

  if (!session) {
    return NextResponse.json({ error: 'Please log in with Discord first' }, { status: 401 });
  }

  try {
    const { giveawayId, walletAddress, tasksCompleted } = await req.json();

    if (!giveawayId) {
      return NextResponse.json({ error: 'Missing giveawayId' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Fetch giveaway
    let giveaway;
    try {
      giveaway = await db.collection('giveaways').findOne({ _id: new ObjectId(giveawayId) });
    } catch {
      return NextResponse.json({ error: 'Invalid giveaway ID' }, { status: 400 });
    }

    if (!giveaway) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 });
    }

    if (giveaway.status !== 'active' || new Date() > new Date(giveaway.endTime)) {
      return NextResponse.json({ error: 'This giveaway has ended' }, { status: 400 });
    }

    // 2. Validate tasks
    const requiredTasks = giveaway.tasks || [];
    const completedTasksMap: Record<string, boolean> = {};

    for (const task of requiredTasks) {
      const isCompleted = tasksCompleted?.[task.id] === true;

      // Special tasks validation
      if (task.type === 'wallet_input') {
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
          return NextResponse.json({ error: 'A valid EVM wallet address is required to enter' }, { status: 400 });
        }
      }

      if (task.required && !isCompleted) {
        return NextResponse.json({ error: `Please complete the required task: ${task.label}` }, { status: 400 });
      }

      completedTasksMap[task.id] = isCompleted;
    }

    // 3. Save Entry
    await db.collection('giveaway_entries').updateOne(
      { giveawayId, discordId: session.discordId },
      {
        $set: {
          giveawayId,
          discordId: session.discordId,
          discordUsername: session.username,
          walletAddress: walletAddress || null,
          tasksCompleted: completedTasksMap,
          joinedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'You have entered the giveaway successfully!' });
  } catch (err: any) {
    console.error('Error entering giveaway:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE: Delete a giveaway (Admin only).
 */
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  const { searchParams } = new URL(req.url);
  const giveawayId = searchParams.get('giveawayId');
  const guildId = searchParams.get('guildId');

  if (!giveawayId || !guildId) {
    return NextResponse.json({ error: 'Missing giveawayId or guildId' }, { status: 400 });
  }

  // Authorize admin
  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getDb();
    await db.collection('giveaways').deleteOne({ _id: new ObjectId(giveawayId), guildId });
    await db.collection('giveaway_entries').deleteMany({ giveawayId });
    return NextResponse.json({ success: true, message: 'Giveaway deleted successfully' });
  } catch (err: any) {
    console.error('Delete giveaway error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete giveaway' }, { status: 500 });
  }
}

/**
 * PATCH: Draw winners for a giveaway (Admin only).
 */
export async function PATCH(req: NextRequest) {
  const session = getSession(req);

  try {
    const { giveawayId, guildId } = await req.json();

    if (!giveawayId || !guildId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Authorize admin
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();

    // 1. Fetch giveaway details
    const giveaway = await db.collection('giveaways').findOne({ _id: new ObjectId(giveawayId), guildId });
    if (!giveaway) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 });
    }

    if (giveaway.status === 'ended') {
      return NextResponse.json({ error: 'Giveaway has already been drawn' }, { status: 400 });
    }

    // 2. Fetch all entries
    const entries = await db.collection('giveaway_entries').find({ giveawayId }).toArray();
    if (entries.length === 0) {
      // End giveaway with no winners
      await db
        .collection('giveaways')
        .updateOne({ _id: new ObjectId(giveawayId) }, { $set: { status: 'ended', winners: [] } });

      return NextResponse.json({ success: true, winners: [], message: 'Giveaway ended with 0 participants' });
    }

    // 3. Draw winners randomly
    const shuffled = [...entries].sort(() => 0.5 - Math.random());
    const winnerCount = Math.min(giveaway.winnerCount, shuffled.length);
    const winners = shuffled.slice(0, winnerCount);
    const winnerDiscordIds = winners.map((w) => w.discordId);

    // 4. Assign role reward if configured
    if (giveaway.winnerRoleRewardId) {
      for (const winner of winners) {
        try {
          await assignGuildRole(guildId, winner.discordId, giveaway.winnerRoleRewardId);
        } catch (roleErr) {
          console.error(`Failed to assign role reward to winner ${winner.discordId}:`, roleErr);
        }
      }
    }

    // 5. Update giveaway status
    await db
      .collection('giveaways')
      .updateOne(
        { _id: new ObjectId(giveawayId) },
        { $set: { status: 'ended', winners: winnerDiscordIds, endedAt: new Date() } }
      );

    // 6. Send announcement message if we can find a channel or we can just return
    try {
      const winnerMentions = winnerDiscordIds.map((id) => `<@${id}>`).join(', ');
      const messageContent = `🎉 **Giveaway Results for ${giveaway.prize}** 🎉\n\nCongratulations to the winners: ${winnerMentions || 'None'}!\nThey have been drawn from ${entries.length} participants.`;
      
      // Try to find a channel to announce (or we can announcement via API if we knew channel, let's look if we can announce in the chat or we just log)
      console.log('Winners drawn:', winnerDiscordIds);
    } catch (msgErr) {
      console.error('Failed to announce winners:', msgErr);
    }

    return NextResponse.json({
      success: true,
      winners: winners.map((w) => ({
        discordId: w.discordId,
        username: w.discordUsername,
        walletAddress: w.walletAddress,
      })),
    });
  } catch (err: any) {
    console.error('Draw winners error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
