import type { Metadata } from 'next';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import GiveawaysClient from './GiveawaysClient';

type Props = {
  searchParams: Promise<{ id?: string; giveawayId?: string; guildId?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const targetId = params.id || params.giveawayId;

  if (targetId) {
    try {
      const db = await getDb();
      const gw = await db.collection('giveaways').findOne({
        $or: [
          { _id: ObjectId.isValid(targetId) ? new ObjectId(targetId) : null },
          { _id: targetId },
        ],
      });

      if (gw) {
        const prizeTitle = gw.prize ? `🎁 ${gw.prize}` : '🎁 Organik Giveaway';
        const description = gw.description
          ? `${gw.description}`
          : `Join the giveaway for ${gw.prize || 'exclusive rewards'} on Organik Bot!`;
        const imageUrl = gw.imageUrl || undefined;

        return {
          title: `${prizeTitle} | Organik Bot`,
          description,
          openGraph: {
            title: prizeTitle,
            description,
            url: `https://www.organikbot.com/giveaways?id=${gw._id}`,
            siteName: 'Organik Bot',
            images: imageUrl ? [{ url: imageUrl }] : [],
            type: 'website',
          },
          twitter: {
            card: imageUrl ? 'summary_large_image' : 'summary',
            title: prizeTitle,
            description,
            images: imageUrl ? [imageUrl] : [],
          },
        };
      }
    } catch (e) {
      console.error('Error generating giveaway metadata:', e);
    }
  }

  return {
    title: '🎁 Server Giveaways Portal - Organik Bot',
    description: 'Enter active giveaways and submit entries on Organik Bot.',
    openGraph: {
      title: '🎁 Server Giveaways Portal - Organik Bot',
      description: 'Enter active giveaways and submit entries on Organik Bot.',
      siteName: 'Organik Bot',
    },
  };
}

export default function GiveawaysPage() {
  return <GiveawaysClient />;
}
