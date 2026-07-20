'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, base, polygon, arbitrum, optimism } from '@reown/appkit/networks';
import { createAppKit, useAppKitAccount, useAppKitProvider, useDisconnect, useAppKit } from '@reown/appkit/react';

const projectId = '0ca551c7155e1a102ed9c2acdd2fede4';

const metadata = {
  name: 'Organik Bot',
  description: 'Web3 role verification and giveaways dashboard for Discord',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://organik-zeta.vercel.app',
  icons: ['https://organik-zeta.vercel.app/favicon.ico'],
};

let appKitInstance: any = null;

// Initialize AppKit on the client only
if (typeof window !== 'undefined') {
  appKitInstance = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [mainnet, base, polygon, arbitrum, optimism],
    metadata,
    projectId,
    features: {
      analytics: false,
    },
  });
}

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void | Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletProviderClient({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { open } = useAppKit();
  const { disconnect: standaloneDisconnect } = useDisconnect();

  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async (): Promise<string | null> => {
    setError(null);
    setIsConnecting(true);
    try {
      await open({ view: 'Connect' });
      setIsConnecting(false);
      return address || null;
    } catch (err: any) {
      console.error('Error opening AppKit connect:', err);
      setError(err.message || 'Failed to connect wallet');
      setIsConnecting(false);
      return null;
    }
  };

  const disconnectWallet = async () => {
    setError(null);
    try {
      if (standaloneDisconnect) {
        await standaloneDisconnect();
      }

      if (appKitInstance?.adapter?.connectionControllerClient?.disconnect) {
        await appKitInstance.adapter.connectionControllerClient.disconnect();
      } else if (appKitInstance?.disconnect) {
        await appKitInstance.disconnect();
      }
      
      // Clear localStorage cache for session managers
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wagmi.wallet');
        localStorage.removeItem('wagmi.connected');
        localStorage.removeItem('wagmi.store');
        localStorage.removeItem('@w3m/connected_wallet');
        for (const key in localStorage) {
          if (key.startsWith('wc@') || key.startsWith('wagmi') || key.includes('walletconnect')) {
            localStorage.removeItem(key);
          }
        }
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  const signMessage = async (message: string): Promise<string | null> => {
    setError(null);
    if (!isConnected || !walletProvider) {
      setError('Wallet not connected.');
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);
      return signature;
    } catch (err: any) {
      console.error('Error signing message:', err);
      setError(err.message || 'Signature request rejected');
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress: address || null,
        isConnected: !!isConnected,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return mock provider during SSR / pre-hydration
    return (
      <WalletContext.Provider
        value={{
          walletAddress: null,
          isConnected: false,
          isConnecting: false,
          error: null,
          connectWallet: async () => null,
          disconnectWallet: () => {},
          signMessage: async () => null,
        }}
      >
        {children}
      </WalletContext.Provider>
    );
  }

  return <WalletProviderClient>{children}</WalletProviderClient>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    // Safe fallback for SSR if called outside context
    return {
      walletAddress: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      connectWallet: async () => null,
      disconnectWallet: () => {},
      signMessage: async () => null,
    };
  }
  return context;
}
