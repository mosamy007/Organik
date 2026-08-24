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
  const [customTextInputs, setCustomTextInputs] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  // X (Twitter) Task Verification state
  const [xHandles, setXHandles] = useState<Record<string, string>>({});
  const [xVerifying, setXVerifying] = useState<Record<string, boolean>>({});
  const [xVerifyError, setXVerifyError] = useState<Record<string, string>>({});

  const handleVerifyXFollow = async (task: any) => {
    const handle = xHandles[task.id];
    if (!handle || !handle.trim()) {
      setXVerifyError((prev) => ({ ...prev, [task.id]: 'Please enter your X username (@handle).' }));
      return;
    }

    setXVerifying((prev) => ({ ...prev, [task.id]: true }));
    setXVerifyError((prev) => ({ ...prev, [task.id]: '' }));

    try {
      const res = await fetch('/api/verify/x-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userHandle: handle.trim(),
          targetUrl: task.url,
        }),
      });

      const data = await res.json();
      if (res.ok && data.verified) {
        handleTaskComplete(task.id, true);
        setXVerifyError((prev) => ({ ...prev, [task.id]: '' }));
      } else {
        setXVerifyError((prev) => ({
          ...prev,
          [task.id]: data.error || 'Follow verification failed. Make sure you followed the account.',
        }));
      }
    } catch (err) {
      console.error('Verify X Follow error:', err);
      setXVerifyError((prev) => ({ ...prev, [task.id]: 'An error occurred while verifying follow.' }));
    } finally {
      setXVerifying((prev) => ({ ...prev, [task.id]: false }));
    }
  };

  // Redirect to Discord OAuth if not logged in
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
          if (data.userEntryDetails?.customTextAnswers) {
            setCustomTextInputs(data.userEntryDetails.customTextAnswers);
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

    // Validate required custom text tasks
    const customTextTasks = giveaway.tasks?.filter((t: any) => t.type === 'custom_text') || [];
    for (const ctTask of customTextTasks) {
      const userVal = (customTextInputs[ctTask.id] || '').trim();
      if (ctTask.required !== false && !userVal) {
        setSubmitStatus('error');
        setSubmitMessage(`Please fill in the required field: "${ctTask.label || 'Custom Text'}"`);
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
          customTextAnswers: customTextInputs,
          xHandles,
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

  if (giveawayId) {
    if (loadingDetail) {
      return (
        <div style={styles.pageWrapper}>
          <div style={styles.loadingCenter}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading giveaway details...</p>
          </div>
        </div>
      );
    }

    if (!giveaway) {
      return (
        <div style={styles.pageWrapper}>
          <div style={styles.portalCard} className="glass-card">
            <div style={styles.errorCenter}>
              <ShieldAlert size={48} color="var(--error)" />
              <h2>Giveaway Not Found</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                This giveaway may have been removed or the link is invalid.
              </p>
              {guildId && (
                <Link href={`/giveaways?guildId=${guildId}`} style={styles.viewDetailsBtn}>
                  View All Giveaways
                </Link>
              )}
            </div>
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
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              {guildId ? (
                <Link href={`/giveaways?guildId=${guildId}`} style={styles.backLink}>
                  <ArrowLeft size={16} /> All Giveaways
                </Link>
              ) : (
                <div />
              )}
              <span style={isEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
                {isEnded ? 'Ended' : 'Active'}
              </span>
            </div>

            <div style={styles.logoBadge}>
              <Gift size={32} color="var(--primary)" />
            </div>

            <h1 style={styles.prizeTitle}>{giveaway.prize}</h1>
            {giveaway.description && <p style={styles.prizeDesc}>{giveaway.description}</p>}

            <div style={styles.metaRow}>
              <div style={styles.metaItem}>
                <Clock size={14} color="var(--text-muted)" />
                <span>{isEnded ? 'Ended' : formatTimeRemaining(giveaway.endTime)}</span>
              </div>
              <div style={styles.metaItem}>
                <Users size={14} color="var(--text-muted)" />
                <span>{totalEntries} Entered</span>
              </div>
              <div style={styles.metaItem}>
                <Gift size={14} color="var(--text-muted)" />
                <span>{giveaway.winnerCount} Winner(s)</span>
              </div>
            </div>
          </div>

          {/* Banner Image */}
          {giveaway.imageUrl && (
            <div style={styles.bannerWrapper}>
              <img src={giveaway.imageUrl} alt={giveaway.prize} style={styles.bannerImg} />
            </div>
          )}

          {/* Winner Announcement if Ended */}
          {isEnded && giveaway.winners && giveaway.winners.length > 0 && (
            <div style={styles.winnerSection}>
              <h3 style={styles.winnerTitle}>🏆 Winner(s) Drawn</h3>
              <div style={styles.winnerList}>
                {giveaway.winners.map((w: any, idx: number) => {
                  const username = typeof w === 'object' ? (w.username || w.discordId) : w;
                  const wallet = typeof w === 'object' && w.walletAddress ? ` (${w.walletAddress})` : '';
                  return (
                    <div key={idx} style={styles.winnerItem}>
                      🎉 <strong>@{username}</strong>{wallet ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{wallet}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Discord Authentication Status */}
          <div style={styles.authSection}>
            <h3 style={styles.sectionTitle}>1. Discord Authentication</h3>
            {user ? (
              <div style={styles.userCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {user.avatar ? (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
                      alt={user.username}
                      style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                    />
                  ) : (
                    <div style={styles.avatarPlaceholder}>{user.username.charAt(0).toUpperCase()}</div>
                  )}
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>@{user.username}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Discord ID: {user.discordId}</div>
                  </div>
                </div>
                <div style={styles.pillSuccess}>
                  <CheckCircle size={14} /> Connected
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  You must authorize with Discord to verify your server roles and enter.
                </p>
                <button onClick={() => discordLogin()} style={styles.discordLoginBtn}>
                  <Disc size={16} /> Login with Discord
                </button>
              </div>
            )}
          </div>

          {/* Web3 Wallet Connection (Optional / Automatic) */}
          <div style={styles.authSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={styles.sectionTitle}>2. Wallet Connection (Optional)</h3>
              {isConnected && (
                <button onClick={disconnectWallet} style={styles.disconnectBtn}>
                  Disconnect
                </button>
              )}
            </div>
            {isConnected ? (
              <div style={styles.userCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Wallet size={20} color="#a78bfa" />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                      {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Connected Web3 Wallet</div>
                  </div>
                </div>
                <div style={styles.pillSuccess}>
                  <CheckCircle size={14} /> Connected
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Connect your Web3 wallet to automatically auto-fill EVM wallet tasks.
                </p>
                <button onClick={connectWallet} style={styles.connectWalletBtn}>
                  <Wallet size={16} /> Connect Wallet
                </button>
              </div>
            )}
          </div>

          {/* Entry Tasks Checklist */}
          {!isEnded && (
            <div style={styles.authSection}>
              <h3 style={styles.sectionTitle}>3. Complete Entry Tasks</h3>
              
              {giveaway.restrictRoleIds && giveaway.restrictRoleIds.length > 0 && (
                <div style={styles.taskItemPending}>
                  <div style={styles.taskDetails}>
                    <span style={styles.taskLabel}>Discord Server Role Check</span>
                    <span style={styles.taskSub}>
                      Must hold at least one required role in this server.
                    </span>
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

                if (task.type === 'custom_text') {
                  const currentVal = customTextInputs[task.id] || '';
                  const isTaskDone = currentVal.trim().length > 0;

                  return (
                    <div
                      key={task.id}
                      style={isTaskDone ? styles.taskItemSuccess : styles.taskItemPending}
                    >
                      <div style={{ ...styles.taskDetails, width: '100%' }}>
                        <span style={isTaskDone ? styles.taskLabelSuccess : styles.taskLabel}>
                          {isTaskDone ? '✓ ' : ''}{task.label || 'Custom Answer Input'} {task.required !== false && '*'}
                        </span>
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', width: '100%' }}>
                          <input
                            type="text"
                            placeholder={task.placeholder || 'Enter response here...'}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomTextInputs((prev) => ({ ...prev, [task.id]: val }));
                              handleTaskComplete(task.id, task.required !== false ? val.trim().length > 0 : true);
                            }}
                            disabled={hasEntered}
                            style={styles.taskInput}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                const isXTask = task.url && (task.url.includes('x.com') || task.url.includes('twitter.com'));

                if (isXTask) {
                  return (
                    <div key={task.id} style={isCompleted ? styles.taskItemSuccess : styles.taskItemPending}>
                      <div style={{ ...styles.taskDetails, width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={isCompleted ? styles.taskLabelSuccess : styles.taskLabel}>
                            {isCompleted ? '✓ ' : ''}{task.label} {task.required && '*'}
                          </span>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.taskLink}
                          >
                            Open X Profile <ExternalLink size={12} />
                          </a>
                        </div>
                        
                        {!isCompleted && !hasEntered && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Enter your X handle (@username)"
                                value={xHandles[task.id] || ''}
                                onChange={(e) => setXHandles((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                style={styles.taskInput}
                              />
                              <button
                                type="button"
                                onClick={() => handleVerifyXFollow(task)}
                                disabled={xVerifying[task.id]}
                                style={styles.taskBtnAction}
                              >
                                {xVerifying[task.id] ? 'Verifying...' : 'Verify Follow'}
                              </button>
                            </div>
                            {xVerifyError[task.id] && (
                              <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                                {xVerifyError[task.id]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={task.id} style={isCompleted ? styles.taskItemSuccess : styles.taskItemPending}>
                    <div style={styles.taskDetails}>
                      <span style={isCompleted ? styles.taskLabelSuccess : styles.taskLabel}>
                        {isCompleted ? '✓ ' : ''}{task.label} {task.required && '*'}
                      </span>
                      {task.url && (
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.taskLink}
                        >
                          Open Task Link <ExternalLink size={12} />
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
              className="form-input"
            />
          </div>

          {loadingList ? (
            <div style={styles.loadingCenter}>
              <div className="spinner"></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading giveaways...</p>
            </div>
          ) : giveaways.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {giveaways.map((gw) => {
                const isEnded = gw.status === 'ended' || new Date() > new Date(gw.endTime);
                return (
                  <div key={gw._id} style={styles.listItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={isEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
                        {isEnded ? 'Ended' : 'Active'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatTimeRemaining(gw.endTime)}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>{gw.prize}</h3>
                    {gw.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>{gw.description}</p>}

                    <Link href={`/giveaways?id=${gw._id}&guildId=${guildId}`} style={styles.viewDetailsBtn}>
                      Enter Giveaway →
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : guildId ? (
            <div style={styles.emptyList}>No active giveaways found for this Server ID.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function GiveawaysClient() {
  return (
    <Suspense
      fallback={
        <div style={styles.pageWrapper}>
          <div style={styles.loadingCenter}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading giveaway portal...</p>
          </div>
        </div>
      }
    >
      <GiveawaysContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrapper: {
    minHeight: '80vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  portalCard: {
    width: '100%',
    maxWidth: '560px',
    borderRadius: '24px',
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
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  statusBadgeEnded: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginTop: '-4px',
  },
  prizeTitle: {
    fontSize: '1.4rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: '1.3',
  },
  prizeDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: '0',
  },
  metaRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '4px',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    background: 'rgba(255, 255, 255, 0.03)',
    padding: '4px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  bannerWrapper: {
    width: '100%',
    maxHeight: '220px',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  winnerSection: {
    background: 'rgba(251, 191, 36, 0.05)',
    border: '1px solid rgba(251, 191, 36, 0.2)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  winnerTitle: {
    fontSize: '0.9rem',
    color: '#fbbf24',
    margin: 0,
  },
  winnerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '0.85rem',
  },
  winnerItem: {
    color: 'var(--text-primary)',
  },
  authSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  avatarPlaceholder: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  pillSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#34d399',
    padding: '4px 10px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  discordLoginBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: '#5865F2',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  connectWalletBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'rgba(139, 92, 246, 0.15)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    color: '#a78bfa',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disconnectBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  taskItemPending: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  taskItemSuccess: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(16, 185, 129, 0.03)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  taskDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  taskLabel: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  taskLabelSuccess: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#34d399',
  },
  taskSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  taskSubSuccess: {
    fontSize: '0.75rem',
    color: 'rgba(52, 211, 153, 0.7)',
  },
  taskInput: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'white',
    fontSize: '0.8rem',
    width: '100%',
  },
  backLink: {
    display: 'flex',
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
