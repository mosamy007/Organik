import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGuildChannels } from '@/lib/discord-api';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { getDb } from '@/lib/mongodb';

// Helper to fetch collection metadata from OpenSea
async function getOpenSeaContractDetails(chain: string, address: string) {
  try {
    const apiKey = process.env.OPENSEA_API_KEY;
    if (!apiKey) {
      console.warn('[OpenSea] Missing OPENSEA_API_KEY. Skipping contract metadata resolution.');
      return null;
    }

    const cleanAddress = address.trim().toLowerCase();
    // Normalize chain name for OpenSea API
    const normalizedChain = chain.trim().toLowerCase();

    console.log(`[OpenSea] Resolving contract metadata for: ${cleanAddress} on ${normalizedChain}`);
    const res = await fetch(`https://api.opensea.io/api/v2/chain/${normalizedChain}/contract/${cleanAddress}`, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        name: data.name || 'Unnamed Collection',
        slug: data.collection || '',
      };
    } else {
      const errText = await res.text();
      console.error(`[OpenSea] API status ${res.status} for ${cleanAddress}: ${errText}`);
    }
  } catch (err) {
    console.error(`[OpenSea] Fetch error for contract:`, err);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json({ error: 'Missing guildId parameter' }, { status: 400 });
  }

  // Verify that the user is an admin of the guild
  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to manage this server.' }, { status: 403 });
  }

  try {
    const db = await getDb();
    
    // Fetch channels for the dropdown
    const channels = await getGuildChannels(guildId);

    // Fetch existing integrations settings
    const integrations = await db.collection('integrations').findOne({ guildId });

    return NextResponse.json({
      channels,
      integrations: integrations || {
        guildId,
        twitter: { enabled: false, channelId: '', accounts: [] },
        sales: { enabled: false, channelId: '', contracts: [] },
      },
    });
  } catch (err: any) {
    console.error('[API Integrations GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { guildId, twitter, sales } = body;

    if (!guildId) {
      return NextResponse.json({ error: 'Missing guildId parameter' }, { status: 400 });
    }

    // Verify admin status
    const isAdmin = await verifyGuildAdmin(session, guildId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();

    // Parse/Clean Twitter handles
    const twitterAccounts = Array.isArray(twitter?.accounts)
      ? twitter.accounts
          .map((acc: string) => acc.replace('@', '').trim())
          .filter((acc: string) => acc.length > 0)
      : [];

    // Parse and resolve OpenSea collection slugs for added contracts
    const contracts = [];
    if (Array.isArray(sales?.contracts)) {
      for (const contract of sales.contracts) {
        const address = contract.address?.trim();
        const chain = contract.chain || 'ethereum';
        let name = contract.name?.trim() || 'Unnamed Collection';
        let slug = contract.slug?.trim() || '';

        if (!address) continue;

        // If slug or name is missing, attempt to fetch it from OpenSea API
        if (!slug || name === 'Unnamed Collection') {
          const osDetails = await getOpenSeaContractDetails(chain, address);
          if (osDetails) {
            name = osDetails.name;
            slug = osDetails.slug;
          }
        }

        contracts.push({
          address: address.toLowerCase(),
          chain: chain.toLowerCase(),
          name,
          slug,
        });
      }
    }

    // Load existing settings to preserve lastProcessed data
    const existing = await db.collection('integrations').findOne({ guildId });

    // Build update payload
    const updatedIntegrations = {
      guildId,
      twitter: {
        enabled: !!twitter?.enabled,
        channelId: twitter?.channelId || '',
        accounts: twitterAccounts,
        lastProcessedIds: existing?.twitter?.lastProcessedIds || {},
      },
      sales: {
        enabled: !!sales?.enabled,
        channelId: sales?.channelId || '',
        contracts,
        lastProcessedTxHashes: existing?.sales?.lastProcessedTxHashes || [],
      },
      updatedAt: new Date(),
    };

    // Initialize lastProcessedIds mapping for new Twitter accounts
    for (const acc of twitterAccounts) {
      if (!updatedIntegrations.twitter.lastProcessedIds[acc]) {
        updatedIntegrations.twitter.lastProcessedIds[acc] = [];
      }
    }

    await db.collection('integrations').updateOne(
      { guildId },
      { $set: updatedIntegrations },
      { upsert: true }
    );

    return NextResponse.json({ success: true, integrations: updatedIntegrations });
  } catch (err: any) {
    console.error('[API Integrations POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
