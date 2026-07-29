import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || 'image/png';

    const db = await getDb();
    const result = await db.collection('uploads').insertOne({
      filename: file.name,
      contentType,
      buffer,
      size: file.size,
      createdAt: new Date(),
    });

    // Derive domain URL (always prefer https://www.organikbot.com in production)
    let domain = 'https://www.organikbot.com';
    const host = req.headers.get('host');
    if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
      domain = `http://${host}`;
    }

    const imageUrl = `${domain}/api/uploads/${result.insertedId}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      id: result.insertedId.toString(),
    });
  } catch (err: any) {
    console.error('Error uploading file:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
