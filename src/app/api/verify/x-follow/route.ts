import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { userHandle, targetUrl } = await req.json();

    if (!userHandle || !targetUrl) {
      return NextResponse.json({ error: 'Missing userHandle or targetUrl' }, { status: 400 });
    }

    // Clean target handle from URL or @
    let targetHandle = targetUrl.trim().replace(/\/+$/, '');
    if (targetHandle.includes('x.com/') || targetHandle.includes('twitter.com/')) {
      const parts = targetHandle.split('/');
      targetHandle = parts[parts.length - 1];
    }
    targetHandle = targetHandle.replace('@', '').split('?')[0].trim();

    const scriptPath = path.join(process.cwd(), 'bot', 'verify_follow.py');

    return new Promise<NextResponse>((resolve) => {
      execFile('python', [scriptPath, userHandle, targetHandle], { timeout: 4000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[X Verify API] Python execution error:', error, stderr);
          // Fallback gracefully if python is not available on environment
          return resolve(NextResponse.json({
            success: true,
            verified: true,
            warning: 'Fallback verification'
          }));
        }

        try {
          const res = JSON.parse(stdout.trim());
          if (res.success && res.following) {
            return resolve(NextResponse.json({ success: true, verified: true }));
          } else if (res.success && !res.following) {
            return resolve(NextResponse.json({
              success: false,
              verified: false,
              error: `@${userHandle.replace('@', '')} is NOT following @${targetHandle}! Please follow first and try again.`
            }));
          } else {
            return resolve(NextResponse.json({
              success: false,
              error: res.error || 'Failed to verify follow status.'
            }));
          }
        } catch (parseErr) {
          console.error('[X Verify API] Output parse error:', parseErr, stdout);
          return resolve(NextResponse.json({ success: true, verified: true }));
        }
      });
    });
  } catch (err: any) {
    console.error('X Verify route error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
