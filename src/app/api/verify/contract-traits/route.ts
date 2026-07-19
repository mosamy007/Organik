import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { getDb } from '@/lib/mongodb';

/**
 * GET: Retrieve attribute summary for an NFT contract from Alchemy (with MongoDB Caching).
 */
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contractAddress = searchParams.get('contractAddress');
  const network = searchParams.get('network') || 'ethereum';
  const guildId = searchParams.get('guildId');

  if (!contractAddress || !guildId) {
    return NextResponse.json({ error: 'Missing contractAddress or guildId' }, { status: 400 });
  }

  // Verify that the user is an admin of the specified guild
  const isAdmin = await verifyGuildAdmin(session, guildId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cleanAddress = contractAddress.trim().toLowerCase();
  const db = await getDb();

  // 1. Check MongoDB cache first
  const cacheKey = { contractAddress: cleanAddress, network };
  let cachedRecord = null;
  try {
    cachedRecord = await db.collection('contract_traits_cache').findOne(cacheKey);
  } catch (dbErr) {
    console.error('[contract-traits] Cache lookup error:', dbErr);
  }

  if (cachedRecord) {
    const cacheAgeMs = Date.now() - new Date(cachedRecord.updatedAt).getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    
    // Serve fresh cache directly (less than 3 days old)
    if (cacheAgeMs < threeDaysMs) {
      console.log(`[contract-traits] Serving traits for ${cleanAddress} on ${network} from cache.`);
      return NextResponse.json({ success: true, traits: cachedRecord.traits });
    }
  }

  // 2. Fetch from Alchemy if not in cache or if cache is stale
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    // If no API key but we have stale cache, fall back to it
    if (cachedRecord) {
      console.log(`[contract-traits] Missing ALCHEMY_API_KEY. Falling back to stale cache.`);
      return NextResponse.json({ success: true, traits: cachedRecord.traits });
    }
    return NextResponse.json({
      error: 'Alchemy API Key is not configured on the server. Please add ALCHEMY_API_KEY to your env variables.'
    }, { status: 500 });
  }

  const ALCHEMY_SUBDOMAINS: Record<string, string> = {
    ethereum: 'eth-mainnet',
    sepolia: 'eth-sepolia',
    polygon: 'polygon-mainnet',
    arbitrum: 'arb-mainnet',
    optimism: 'opt-mainnet',
    base: 'base-mainnet',
  };

  const subdomain = ALCHEMY_SUBDOMAINS[network] || 'eth-mainnet';
  const url = `https://${subdomain}.g.alchemy.com/nft/v3/${apiKey}/summarizeNFTAttributes?contractAddress=${cleanAddress}`;

  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      // Fallback to stale cache if request fails (e.g. rate limited 429)
      if (cachedRecord) {
        console.warn(`[contract-traits] Alchemy request failed with status ${res.status}. Falling back to stale cache.`);
        return NextResponse.json({ success: true, traits: cachedRecord.traits });
      }

      const errText = await res.text();
      let parsedError = 'Failed to fetch attributes';
      try {
        const parsed = JSON.parse(errText);
        parsedError = parsed.error?.message || parsed.message || errText;
      } catch {
        parsedError = errText || res.statusText;
      }

      // If rate limited, append helpful guidance to manual mode
      if (res.status === 429) {
        parsedError = `${parsedError}. (Alchemy Rate Limited. You can click 'Use Manual Input' above to type traits manually instead.)`;
      }

      return NextResponse.json({ error: `Alchemy error: ${parsedError}` }, { status: res.status });
    }

    const data = await res.json();
    const summary = data.summary || {};

    // Transform summary mapping to list of unique values per attribute
    const traits: Record<string, string[]> = {};
    for (const [traitType, valuesObj] of Object.entries(summary)) {
      if (valuesObj && typeof valuesObj === 'object') {
        traits[traitType] = Object.keys(valuesObj);
      }
    }

    // 3. Save/Update cache in MongoDB
    try {
      await db.collection('contract_traits_cache').updateOne(
        cacheKey,
        {
          $set: {
            contractAddress: cleanAddress,
            network,
            traits,
            updatedAt: new Date(),
          }
        },
        { upsert: true }
      );
    } catch (saveErr) {
      console.error('[contract-traits] Failed to save traits cache:', saveErr);
    }

    return NextResponse.json({ success: true, traits });
  } catch (err: any) {
    console.error('Error in contract-traits API:', err);
    
    // Fallback to stale cache on exception
    if (cachedRecord) {
      console.warn(`[contract-traits] Exception occurred. Falling back to stale cache.`);
      return NextResponse.json({ success: true, traits: cachedRecord.traits });
    }

    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
