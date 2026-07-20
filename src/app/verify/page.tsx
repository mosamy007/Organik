'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/components/WalletProvider';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { Shield, CheckCircle, AlertTriangle, ArrowRight, Wallet, Disc, HelpCircle } from 'lucide-react';

function VerifyPortalContent() {
  const searchParams = useSearchParams();
  const guildId = searchParams ? searchParams.get('guildId') : null;

  const { walletAddress, isConnected, connectWallet, disconnectWallet, signMessage } = useWallet();
  const { user, login: discordLogin } = useDiscordAuth();

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [linkedWallets, setLinkedWallets] = useState<string[]>([]);
  const [loadingWallets, setLoadingWallets] = useState<boolean>(false);

  const fetchLinkedWallets = async () => {
    if (!guildId || !user) return;
    setLoadingWallets(true);
    try {
      const res = await fetch(`/api/verify?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.linkedWallets) {
          // Normalize to lowercase for consistency
          setLinkedWallets(data.linkedWallets.map((w: string) => w.toLowerCase()));
        }
      }
    } catch (err) {
      console.error('Failed to load linked wallets:', err);
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    fetchLinkedWallets();
  }, [guildId, user]);

  const handleLinkWallet = async () => {
    if (!user) {
      setStatus('error');
      setStatusMessage('Please link your Discord account first.');
      return;
    }
    if (!isConnected || !walletAddress) {
      setStatus('error');
      setStatusMessage('Please connect your Ethereum wallet first.');
      return;
    }
    if (!guildId) {
      setStatus('error');
      setStatusMessage('Missing guildId. Please open this link from the Discord server.');
      return;
    }

    setStatus('loading');
    setStatusMessage('Generating secure verification message...');

    try {
      const nonce = Math.floor(Math.random() * 1000000);
      const message = `Organik Bot Verification\nDiscord ID: ${user.discordId}\nWallet: ${walletAddress}\nNonce: ${nonce}\nDate: ${new Date().toLocaleDateString()}`;

      setStatusMessage('Please sign the message in your wallet to confirm ownership...');
      const signature = await signMessage(message);

      if (!signature) {
        setStatus('error');
        setStatusMessage('Signature request was rejected.');
        return;
      }

      setStatusMessage('Saving secure link to database...');
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_wallet',
          signature,
          message,
          walletAddress,
          guildId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('success');
        setStatusMessage('Wallet linked successfully! You can now close this window and go back to Discord.');
        fetchLinkedWallets();
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Failed to register wallet link.');
      }
    } catch (err: any) {
      console.error('Wallet link error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const handleDisconnectWallet = async (addrToDisconnect: string) => {
    if (!guildId || !user) return;
    if (!confirm(`Are you sure you want to disconnect wallet ${addrToDisconnect.substring(0, 6)}...${addrToDisconnect.substring(38)}?`)) {
      return;
    }

    setStatus('loading');
    setStatusMessage('Disconnecting wallet...');
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect_wallet',
          walletAddress: addrToDisconnect,
          guildId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setStatusMessage('Wallet disconnected successfully.');
        fetchLinkedWallets();
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Failed to disconnect wallet.');
      }
    } catch (err: any) {
      console.error('Disconnect wallet error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const isCurrentWalletAlreadyLinked = walletAddress
    ? linkedWallets.includes(walletAddress.toLowerCase())
    : false;

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.portalCard} className="glass-card animate-fade-in">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoBadge}>
            <Shield size={32} color="var(--primary)" />
          </div>
          <h1 style={styles.title}>Secure Wallet Linking</h1>
          <p style={styles.subtitle}>
            Link your EVM wallet to your Discord account to verify NFT roles in your server.
          </p>
        </div>

        {/* Steps container */}
        <div style={styles.stepsContainer}>
          {/* Step 1: Discord */}
          <div style={styles.stepRow}>
            <div style={styles.stepNumberContainer}>
              {user ? (
                <div style={styles.stepCheck}>✓</div>
              ) : (
                <span style={styles.stepNum}>1</span>
              )}
            </div>
            <div style={styles.stepInfo}>
              <h3 style={styles.stepTitle}>Discord Authentication</h3>
              <p style={styles.stepDesc}>Link your Discord account to associate with your wallet.</p>
            </div>
            <div style={styles.stepAction}>
              {user ? (
                <div style={styles.pillSuccess}>
                  <Disc size={14} />
                  <span>{user.username}</span>
                </div>
              ) : (
                <button
                  onClick={() => discordLogin(`/verify?guildId=${guildId || ''}`)}
                  style={styles.discordButton}
                >
                  Link Discord
                </button>
              )}
            </div>
          </div>

          {/* Connected Wallets List Section */}
          {user && (
            <div style={styles.linkedSection}>
              <h3 style={styles.sectionTitle}>Currently Linked Wallets</h3>
              {loadingWallets ? (
                <div style={styles.loadingSpinnerContainer}>
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                </div>
              ) : linkedWallets.length === 0 ? (
                <p style={styles.noWalletsText}>No wallets linked yet. Link a wallet containing your NFTs below.</p>
              ) : (
                <div style={styles.walletsList}>
                  {linkedWallets.map((addr) => (
                    <div key={addr} style={styles.walletRow}>
                      <div style={styles.walletAddressInfo}>
                        <Wallet size={16} color="var(--primary)" />
                        <span style={styles.walletAddressText}>
                          {addr.substring(0, 6)}...{addr.substring(addr.length - 4)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDisconnectWallet(addr)}
                        style={styles.disconnectBtn}
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Wallet */}
          <div style={styles.stepRow}>
            <div style={styles.stepNumberContainer}>
              {isConnected && walletAddress ? (
                <div style={styles.stepCheck}>✓</div>
              ) : (
                <span style={styles.stepNum}>2</span>
              )}
            </div>
            <div style={styles.stepInfo}>
              <h3 style={styles.stepTitle}>Connect Web3 Wallet</h3>
              <p style={styles.stepDesc}>Connect your wallet containing the required NFTs.</p>
            </div>
            <div style={styles.stepAction}>
              {isConnected && walletAddress ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={styles.pillSuccess}>
                    <Wallet size={14} />
                    <span>
                      {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                    </span>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button onClick={connectWallet} style={styles.walletButton}>
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main CTA */}
        {status !== 'success' && (
          <div style={styles.ctaWrapper}>
            <button
              onClick={handleLinkWallet}
              disabled={!user || !isConnected || isCurrentWalletAlreadyLinked || status === 'loading'}
              style={styles.mainCtaBtn}
              className="btn btn-primary"
            >
              {status === 'loading' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  Processing...
                </div>
              ) : isCurrentWalletAlreadyLinked ? (
                <span>Wallet Already Linked</span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span>Finalize Wallet Link</span>
                  <ArrowRight size={16} />
                </div>
              )}
            </button>
          </div>
        )}

        {/* Status display */}
        {status !== 'idle' && (
          <div style={styles.statusBox}>
            {status === 'loading' && (
              <div style={styles.statusLoading}>
                <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                <span style={styles.statusText}>{statusMessage}</span>
              </div>
            )}
            {status === 'success' && (
              <div style={styles.statusSuccess} className="animate-scale-in">
                <CheckCircle size={32} color="var(--success)" />
                <div style={styles.successWrapper}>
                  <h4 style={styles.successTitle}>Action Successful!</h4>
                  <p style={styles.successText}>
                    {statusMessage} You can return to Discord and click **"Verify NFT Roles"** to update your server roles.
                  </p>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div style={styles.statusError}>
                <AlertTriangle size={24} color="var(--error)" />
                <span style={styles.errorText}>{statusMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Helper info */}
        <div style={styles.helpText}>
          <HelpCircle size={14} color="var(--text-muted)" />
          <span>We do not store your private keys or transfer assets. Only signed message verification.</span>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPortalPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.pageWrapper}>
          <div className="spinner"></div>
        </div>
      }
    >
      <VerifyPortalContent />
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
    gap: '30px',
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
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  stepRow: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    padding: '16px',
    borderRadius: '14px',
  },
  stepNumberContainer: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
  },
  stepNum: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  stepCheck: {
    fontSize: '1rem',
    fontWeight: '800',
    color: 'var(--success)',
  },
  stepInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  stepTitle: {
    fontSize: '0.95rem',
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  stepAction: {
    display: 'flex',
    alignItems: 'center',
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
    transition: 'all 0.2s ease',
  },
  walletButton: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fbbf24',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  pillSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  ctaWrapper: {
    marginTop: '10px',
  },
  mainCtaBtn: {
    width: '100%',
    padding: '14px',
    fontSize: '0.95rem',
    fontWeight: '700',
    borderRadius: '12px',
  },
  statusBox: {
    marginTop: '10px',
  },
  statusLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(139, 92, 246, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    padding: '14px',
    borderRadius: '12px',
  },
  statusText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
  },
  statusSuccess: {
    display: 'flex',
    gap: '16px',
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    padding: '20px',
    borderRadius: '12px',
  },
  successWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  successTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--success)',
  },
  successText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
  },
  statusError: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    padding: '14px',
    borderRadius: '12px',
  },
  errorText: {
    fontSize: '0.85rem',
    color: 'var(--error)',
  },
  helpText: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  linkedSection: {
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px dashed rgba(255, 255, 255, 0.08)',
    padding: '18px',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  },
  loadingSpinnerContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '10px 0',
  },
  noWalletsText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  walletsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  walletRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    padding: '10px 14px',
    borderRadius: '10px',
  },
  walletAddressInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  walletAddressText: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
  },
  disconnectBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--error)',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    opacity: 0.8,
    transition: 'all 0.2s ease',
  },
};
