'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  signMessage: (message: string) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setWalletAddress(accounts[0].address);
            setIsConnected(true);
          }
        } catch (err) {
          console.error('Error listing accounts:', err);
        }
      }
    };
    checkIfWalletIsConnected();

    // Listen for account/network changes
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
        } else {
          setWalletAddress(null);
          setIsConnected(false);
        }
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        if ((window as any).ethereum?.removeListener) {
          (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  const connectWallet = async (): Promise<string | null> => {
    setError(null);
    setIsConnecting(true);

    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError('No Ethereum wallet detected. Please install MetaMask or Coinbase Wallet.');
      setIsConnecting(false);
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        setIsConnecting(false);
        return accounts[0];
      }
      setIsConnecting(false);
      return null;
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      setIsConnecting(false);
      return null;
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setIsConnected(false);
    setError(null);
  };

  const signMessage = async (message: string): Promise<string | null> => {
    setError(null);
    if (typeof window === 'undefined' || !(window as any).ethereum || !walletAddress) {
      setError('Wallet not connected.');
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
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
        walletAddress,
        isConnected,
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

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
