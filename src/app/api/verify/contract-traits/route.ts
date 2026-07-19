import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { verifyGuildAdmin } from '@/lib/auth-helpers';

/**
 * GET: Retrieve attribute summary for an NFT contract from Alchemy.
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

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
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
  const url = `https://${subdomain}.g.alchemy.com/nft/v3/${apiKey}/summarizeNFTAttributes?contractAddress=${contractAddress}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      let parsedError = 'Failed to fetch attributes';
      try {
        const parsed = JSON.parse(errText);
        parsedError = parsed.error?.message || parsed.message || errText;
      } catch {
        parsedError = errText || res.statusText;
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

    return NextResponse.json({ success: true, traits });
  } catch (err: any) {
    console.error('Error in contract-traits API:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
