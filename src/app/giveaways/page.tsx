'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { useWallet } from '@/components/WalletProvider';
import { Gift, Clock, Users, ShieldAlert, CheckCircle, ExternalLink, Calendar, ArrowLeft, Disc, Wallet } from 'lucide-react';
import Link from 'next/link';

function GiveawaysContent() {
  const searchParams = useSearchParams();
  const giveawayId = searchParams ? searchParams.get('id') : null;
  const guildIdFromQuery = searchParams ? searchParams.get('guildId') : null;

  const { user, loading: authLoading, login: discordLogin } = useDiscordAuth();
  const { walletAddress, isConnected, connectWallet, disconnectWallet } = useWallet();

  // State
  const [guildId, setGuildId] = useState<string>('');
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Single Giveaway State
  const [giveaway, setGiveaway] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  
  // Tasks completion state
  const [tasksCompleted, setTasksCompleted] = useState<Record<string, boolean>>({});
  const [localWalletInput, setLocalWalletInput] = useState<string>('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  // Auto redirect to Discord OAuth login if user is not authenticated and loading is finished
  useEffect(() => {
    if (!authLoading && !user && giveawayId) {
      const hasToken = searchParams ? searchParams.has('token') : false;
      if (!hasToken) {
        const currentPath = window.location.pathname + window.location.search;
        discordLogin(currentPath);
      }
    }
  }, [authLoading, user, giveawayId, searchParams, discordLogin]);

  // Set guildId from query
  useEffect(() => {
    if (guildIdFromQuery) {
      setGuildId(guildIdFromQuery);
    }
  }, [guildIdFromQuery]);

  // Load single giveaway detail
  useEffect(() => {
    const fetchGiveawayDetail = async () => {
      if (!giveawayId) return;
      setLoadingDetail(true);
      setSubmitStatus('idle');
      try {
        const res = await fetch(`/api/giveaways?giveawayId=${giveawayId}`);
        if (res.ok) {
          const data = await res.json();
          setGiveaway(data.giveaway);
          setHasEntered(data.hasEntered);
          setTotalEntries(data.totalEntries);
          if (data.userEntryDetails?.tasksCompleted) {
            setTasksCompleted(data.userEntryDetails.tasksCompleted);
          }
          if (data.userEntryDetails?.walletAddress) {
            setLocalWalletInput(data.userEntryDetails.walletAddress);
          }
        }
      } catch (err) {
        console.error('Failed to load giveaway details:', err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchGiveawayDetail();
  }, [giveawayId, user]);

  // Sync wallet address to local wallet input
  useEffect(() => {
    if (walletAddress) {
      setLocalWalletInput(walletAddress);
    }
  }, [walletAddress]);

  // Load giveaways list
  useEffect(() => {
    const fetchGiveawaysList = async () => {
      if (giveawayId || !guildId) return;
      setLoadingList(true);
      try {
        const res = await fetch(`/api/giveaways?guildId=${guildId}`);
        if (res.ok) {
          const data = await res.json();
          setGiveaways(data.giveaways || []);
        }
      } catch (err) {
        console.error('Failed to load giveaways:', err);
      } finally {
        setLoadingList(false);
      }
    };
    fetchGiveawaysList();
  }, [guildId, giveawayId]);

  const handleTaskComplete = (taskId: string, completed: boolean) => {
    setTasksCompleted((prev) => ({
      ...prev,
      [taskId]: completed,
    }));
  };

  const handleEnterGiveaway = async () => {
    if (!user) {
      setSubmitStatus('error');
      setSubmitMessage('Please log in with Discord first.');
      return;
    }
    if (!giveawayId || !giveaway) return;

    setSubmitStatus('loading');
    setSubmitMessage('Submitting entry...');

    // Validate EVM wallet input task
    const hasWalletTask = giveaway.tasks?.some((t: any) => t.type === 'wallet_input');
    if (hasWalletTask) {
      if (!localWalletInput || !/^0x[a-fA-F0-9]{40}$/.test(localWalletInput)) {
        setSubmitStatus('error');
        setSubmitMessage('Please enter a valid Ethereum wallet address (0x...).');
        return;
      }
    }

    try {
      const res = await fetch('/api/giveaways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giveawayId,
          walletAddress: hasWalletTask ? localWalletInput : undefined,
          tasksCompleted,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitStatus('success');
        setSubmitMessage(data.message || 'You successfully joined the giveaway!');
        setHasEntered(true);
        setTotalEntries((prev) => prev + 1);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(data.error || 'Failed to join giveaway.');
      }
    } catch (err: any) {
      console.error('Enter giveaway error:', err);
      setSubmitStatus('error');
      setSubmitMessage(err.message || 'Failed to submit entry.');
    }
  };

  const formatTimeRemaining = (dateString: string) => {
    const end = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // Render Single Giveaway Detail (Portal View)
  if (giveawayId) {
    if (loadingDetail) {
      return (
        <div style={styles.pageWrapper}>
          <div style={styles.loadingCenter}>
            <div className="spinner"></div>
            <span>Loading giveaway details...</span>
          </div>
        </div>
      );
    }

    if (!giveaway) {
      return (
        <div style={styles.pageWrapper}>
          <div style={styles.errorCenter}>
            <ShieldAlert size={48} color="var(--error)" />
            <h2>Giveaway Not Found</h2>
            <p>Please double check the URL or request a new link in Discord.</p>
          </div>
        </div>
      );
    }

    const isEnded = giveaway.status === 'ended' || new Date() > new Date(giveaway.endTime);

    return (
      <div style={styles.pageWrapper}>
        <div style={styles.portalCard} className="glass-card animate-fade-in">
          {/* Header */}
          <div style={styles.header}>
            {giveaway.imageUrl ? (
              <img
                src={giveaway.imageUrl}
                alt={giveaway.prize}
                style={{
                  width: '100%',
                  maxHeight: '260px',
                  objectFit: 'cover',
                  borderRadius: '16px',
                  marginBottom: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              />
            ) : (
              <div style={styles.logoBadge}>
                <Gift size={32} color="var(--primary)" />
              </div>
            )}
            <span style={isEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
              {isEnded ? 'Ended' : 'Active Giveaway'}
            </span>
            <h1 style={styles.title}>{giveaway.prize}</h1>
            <p style={styles.subtitle}>{giveaway.description}</p>
          </div>

          {/* Stats Bar */}
          <div style={styles.metaRow}>
            <div style={styles.metaCol}>
              <Clock size={15} color="var(--text-muted)" />
              <span>
                {isEnded 
                  ? `Ended on ${new Date(giveaway.endTime).toLocaleDateString()}` 
                  : formatTimeRemaining(giveaway.endTime)}
              </span>
            </div>
            <div style={styles.metaCol}>
              <Users size={15} color="var(--text-muted)" />
              <span>{totalEntries} Entered</span>
            </div>
            <div style={styles.metaCol}>
              <Gift size={15} color="var(--text-muted)" />
              <span>{giveaway.winnerCount} Winner(s)</span>
            </div>
          </div>

          {/* Winners Announcement */}
          {isEnded && giveaway.winners && giveaway.winners.length > 0 && (
            <div style={styles.winnersBox}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fbbf24', marginBottom: '8px' }}>
                🎉 Winners Drawn 🎉
              </h3>
              <div style={styles.winnersList}>
                {giveaway.winners.map((winnerId: string, index: number) => (
                  <span key={winnerId} style={styles.winnerItem}>
                    🏆 Winner #{index + 1}: <code style={styles.code}>&lt;@{winnerId}&gt;</code>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tasks list */}
          {!isEnded && (
            <div style={styles.entrySection}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '8px' }}>Required Tasks</h3>

              {/* Discord Login Task */}
              {!user ? (
                <div style={styles.taskItemPending}>
                  <div style={styles.taskDetails}>
                    <span style={styles.taskLabel}>Discord Authentication *</span>
                    <span style={styles.taskSub}>Authenticate your account to log entry.</span>
                  </div>
                  <button
                    onClick={() => discordLogin(`/giveaways?id=${giveawayId}`)}
                    style={styles.discordButton}
                  >
                    Login Discord
                  </button>
                </div>
              ) : (
                <div style={styles.taskItemSuccess}>
                  <div style={styles.taskDetails}>
                    <span style={styles.taskLabelSuccess}>✓ Discord Connected</span>
                    <span style={styles.taskSubSuccess}>Authenticated as {user.username}</span>
                  </div>
                  <div style={styles.pillSuccessSmall}>
                    <Disc size={12} />
                    <span>Active</span>
                  </div>
                </div>
              )}

              {/* Dynamic tasks */}
              {giveaway.tasks?.map((task: any) => {
                const isCompleted = tasksCompleted[task.id] === true;

                if (task.type === 'wallet_input') {
                  return (
                    <div
                      key={task.id}
                      style={isCompleted || localWalletInput ? styles.taskItemSuccess : styles.taskItemPending}
                    >
                      <div style={styles.taskDetails}>
                        <span style={isCompleted || localWalletInput ? styles.taskLabelSuccess : styles.taskLabel}>
                          Ethereum Wallet Submission {task.required && '*'}
                        </span>
                        <span style={isCompleted || localWalletInput ? styles.taskSubSuccess : styles.taskSub}>
                          Provide wallet for NFT/role rewards.
                        </span>
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', width: '100%' }}>
                          <input
                            type="text"
                            placeholder="Enter EVM Wallet (0x...)"
                            value={localWalletInput}
                            onChange={(e) => {
                              setLocalWalletInput(e.target.value);
                              handleTaskComplete(task.id, /^0x[a-fA-F0-9]{40}$/.test(e.target.value));
                            }}
                            disabled={hasEntered}
                            style={styles.taskInput}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={task.id} style={isCompleted ? styles.taskItemSuccess : styles.taskItemPending}>
                    <div style={styles.taskDetails}>
                      <span style={isCompleted ? styles.taskLabelSuccess : styles.taskLabel}>
                        {task.label} {task.required && '*'}
                      </span>
                      {task.url && (
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.taskLink}
                        >
                          Open link <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    {!hasEntered && (
                      <button
                        onClick={() => {
                          if (task.url && !isCompleted) {
                            window.open(task.url, '_blank', 'noopener,noreferrer');
                          }
                          handleTaskComplete(task.id, !isCompleted);
                        }}
                        style={isCompleted ? styles.taskBtnCompleted : styles.taskBtnAction}
                      >
                        {isCompleted ? '✓ Done' : task.url ? 'Go to Task' : 'Verify'}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Action and Status Banners */}
              {hasEntered ? (
                <div style={styles.joinedSuccessBanner} className="animate-scale-in">
                  <CheckCircle size={20} color="var(--success)" />
                  <span>Entry Logged Successfully! You can now close this tab.</span>
                </div>
              ) : (
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={handleEnterGiveaway}
                    disabled={!user || submitStatus === 'loading'}
                    style={styles.mainCtaBtn}
                  >
                    {submitStatus === 'loading' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                        Submitting...
                      </div>
                    ) : (
                      'Join Giveaway'
                    )}
                  </button>
                  {submitStatus === 'error' && <div style={styles.errorText}>{submitMessage}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback List View (Sleek card listing all giveaways)
  return (
    <div style={styles.pageWrapper}>
      <div style={styles.portalCard} className="glass-card animate-fade-in">
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Gift size={32} color="var(--primary)" />
          </div>
          <h1 style={styles.title}>Giveaway Portal</h1>
          <p style={styles.subtitle}>Browse active giveaways for your server.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Discord Server ID (Guild ID)</label>
            <input
              type="text"
              placeholder="e.g. 1524220657720885339"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              disabled={!!guildIdFromQuery}
              style={styles.taskInput}
            />
          </div>

          {guildId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {loadingList ? (
                <div style={styles.loadingCenter}>
                  <div className="spinner"></div>
                  <span>Fetching giveaways...</span>
                </div>
              ) : giveaways.length > 0 ? (
                giveaways.map((gw) => {
                  const isGwEnded = gw.status === 'ended' || new Date() > new Date(gw.endTime);
                  return (
                    <div key={gw._id} style={styles.listItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={isGwEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
                          {isGwEnded ? 'Ended' : 'Active'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {gw.winnerCount} Winner(s)
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: '750', margin: '6px 0' }}>{gw.prize}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        {gw.description}
                      </p>
                      <Link
                        href={`/giveaways?id=${gw._id}${guildIdFromQuery ? `&guildId=${guildIdFromQuery}` : ''}`}
                        style={styles.viewDetailsBtn}
                      >
                        Enter Giveaway
                      </Link>
                    </div>
                  );
                })
              ) : (
                <div style={styles.emptyList}>
                  <span>No giveaways found for this Server ID.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GiveawaysPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.pageWrapper}>
          <div className="spinner"></div>
        </div>
      }
    >
      <GiveawaysContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.08) 0%, rgba(8, 10, 16, 1) 70%)',
    padding: '20px',
  },
  portalCard: {
    maxWidth: '520px',
    width: '100%',
    padding: '40px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  statusBadgeActive: {
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.7rem',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadgeEnded: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.7rem',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: '1.5',
    maxWidth: '400px',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    padding: '16px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  metaCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  winnersBox: {
    background: 'rgba(245, 158, 11, 0.04)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
    borderRadius: '12px',
    padding: '16px',
  },
  winnersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  winnerItem: {
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  code: {
    fontFamily: 'monospace',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#fbbf24',
  },
  entrySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  taskItemPending: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
  },
  taskItemSuccess: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(16, 185, 129, 0.04)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '12px',
  },
  taskDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  taskLabel: {
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  taskSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  taskLabelSuccess: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#34d399',
  },
  taskSubSuccess: {
    fontSize: '0.75rem',
    color: '#34d399',
    opacity: 0.8,
  },
  taskInput: {
    flexGrow: 1,
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    color: 'white',
    padding: '8px 12px',
    fontSize: '0.85rem',
    outline: 'none',
  },
  taskWalletConnectBtn: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fbbf24',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '650',
    cursor: 'pointer',
  },
  taskWalletDisconnectBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#f87171',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '650',
    cursor: 'pointer',
  },
  discordButton: {
    background: '#5865f2',
    color: 'white',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  pillSuccessSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#34d399',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  taskBtnAction: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'white',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  taskBtnCompleted: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  taskLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: 'var(--primary)',
    textDecoration: 'none',
    marginTop: '2px',
  },
  joinedSuccessBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(16, 185, 129, 0.04)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    padding: '14px',
    borderRadius: '12px',
    color: '#34d399',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  mainCtaBtn: {
    width: '100%',
    background: 'var(--primary-gradient)',
    color: 'white',
    border: 'none',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '0.95rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
  },
  errorText: {
    color: 'var(--error)',
    fontSize: '0.8rem',
    marginTop: '8px',
    textAlign: 'center',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 0',
  },
  errorCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 0',
    textAlign: 'center',
  },
  listItem: {
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  viewDetailsBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    textAlign: 'center',
    textDecoration: 'none',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '650',
  },
  emptyList: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
};
