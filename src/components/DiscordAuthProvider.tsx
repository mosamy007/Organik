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
      let token = null;
      let searchParams = null;
      if (typeof window !== 'undefined') {
        searchParams = new URLSearchParams(window.location.search);
        token = searchParams.get('token');
      }

      if (token && searchParams) {
        setLoading(true);
        const tokenRes = await fetch('/api/auth/token-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.success) {
            setUser(tokenData.user);
            
            // Clean token from the URL search parameters
            searchParams.delete('token');
            const newSearch = searchParams.toString();
            const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState(null, '', newPath);
            
            setLoading(false);
            return;
          }
        }
      }

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
