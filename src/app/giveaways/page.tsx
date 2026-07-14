'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { useWallet } from '@/components/WalletProvider';
import { Gift, Clock, Users, ShieldAlert, CheckCircle, ExternalLink, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function GiveawaysContent() {
  const searchParams = useSearchParams();
  const giveawayId = searchParams ? searchParams.get('id') : null;
  const guildIdFromQuery = searchParams ? searchParams.get('guildId') : null;

  const { user, login: discordLogin } = useDiscordAuth();
  const { walletAddress, isConnected, connectWallet } = useWallet();

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

  // Render Single Giveaway Detail
  if (giveawayId) {
    if (loadingDetail) {
      return (
        <div style={styles.loadingCenter}>
          <div className="spinner"></div>
          <span>Loading giveaway details...</span>
        </div>
      );
    }

    if (!giveaway) {
      return (
        <div style={styles.errorCenter}>
          <ShieldAlert size={48} color="var(--error)" />
          <h2>Giveaway Not Found</h2>
          <p>Please double check the URL or return to the portal.</p>
          <Link href="/giveaways" className="btn btn-secondary" style={{ marginTop: '20px' }}>
            <ArrowLeft size={16} /> Return to Portal
          </Link>
        </div>
      );
    }

    const isEnded = giveaway.status === 'ended' || new Date() > new Date(giveaway.endTime);

    return (
      <div style={styles.container} className="animate-fade-in">
        <div style={{ alignSelf: 'flex-start' }}>
          <Link href={guildIdFromQuery ? `/giveaways?guildId=${guildIdFromQuery}` : '/giveaways'} style={styles.backLink}>
            <ArrowLeft size={16} /> Back to giveaways
          </Link>
        </div>

        <div style={styles.giveawayWrapper}>
          {/* Main Info Card */}
          <div className="glass-card" style={styles.mainCard}>
            <div style={styles.giveawayHeader}>
              <span style={isEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
                {isEnded ? 'Ended' : 'Active'}
              </span>
              <h1 style={styles.giveawayTitle}>{giveaway.prize}</h1>
              <p style={styles.giveawayDesc}>{giveaway.description}</p>
            </div>

            <div style={styles.metaRow}>
              <div style={styles.metaCol}>
                <Clock size={16} color="var(--text-muted)" />
                <span>
                  {isEnded 
                    ? `Ended on ${new Date(giveaway.endTime).toLocaleDateString()}` 
                    : formatTimeRemaining(giveaway.endTime)}
                </span>
              </div>
              <div style={styles.metaCol}>
                <Users size={16} color="var(--text-muted)" />
                <span>{totalEntries} participants</span>
              </div>
              <div style={styles.metaCol}>
                <Gift size={16} color="var(--text-muted)" />
                <span>{giveaway.winnerCount} Winner(s)</span>
              </div>
            </div>

            {/* Winners Announcement */}
            {isEnded && giveaway.winners && giveaway.winners.length > 0 && (
              <div style={styles.winnersBox}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#fbbf24', marginBottom: '8px' }}>
                  🎉 Winners 🎉
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

            {/* Entry Form */}
            {!isEnded && (
              <div style={styles.entrySection}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Complete Tasks to Enter</h2>

                {/* Step 1: Discord Check */}
                {!user ? (
                  <div style={styles.taskItemPending}>
                    <div style={styles.taskDetails}>
                      <strong>Step 1: Authenticate Discord</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You must link Discord to log entry.</span>
                    </div>
                    <button onClick={() => discordLogin(`/giveaways?id=${giveawayId}`)} className="btn btn-discord" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                      Login Discord
                    </button>
                  </div>
                ) : (
                  <div style={styles.taskItemSuccess}>
                    <div style={styles.taskDetails}>
                      <strong>✓ Discord Authenticated</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Logged in as {user.username}</span>
                    </div>
                  </div>
                )}

                {/* Tasks loop */}
                {giveaway.tasks?.map((task: any) => {
                  const isCompleted = tasksCompleted[task.id] === true;

                  if (task.type === 'wallet_input') {
                    return (
                      <div key={task.id} style={isCompleted || localWalletInput ? styles.taskItemSuccess : styles.taskItemPending}>
                        <div style={styles.taskDetails}>
                          <strong>EVM Wallet Address Submission {task.required && '*'}</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Submit wallet for reward distribution.</span>
                          
                          {/* Wallet input field */}
                          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', width: '100%' }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="0x..."
                              value={localWalletInput}
                              onChange={(e) => {
                                setLocalWalletInput(e.target.value);
                                handleTaskComplete(task.id, /^0x[a-fA-F0-9]{40}$/.test(e.target.value));
                              }}
                              disabled={hasEntered}
                              style={{ flexGrow: 1 }}
                            />
                            {!isConnected && !hasEntered && (
                              <button onClick={connectWallet} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                                Connect Wallet
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Social/Link tasks
                  return (
                    <div key={task.id} style={isCompleted ? styles.taskItemSuccess : styles.taskItemPending}>
                      <div style={styles.taskDetails}>
                        <strong>{task.label} {task.required && '*'}</strong>
                        {task.url && (
                          <a href={task.url} target="_blank" rel="noopener noreferrer" style={styles.taskLink} onClick={() => handleTaskComplete(task.id, true)}>
                            Open Action Link <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      
                      {!hasEntered && (
                        <button
                          onClick={() => handleTaskComplete(task.id, !isCompleted)}
                          className={isCompleted ? "btn btn-secondary" : "btn btn-primary"}
                          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                        >
                          {isCompleted ? 'Completed' : 'Verify'}
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Final Enter Action */}
                {hasEntered ? (
                  <div style={styles.joinedSuccessBanner}>
                    <CheckCircle size={20} color="var(--success)" />
                    <span>You have already entered this giveaway! Stay tuned for the drawing.</span>
                  </div>
                ) : (
                  <div style={{ marginTop: '30px' }}>
                    <button
                      onClick={handleEnterGiveaway}
                      disabled={!user || submitStatus === 'loading'}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '14px' }}
                    >
                      {submitStatus === 'loading' ? (
                        <>
                          <div className="spinner" style={{ width: '16px', height: '16px' }}></div> Joining...
                        </>
                      ) : (
                        'Submit Entry & Enter Giveaway'
                      )}
                    </button>
                    {submitStatus === 'error' && (
                      <div style={styles.errorText}>{submitMessage}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Giveaways List for a server
  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <div style={styles.iconCircle}>
          <Gift size={36} color="var(--primary)" />
        </div>
        <h1 style={styles.title}>Giveaway Portal</h1>
        <p style={styles.subtitle}>
          Browse active giveaways, complete community tasks, and win roles and NFT rewards.
        </p>
      </div>

      <div style={styles.listLayout}>
        <div className="glass-card" style={{ padding: '24px', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
          <div className="form-group">
            <label className="form-label">Enter Discord Server ID (Guild ID)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 1524220657720885339"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              disabled={!!guildIdFromQuery}
            />
          </div>
        </div>

        {guildId && (
          <div style={styles.resultsWrapper}>
            {loadingList ? (
              <div style={styles.loadingCenter}>
                <div className="spinner"></div>
                <span>Loading giveaways...</span>
              </div>
            ) : giveaways.length > 0 ? (
              <div style={styles.giveawayGrid}>
                {giveaways.map((gw) => {
                  const isGwEnded = gw.status === 'ended' || new Date() > new Date(gw.endTime);
                  return (
                    <div key={gw._id} className="glass-card" style={styles.giveawayCard}>
                      <div style={styles.cardHeader}>
                        <span style={isGwEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
                          {isGwEnded ? 'Ended' : 'Active'}
                        </span>
                        <span style={styles.entriesBadge}>
                          <Users size={12} /> {gw.winnerCount} Winner(s)
                        </span>
                      </div>

                      <h3 style={styles.cardTitle}>{gw.prize}</h3>
                      <p style={styles.cardDesc}>{gw.description}</p>

                      <div style={styles.cardMeta}>
                        <Clock size={14} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {isGwEnded 
                            ? 'Ended' 
                            : formatTimeRemaining(gw.endTime)}
                        </span>
                      </div>

                      <Link href={`/giveaways?id=${gw._id}${guildIdFromQuery ? `&guildId=${guildIdFromQuery}` : ''}`} className="btn btn-secondary" style={{ marginTop: '15px' }}>
                        View Details
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.emptyList}>
                <Gift size={32} color="var(--text-muted)" />
                <h3>No Giveaways Configured</h3>
                <p>We couldn't find any giveaways for this server ID.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GiveawaysPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner"></div>
      </div>
    }>
      <GiveawaysContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    width: '100%',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
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
    marginBottom: '8px',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1.05rem',
    maxWidth: '600px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textDecoration: 'none',
  },
  giveawayWrapper: {
    maxWidth: '700px',
    margin: '0 auto',
    width: '100%',
  },
  mainCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  giveawayHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '12px',
  },
  statusBadgeActive: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadgeEnded: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  giveawayTitle: {
    fontSize: '1.85rem',
    fontWeight: '800',
  },
  giveawayDesc: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    lineHeight: '1.5',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '24px',
    padding: '16px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  metaCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  winnersBox: {
    background: 'rgba(245, 158, 11, 0.05)',
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
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
  },
  code: {
    fontFamily: 'monospace',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#f472b6',
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
    gap: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
  },
  taskItemSuccess: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px',
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
  taskLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    marginTop: '4px',
  },
  joinedSuccessBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    padding: '16px',
    borderRadius: '12px',
    color: '#34d399',
    fontWeight: '600',
    fontSize: '0.9rem',
    marginTop: '16px',
  },
  errorText: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    marginTop: '8px',
    textAlign: 'center',
  },
  listLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  resultsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  giveawayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  giveawayCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entriesBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    flexGrow: 1,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '12px',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '60px 0',
  },
  errorCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '60px 0',
    textAlign: 'center',
  },
  emptyList: {
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
