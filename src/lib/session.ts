import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
const COOKIE_NAME = 'organik_bot_session';

export interface SessionData {
  discordId: string;
  username: string;
  avatar: string;
  accessToken: string;
}

/**
 * Creates a JWT session and serializes it into a secure cookie.
 */
export function setSessionCookie(response: NextResponse, data: SessionData) {
  const token = jwt.sign(data, JWT_SECRET, { expiresIn: '7d' });
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  response.headers.append('Set-Cookie', cookie);
}

/**
 * Decodes a session cookie from a request.
 */
export function getSession(req: NextRequest): SessionData | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parse(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionData;
    return decoded;
  } catch (err) {
    console.error('Failed to verify session token:', err);
    return null;
  }
}

/**
 * Clears the session cookie from a response.
 */
export function clearSessionCookie(response: NextResponse) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: -1, // Expire instantly
  });
  response.headers.append('Set-Cookie', cookie);
}
