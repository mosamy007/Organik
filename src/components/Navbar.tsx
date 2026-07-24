'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from './WalletProvider';
import { useDiscordAuth } from './DiscordAuthProvider';
import { LayoutDashboard, LogOut, Wallet, Menu, X } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname() || '';
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === '/verify' || pathname === '/giveaways') {
    return null;
  }

  const { walletAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const { user, loading: authLoading, login, logout } = useDiscordAuth();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const truncateAddress = (addr: string) =>
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const getDiscordAvatar = (userId: string, avatarHash: string) => {
    if (!avatarHash) return 'https://cdn.discordapp.com/embed/avatars/0.png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
  };

  return (
    <>
      <nav style={styles.nav}>
        <div style={styles.container}>
          <Link href="/dashboard" style={styles.logoLink}>
            <div style={styles.logo}>
              <img src="/Website-logo.png" alt="Organik Logo" style={{ height: '32px', width: 'auto' }} />
              <span style={styles.logoText}>Organik Bot</span>
            </div>
          </Link>

          <div style={styles.navLinks} className="navbar-desktop-links">
            <Link href="/dashboard" style={pathname.startsWith('/dashboard') ? styles.activeLink : styles.link}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
          </div>

          <div style={styles.actions} className="navbar-desktop-actions">
            {walletAddress ? (
              <button onClick={disconnectWallet} style={styles.walletBtnConnected} title="Disconnect Wallet">
                <Wallet size={16} /><span>{truncateAddress(walletAddress)}</span>
              </button>
            ) : (
              <button onClick={connectWallet} disabled={isConnecting} style={styles.walletBtn}>
                <Wallet size={16} /><span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              </button>
            )}

            {authLoading ? (
              <div style={styles.spinnerSmall}></div>
            ) : user ? (
              <div style={styles.userMenu}>
                <img src={getDiscordAvatar(user.discordId, user.avatar)} alt="Avatar" style={styles.avatar} />
                <span style={styles.username}>{user.username}</span>
                <button onClick={() => logout()} style={styles.logoutBtn} title="Log Out">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => login(pathname)} style={styles.discordBtn}>Login with Discord</button>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={styles.hamburger}
            className="navbar-hamburger"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={styles.mobileMenu} className="navbar-mobile-menu">
          <Link href="/dashboard" style={styles.mobileLink} onClick={() => setMenuOpen(false)}>
            <LayoutDashboard size={16} /> Dashboard
          </Link>
          <div style={styles.mobileDivider} />
          {walletAddress ? (
            <button onClick={() => { disconnectWallet(); setMenuOpen(false); }} style={styles.mobileAction}>
              <Wallet size={16} /> {truncateAddress(walletAddress)} (Disconnect)
            </button>
          ) : (
            <button onClick={() => { connectWallet(); setMenuOpen(false); }} style={styles.mobileAction}>
              <Wallet size={16} /> {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
          {authLoading ? null : user ? (
            <div style={styles.mobileUserRow}>
              <img src={getDiscordAvatar(user.discordId, user.avatar)} alt="Avatar" style={styles.avatar} />
              <span style={{ ...styles.username, maxWidth: 'none', flex: 1 }}>{user.username}</span>
              <button onClick={() => { logout(); setMenuOpen(false); }} style={styles.logoutBtn}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => { login(pathname); setMenuOpen(false); }} style={styles.mobileDiscordBtn}>
              Login with Discord
            </button>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .navbar-desktop-actions { display: none !important; }
          .navbar-desktop-links  { display: none !important; }
          .navbar-hamburger      { display: flex !important; }
        }
        @media (min-width: 641px) {
          .navbar-hamburger      { display: none !important; }
          .navbar-mobile-menu    { display: none !important; }
        }
      `}</style>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    background: 'rgba(8, 10, 16, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    position: 'sticky', top: 0, zIndex: 100, width: '100%', height: '70px',
  },
  container: {
    maxWidth: '1200px', margin: '0 auto', padding: '0 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: '100%', gap: '12px',
  },
  logoLink: { textDecoration: 'none', flexShrink: 0 },
  logo: { display: 'flex', alignItems: 'center', gap: '8px' },
  logoText: {
    fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '1.15rem',
    background: 'linear-gradient(135deg, #ffffff, var(--text-secondary))',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  navLinks: { display: 'flex', alignItems: 'center', gap: '24px', flex: 1 },
  link: {
    display: 'flex', alignItems: 'center', gap: '6px',
    color: 'var(--text-secondary)', fontWeight: '500', fontSize: '0.95rem',
    padding: '8px 12px', borderRadius: '8px', transition: 'all 0.2s ease',
  },
  activeLink: {
    display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff',
    background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.05)',
    fontWeight: '600', fontSize: '0.95rem', padding: '8px 12px', borderRadius: '8px',
  },
  actions: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  walletBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fbbf24', padding: '8px 14px', borderRadius: '10px',
    fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer',
    fontFamily: 'var(--font-display)', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
  },
  walletBtnConnected: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)',
    color: '#34d399', padding: '8px 14px', borderRadius: '10px',
    fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer',
    fontFamily: 'var(--font-display)', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
  },
  discordBtn: {
    background: '#5865f2', border: 'none', color: '#ffffff', padding: '8px 14px',
    borderRadius: '10px', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer',
    fontFamily: 'var(--font-display)', transition: 'all 0.2s ease',
    boxShadow: '0 4px 10px rgba(88, 101, 242, 0.2)', whiteSpace: 'nowrap',
  },
  userMenu: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)',
    padding: '5px 10px', borderRadius: '10px',
  },
  avatar: { width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.1)' },
  username: {
    fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-primary)',
    maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  logoutBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.2s ease',
  },
  spinnerSmall: {
    width: '20px', height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.1)', borderTopColor: '#5865f2',
    borderRadius: '50%', animation: 'spin 1s linear infinite',
  },
  hamburger: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)', cursor: 'pointer', padding: '8px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  mobileMenu: {
    position: 'fixed', top: '70px', left: 0, right: 0,
    background: 'rgba(8, 10, 20, 0.97)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '16px', zIndex: 99,
    display: 'flex', flexDirection: 'column', gap: '8px',
    animation: 'fadeIn 0.15s ease',
  },
  mobileLink: {
    display: 'flex', alignItems: 'center', gap: '10px',
    color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.95rem',
    padding: '12px 14px', borderRadius: '10px', textDecoration: 'none',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', minHeight: '44px',
  },
  mobileAction: {
    display: 'flex', alignItems: 'center', gap: '10px',
    color: '#fbbf24', fontWeight: '600', fontSize: '0.9rem',
    padding: '12px 14px', borderRadius: '10px',
    background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)',
    cursor: 'pointer', fontFamily: 'var(--font-display)', width: '100%', minHeight: '44px',
  },
  mobileDiscordBtn: {
    background: '#5865f2', border: 'none', color: '#ffffff', padding: '12px 16px',
    borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer',
    fontFamily: 'var(--font-display)', width: '100%', minHeight: '44px',
  },
  mobileDivider: { height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' },
  mobileUserRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 14px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
  },
};
