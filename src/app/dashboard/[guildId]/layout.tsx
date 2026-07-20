'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { MessageSquare, Shield, Gift, ArrowLeft, Disc, ShieldAlert, Share2 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}

export default function GuildDashboardLayout({ children, params }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user, loading: authLoading } = useDiscordAuth();
  
  // Resolve params promise
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;

  // Layout States
  const [guildInfo, setGuildInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const authorizeAndLoad = async () => {
      if (authLoading) return;
      if (!user) {
        router.push('/dashboard');
        return;
      }

      setLoading(true);
      try {
        // Fetch all guilds that this user can admin
        const res = await fetch('/api/guilds');
        if (res.ok) {
          const data = await res.json();
          const targetGuild = data.guilds?.find((g: any) => g.id === guildId);

          if (targetGuild && targetGuild.botInGuild) {
            setGuildInfo(targetGuild);
            setAuthorized(true);
          } else {
            setAuthorized(false);
          }
        } else {
          setAuthorized(false);
        }
      } catch (err) {
        console.error('Error authorizing guild admin layout:', err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    authorizeAndLoad();
  }, [user, authLoading, guildId]);

  if (authLoading || loading) {
    return (
      <div style={styles.loadingCenter}>
        <div className="spinner"></div>
        <span>Verifying permissions for server...</span>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={styles.errorContainer}>
        <div className="glass-card" style={styles.errorCard}>
          <ShieldAlert size={48} color="var(--error)" />
          <h2>Access Denied / Not Installed</h2>
          <p>
            You either do not have administrative permissions on this server, or Organik Bot has not been installed/configured on it yet.
          </p>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: '10px' }}>
            <ArrowLeft size={16} /> Select Another Server
          </Link>
        </div>
      </div>
    );
  }

  const getGuildIconUrl = (guild: any) => {
    if (!guild || !guild.icon) return 'https://cdn.discordapp.com/embed/avatars/0.png';
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
  };

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Guild Header */}
        <div style={styles.guildHeader}>
          <img src={getGuildIconUrl(guildInfo)} alt={guildInfo.name} style={styles.guildIcon} />
          <div style={styles.guildMeta}>
            <h4 style={styles.guildName}>{guildInfo.name}</h4>
            <div style={styles.statusBadge}>
              <Disc size={10} color="var(--success)" />
              <span style={{ fontSize: '0.75rem', color: '#34d399' }}>Active</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={styles.sideNav}>
          <Link
            href={`/dashboard/${guildId}/send`}
            style={pathname.endsWith('/send') ? styles.activeNavLink : styles.navLink}
          >
            <MessageSquare size={18} />
            <span>Send Message</span>
          </Link>
          <Link
            href={`/dashboard/${guildId}/nft-rules`}
            style={pathname.endsWith('/nft-rules') ? styles.activeNavLink : styles.navLink}
          >
            <Shield size={18} />
            <span>NFT Verification</span>
          </Link>
          <Link
            href={`/dashboard/${guildId}/giveaways`}
            style={pathname.endsWith('/giveaways') ? styles.activeNavLink : styles.navLink}
          >
            <Gift size={18} />
            <span>Giveaways</span>
          </Link>
          <Link
            href={`/dashboard/${guildId}/integrations`}
            style={pathname.endsWith('/integrations') ? styles.activeNavLink : styles.navLink}
          >
            <Share2 size={18} />
            <span>Integrations</span>
          </Link>
        </nav>

        {/* Back Link */}
        <div style={styles.backWrapper}>
          <Link href="/dashboard" style={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Change Server</span>
          </Link>
        </div>
      </aside>

      {/* Page Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    height: '80vh',
    width: '100%',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    padding: '20px',
  },
  errorCard: {
    maxWidth: '460px',
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  guildHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '20px',
  },
  guildIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
  },
  guildMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  guildName: {
    fontSize: '0.95rem',
    fontWeight: '700',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  sideNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexGrow: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    fontSize: '0.9rem',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
  },
  activeNavLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    color: '#ffffff',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    fontWeight: '600',
    fontSize: '0.9rem',
    textDecoration: 'none',
  },
  backWrapper: {
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '20px',
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
  },
};
