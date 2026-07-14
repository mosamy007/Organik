'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DiscordUser {
  discordId: string;
  username: string;
  avatar: string;
}

interface DiscordAuthContextType {
  user: DiscordUser | null;
  loading: boolean;
  login: (redirectPath?: string) => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const DiscordAuthContext = createContext<DiscordAuthContextType | undefined>(undefined);

export function DiscordAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/user');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching auth user session:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = (redirectPath = '/') => {
    const clientId = '1524220657720885339';
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback`);
    
    // Request scopes: identify, guilds
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds&state=${encodeURIComponent(redirectPath)}`;
    window.location.href = oauthUrl;
  };

  const logout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setUser(null);
      }
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      setLoading(false);
      window.location.href = '/';
    }
  };

  return (
    <DiscordAuthContext.Provider value={{ user, loading, login, logout, checkSession }}>
      {children}
    </DiscordAuthContext.Provider>
  );
}

export function useDiscordAuth() {
  const context = useContext(DiscordAuthContext);
  if (context === undefined) {
    throw new Error('useDiscordAuth must be used within a DiscordAuthProvider');
  }
  return context;
}
