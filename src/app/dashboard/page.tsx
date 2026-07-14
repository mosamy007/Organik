'use client';

import React, { useState, useEffect } from 'react';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { LayoutDashboard, ArrowRight, Plus, Disc, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function DashboardIndexPage() {
  const { user, loading: authLoading, login } = useDiscordAuth();
  const [guilds, setGuilds] = useState<any[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGuilds = async () => {
      if (!user) return;
      setLoadingGuilds(true);
      setError(null);
      try {
        const res = await fetch('/api/guilds');
        if (res.ok) {
          const data = await res.json();
          setGuilds(data.guilds || []);
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to fetch guilds');
        }
      } catch (err) {
        console.error('Error fetching admin guilds:', err);
        setError('Failed to connect to backend server');
      } finally {
        setLoadingGuilds(false);
      }
    };
    fetchGuilds();
  }, [user]);

  const getGuildIconUrl = (guildId: string, iconHash: string | null) => {
    if (!iconHash) return 'https://cdn.discordapp.com/embed/avatars/0.png';
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png`;
  };

  const getInviteUrl = (guildId: string) => {
    const clientId = '1524220657720885339';
    // Redirect URI after authorization
    const redirectUri = encodeURIComponent(window.location.origin + '/dashboard');
    // Scopes: bot, applications.commands. Permissions: Manage Roles (0x10000000) + Send Messages (0x800) + Manage Messages (0x2000) + Read History (0x10000) = 0x10012800 -> let's request Administrator (8) to keep it simple, or specific perms. Administrator is easiest.
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${guildId}&disable_guild_select=true`;
  };

  if (authLoading) {
    return (
      <div style={styles.loadingCenter}>
        <div className="spinner"></div>
        <span>Verifying admin session...</span>
      </div>
    );
  }

  // Render Login Card if not authenticated
  if (!user) {
    return (
      <div style={styles.authContainer} className="animate-fade-in">
        <div className="glass-card" style={styles.authCard}>
          <div style={styles.iconCircle}>
            <LayoutDashboard size={36} color="var(--primary)" />
          </div>
          <h1 style={styles.authTitle}>Admin Portal Access</h1>
          <p style={styles.authSubtitle}>
            Log in with your Discord account to manage your servers, create giveaways, send bot announcements, and configure NFT role gates.
          </p>
          <button onClick={() => login('/dashboard')} className="btn btn-discord" style={{ width: '100%', padding: '14px' }}>
            Log In with Discord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h1 style={styles.title}>Select a Server</h1>
        <p style={styles.subtitle}>
          Below are the servers you manage. Select a server with Organik Bot installed to manage its configurations, or add the bot to get started.
        </p>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {loadingGuilds ? (
        <div style={styles.loadingCenter}>
          <div className="spinner"></div>
          <span>Loading servers you manage...</span>
        </div>
      ) : guilds.length > 0 ? (
        <div style={styles.grid}>
          {guilds.map((guild) => (
            <div key={guild.id} className="glass-card" style={styles.guildCard}>
              <div style={styles.guildInfo}>
                <img
                  src={getGuildIconUrl(guild.id, guild.icon)}
                  alt={guild.name}
                  style={styles.guildIcon}
                />
                <div style={styles.guildDetails}>
                  <h3 style={styles.guildName}>{guild.name}</h3>
                  <div style={styles.botStatusRow}>
                    <Disc size={12} color={guild.botInGuild ? 'var(--success)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '0.8rem', color: guild.botInGuild ? '#34d399' : 'var(--text-muted)' }}>
                      {guild.botInGuild ? 'Bot Active' : 'Bot Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {guild.botInGuild ? (
                <Link href={`/dashboard/${guild.id}/send`} className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                  Manage Server <ArrowRight size={16} />
                </Link>
              ) : (
                <a
                  href={getInviteUrl(guild.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '10px', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.2)' }}
                >
                  Setup / Invite Bot <Plus size={16} />
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>
          <ShieldAlert size={36} color="var(--text-muted)" />
          <h3>No Manageable Servers Found</h3>
          <p>You must be an Owner or have Administrator/Manage Server permissions in at least one Discord server to access the dashboard.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    width: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: '800',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1.05rem',
  },
  authContainer: {
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    minHeight: '80vh',
  },
  authCard: {
    maxWidth: '460px',
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  iconCircle: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
  },
  authSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    lineHeight: '1.5',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '80px 0',
    flex: 1,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    padding: '12px 16px',
    borderRadius: '12px',
    color: 'var(--error)',
    fontSize: '0.9rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  guildCard: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '20px',
  },
  guildInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  guildIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  guildDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  guildName: {
    fontSize: '1.05rem',
    fontWeight: '700',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
  },
  botStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    padding: '60px 20px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
  },
};
