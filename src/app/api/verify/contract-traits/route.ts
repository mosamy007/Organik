import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';
import { getDb } from '@/lib/mongodb';

/**
 * Helper to fetch traits from OpenSea v2 API.
 */
async function fetchFromOpenSea(contractAddress: string, network: string, apiKey: string): Promise<Record<string, string[]>> {
  // OpenSea chain mapping (standard matches: ethereum, polygon, base, arbitrum, optimism, sepolia)
  const chainName = network.trim().toLowerCase();

  // 1. Get collection slug from contract endpoint
  const contractUrl = `https://api.opensea.io/api/v2/chain/${chainName}/contract/${contractAddress}`;
  const contractRes = await fetch(contractUrl, {
    headers: {
      'x-api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (!contractRes.ok) {
    const errText = await contractRes.text().catch(() => '');
    throw new Error(`OpenSea contract query failed (Status ${contractRes.status}): ${errText || contractRes.statusText}`);
  }

  const contractData = await contractRes.json();
  const slug = contractData.collection;
  if (!slug) {
    throw new Error(`No collection slug found on OpenSea for contract ${contractAddress}`);
  }

  // 2. Get traits list using collection slug
  const traitsUrl = `https://api.opensea.io/api/v2/traits/${slug}`;
  const traitsRes = await fetch(traitsUrl, {
    headers: {
      'x-api-key': apiKey,
      'accept': 'application/json'
    }
  });

  if (!traitsRes.ok) {
    const errText = await traitsRes.text().catch(() => '');
    throw new Error(`OpenSea traits query failed (Status ${traitsRes.status}): ${errText || traitsRes.statusText}`);
  }

  const traitsData = await traitsRes.json();
  const rawTraits = traitsData.traits || {};

  // Transform rawTraits to Record<string, string[]> format
  const traits: Record<string, string[]> = {};
  for (const [traitType, valuesObj] of Object.entries(rawTraits)) {
    if (valuesObj && typeof valuesObj === 'object') {
      traits[traitType] = Object.keys(valuesObj);
    }
  }

  return traits;
}

/**
 * Helper to fetch traits from Alchemy NFT API.
 */
async function fetchFromAlchemy(contractAddress: string, network: string, apiKey: string): Promise<Record<string, string[]>> {
  const ALCHEMY_SUBDOMAINS: Record<string, string> = {
    ethereum: 'eth-mainnet',
    sepolia: 'eth-sepolia',
    polygon: 'polygon-mainnet',
    arbitrum: 'arb-mainnet',
    optimism: 'opt-mainnet',
    base: 'base-mainnet',
  };

  const subdomain = ALCHEMY_SUBDOMAINS[network] || 'eth-mainnet';
  const url = `https://${subdomain}.g.alchemy.com/nft/v3/${apiKey}/summarizeNFTAttributes?contractAddress=${contractAddress}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Alchemy query failed (Status ${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const summary = data.summary || {};

  const traits: Record<string, string[]> = {};
  for (const [traitType, valuesObj] of Object.entries(summary)) {
    if (valuesObj && typeof valuesObj === 'object') {
      traits[traitType] = Object.keys(valuesObj);
    }
  }

  return traits;
}

/**
 * GET: Retrieve attribute summary for an NFT contract (with OpenSea + Alchemy Dual Providers and MongoDB Caching).
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

  // Errors list to collect issues if both providers fail
  const fetchErrors: string[] = [];

  // 2. Try OpenSea first if key is configured
  const openseaKey = process.env.OPENSEA_API_KEY;
  if (openseaKey) {
    try {
      console.log(`[contract-traits] Attempting to fetch traits from OpenSea for ${cleanAddress}...`);
      const traits = await fetchFromOpenSea(cleanAddress, network, openseaKey);
      
      // Save/Update cache in MongoDB
      try {
        await db.collection('contract_traits_cache').updateOne(
          cacheKey,
          { $set: { contractAddress: cleanAddress, network, traits, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (saveErr) {
        console.error('[contract-traits] Failed to save traits cache:', saveErr);
      }

      return NextResponse.json({ success: true, traits });
    } catch (osErr: any) {
      console.error('[contract-traits] OpenSea fetch failed:', osErr.message);
      fetchErrors.push(`OpenSea: ${osErr.message}`);
    }
  }

  // 3. Fallback to Alchemy if OpenSea failed or wasn't configured
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey) {
    try {
      console.log(`[contract-traits] Attempting to fetch traits from Alchemy for ${cleanAddress}...`);
      const traits = await fetchFromAlchemy(cleanAddress, network, alchemyKey);

      // Save/Update cache in MongoDB
      try {
        await db.collection('contract_traits_cache').updateOne(
          cacheKey,
          { $set: { contractAddress: cleanAddress, network, traits, updatedAt: new Date() } },
          { upsert: true }
        );
      } catch (saveErr) {
        console.error('[contract-traits] Failed to save traits cache:', saveErr);
      }

      return NextResponse.json({ success: true, traits });
    } catch (alcErr: any) {
      console.error('[contract-traits] Alchemy fetch failed:', alcErr.message);
      fetchErrors.push(`Alchemy: ${alcErr.message}`);
    }
  }

  // 4. If all active queries failed, try to serve stale cache
  if (cachedRecord) {
    console.warn(`[contract-traits] All fetches failed. Falling back to stale database cache.`);
    return NextResponse.json({ success: true, traits: cachedRecord.traits });
  }

  // 5. If everything failed and no cache, return error report
  const combinedError = fetchErrors.join(' | ') || 'No trait-fetching keys configured on the server.';
  let clientMessage = combinedError;
  if (combinedError.includes('429')) {
    clientMessage = `${combinedError}. (Rate limit hit. You can click 'Use Manual Input' above to type traits manually.)`;
  }

  return NextResponse.json({ error: clientMessage }, { status: 502 });
}
