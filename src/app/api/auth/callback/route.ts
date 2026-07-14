import { NextRequest, NextResponse } from 'next/server';
import { getDiscordTokens, getDiscordUser } from '@/lib/discord-api';
import { setSessionCookie } from '@/lib/session';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state') || '/'; // Redirect target (e.g. /dashboard or /verify)

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  try {
    const tokens = await getDiscordTokens(code);
    const user = await getDiscordUser(tokens.access_token);

    const redirectUrl = new URL(state, req.url);
    const response = NextResponse.redirect(redirectUrl);

    // Save session
    setSessionCookie(response, {
      discordId: user.id,
      username: user.username,
      avatar: user.avatar,
      accessToken: tokens.access_token,
    });

    return response;
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    // Redirect to homepage with error query parameter
    const errorUrl = new URL('/', req.url);
    errorUrl.searchParams.set('error', err.message || 'Authentication failed');
    return NextResponse.redirect(errorUrl);
  }
}
