import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !ObjectId.isValid(id)) {
    return new NextResponse('Invalid image ID', { status: 400 });
  }

  try {
    const db = await getDb();
    const doc = await db.collection('uploads').findOne({ _id: new ObjectId(id) });

    if (!doc || !doc.buffer) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const contentType = doc.contentType || 'image/png';
    const buffer = Buffer.isBuffer(doc.buffer)
      ? doc.buffer
      : Buffer.from(doc.buffer.buffer || doc.buffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('Error serving uploaded image:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
