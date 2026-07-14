import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { DiscordAuthProvider } from '@/components/DiscordAuthProvider';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Organik Bot - Web3 Discord Manager & NFT Verification Portal',
  description: 'Manage giveaways, verify NFT holdings/traits, send messages, and configure Collab.Land-style verification roles for your Discord server.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DiscordAuthProvider>
          <WalletProvider>
            <Navbar />
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {children}
            </main>
          </WalletProvider>
        </DiscordAuthProvider>
      </body>
    </html>
  );
}
