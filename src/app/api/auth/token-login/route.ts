import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { setSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const db = await getDb();
    const tokenDoc = await db.collection('one_time_tokens').findOne({ _id: token });

    if (!tokenDoc) {
      return NextResponse.json({ error: 'Invalid or expired login token' }, { status: 400 });
    }

    // Check expiration
    if (new Date() > new Date(tokenDoc.expiresAt)) {
      await db.collection('one_time_tokens').deleteOne({ _id: token });
      return NextResponse.json({ error: 'Login token has expired' }, { status: 400 });
    }

    // Generate user session
    const sessionData = {
      discordId: tokenDoc.discordId,
      username: tokenDoc.username,
      avatar: tokenDoc.avatar || '',
      accessToken: '', // One-time login doesn't have an OAuth access token, which is fine
    };

    const res = NextResponse.json({
      success: true,
      message: 'Logged in successfully via one-time token',
      user: {
        discordId: sessionData.discordId,
        username: sessionData.username,
        avatar: sessionData.avatar,
      },
    });

    // Set the session cookie
    setSessionCookie(res, sessionData);

    // Delete the token so it cannot be reused
    await db.collection('one_time_tokens').deleteOne({ _id: token });

    return res;
  } catch (err: any) {
    console.error('Token login error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
