'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from './WalletProvider';
import { useDiscordAuth } from './DiscordAuthProvider';
import { Compass, ShieldCheck, Gift, LayoutDashboard, LogOut, Wallet } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname() || '';
  const { walletAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const { user, loading: authLoading, login, logout } = useDiscordAuth();

  const truncateAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const getDiscordAvatar = (userId: string, avatarHash: string) => {
    if (!avatarHash) return 'https://cdn.discordapp.com/embed/avatars/0.png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        {/* Logo */}
        <Link href="/" style={styles.logoLink}>
          <div style={styles.logo}>
            <span style={styles.logoSymbol}>☘️</span>
            <span style={styles.logoText}>Organik Bot</span>
          </div>
        </Link>

        {/* Links */}
        <div style={styles.navLinks}>
          <Link href="/" style={pathname === '/' ? styles.activeLink : styles.link}>
            <Compass size={18} /> Home
          </Link>
          <Link href="/verify" style={pathname.startsWith('/verify') ? styles.activeLink : styles.link}>
            <ShieldCheck size={18} /> NFT Verify
          </Link>
          <Link href="/giveaways" style={pathname.startsWith('/giveaways') ? styles.activeLink : styles.link}>
            <Gift size={18} /> Giveaways
          </Link>
          <Link href="/dashboard" style={pathname.startsWith('/dashboard') ? styles.activeLink : styles.link}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
        </div>

        {/* Buttons */}
        <div style={styles.actions}>
          {/* Web3 Wallet Connect */}
          {walletAddress ? (
            <div style={styles.walletContainer}>
              <button onClick={disconnectWallet} style={styles.walletBtnConnected} title="Disconnect Wallet">
                <Wallet size={16} />
                <span>{truncateAddress(walletAddress)}</span>
              </button>
            </div>
          ) : (
            <button onClick={connectWallet} disabled={isConnecting} style={styles.walletBtn}>
              <Wallet size={16} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          )}

          {/* Discord Authentication */}
          {authLoading ? (
            <div style={styles.spinnerSmall}></div>
          ) : user ? (
            <div style={styles.userMenu}>
              <img
                src={getDiscordAvatar(user.discordId, user.avatar)}
                alt="Avatar"
                style={styles.avatar}
              />
              <span style={styles.username}>{user.username}</span>
              <button onClick={() => logout()} style={styles.logoutBtn} title="Log Out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => login(pathname)} style={styles.discordBtn}>
              Login with Discord
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    background: 'rgba(8, 10, 16, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
    height: '70px',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  logoLink: {
    textDecoration: 'none',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoSymbol: {
    fontSize: '1.5rem',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
    fontSize: '1.25rem',
    background: 'linear-gradient(135deg, #ffffff, var(--text-secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    fontSize: '0.95rem',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  activeLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#ffffff',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    fontWeight: '600',
    fontSize: '0.95rem',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  walletBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fbbf24',
    padding: '8px 16px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    transition: 'all 0.2s ease',
  },
  walletBtnConnected: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#34d399',
    padding: '8px 16px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    transition: 'all 0.2s ease',
  },
  walletContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  discordBtn: {
    background: '#5865f2',
    border: 'none',
    color: '#ffffff',
    padding: '8px 16px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 10px rgba(88, 101, 242, 0.2)',
  },
  userMenu: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-color)',
    padding: '6px 12px',
    borderRadius: '10px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  username: {
    fontWeight: '600',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s ease',
  },
  spinnerSmall: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: '#5865f2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
