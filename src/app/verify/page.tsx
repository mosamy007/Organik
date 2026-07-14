'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWallet } from '@/components/WalletProvider';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { Shield, CheckCircle, AlertTriangle, ArrowRight, Wallet, Disc, HelpCircle } from 'lucide-react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const guildIdFromQuery = searchParams ? searchParams.get('guildId') : null;

  const { walletAddress, isConnected, connectWallet, signMessage } = useWallet();
  const { user, login: discordLogin } = useDiscordAuth();

  // State
  const [guildId, setGuildId] = useState<string>('');
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [tokenId, setTokenId] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [requiresTokenId, setRequiresTokenId] = useState<boolean>(false);

  // Set guild ID from query param
  useEffect(() => {
    if (guildIdFromQuery) {
      setGuildId(guildIdFromQuery);
    }
  }, [guildIdFromQuery]);

  // Load rules when guildId changes
  useEffect(() => {
    const fetchRules = async () => {
      if (!guildId) return;
      setLoadingRules(true);
      setRules([]);
      setSelectedRuleId('');
      try {
        const res = await fetch(`/api/verify?guildId=${guildId}`);
        if (res.ok) {
          const data = await res.json();
          setRules(data.rules || []);
          if (data.rules && data.rules.length > 0) {
            setSelectedRuleId(data.rules[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch rules:', err);
      } finally {
        setLoadingRules(false);
      }
    };
    fetchRules();
  }, [guildId]);

  const handleVerify = async () => {
    if (!isConnected || !walletAddress) {
      setStatus('error');
      setStatusMessage('Please connect your EVM wallet first.');
      return;
    }
    if (!user) {
      setStatus('error');
      setStatusMessage('Please log in with Discord first.');
      return;
    }
    if (!guildId) {
      setStatus('error');
      setStatusMessage('Please enter a Discord Guild ID.');
      return;
    }
    if (!selectedRuleId) {
      setStatus('error');
      setStatusMessage('No verification rules found for this server.');
      return;
    }

    const selectedRule = rules.find((r) => r._id === selectedRuleId);
    if (!selectedRule) return;

    setStatus('loading');
    setStatusMessage('Generating security message to sign...');
    setRequiresTokenId(false);

    try {
      // 1. Create message to sign
      const nonce = Math.floor(Math.random() * 1000000);
      const message = `Organik Bot Verification\nDiscord ID: ${user.discordId}\nWallet: ${walletAddress}\nNonce: ${nonce}\nDate: ${new Date().toLocaleDateString()}`;

      // 2. Request signature
      setStatusMessage('Please sign the cryptographic message in your wallet...');
      const signature = await signMessage(message);

      if (!signature) {
        setStatus('error');
        setStatusMessage('Signature request was rejected by user.');
        return;
      }

      // 3. Post verification payload
      setStatusMessage('Verifying holdings and assigning Discord roles...');
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          message,
          walletAddress,
          guildId,
          ruleId: selectedRuleId,
          tokenId: selectedRule.ruleType === 'trait' ? tokenId : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setStatusMessage(data.message || 'Verification successful! Role has been assigned.');
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Verification failed.');
        if (data.requiresTokenId) {
          setRequiresTokenId(true);
        }
      }
    } catch (err: any) {
      console.error('Verification flow error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred during verification.');
    }
  };

  const getNetworkLabel = (net: string) => {
    switch (net) {
      case 'ethereum': return 'Ethereum Mainnet';
      case 'sepolia': return 'Sepolia Testnet';
      case 'polygon': return 'Polygon Network';
      case 'arbitrum': return 'Arbitrum One';
      case 'optimism': return 'Optimism';
      case 'base': return 'Base';
      default: return net;
    }
  };

  const activeRule = rules.find((r) => r._id === selectedRuleId);

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <div style={styles.iconCircle}>
          <Shield size={36} color="var(--primary)" />
        </div>
        <h1 style={styles.title}>NFT Role Verification</h1>
        <p style={styles.subtitle}>
          Connect your Discord account and EVM wallet to verify your holdings and gain exclusive server roles.
        </p>
      </div>

      <div style={styles.layout}>
        {/* Verification Card */}
        <div className="glass-card" style={styles.card}>
          {/* Step 1: Discord Connection */}
          <div style={styles.step}>
            <div style={styles.stepHeader}>
              <span style={styles.stepNumber}>1</span>
              <h3 style={styles.stepTitle}>Connect Discord</h3>
            </div>
            {user ? (
              <div style={styles.connectedBox}>
                <Disc size={20} color="var(--success)" />
                <div>
                  <div style={styles.connectedLabel}>Connected as</div>
                  <div style={styles.connectedValue}>{user.username}</div>
                </div>
              </div>
            ) : (
              <button onClick={() => discordLogin(`/verify?guildId=${guildId}`)} style={styles.btnFullDiscord}>
                Log In with Discord
              </button>
            )}
          </div>

          {/* Step 2: Wallet Connection */}
          <div style={styles.step}>
            <div style={styles.stepHeader}>
              <span style={styles.stepNumber}>2</span>
              <h3 style={styles.stepTitle}>Connect Wallet</h3>
            </div>
            {isConnected && walletAddress ? (
              <div style={styles.connectedBox}>
                <Wallet size={20} color="var(--success)" />
                <div>
                  <div style={styles.connectedLabel}>Wallet Connected</div>
                  <div style={styles.connectedValue}>
                    {walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={connectWallet} style={styles.btnFullWeb3}>
                Connect Ethereum Wallet
              </button>
            )}
          </div>

          {/* Step 3: Server & Rule Configuration */}
          <div style={styles.step}>
            <div style={styles.stepHeader}>
              <span style={styles.stepNumber}>3</span>
              <h3 style={styles.stepTitle}>Verification Configuration</h3>
            </div>
            
            <div className="form-group">
              <label className="form-label">Discord Server ID (Guild ID)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 1524220657720885339"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                disabled={!!guildIdFromQuery}
              />
            </div>

            {guildId && (
              <>
                {loadingRules ? (
                  <div style={styles.loadingWrapper}>
                    <div className="spinner"></div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading verification rules...</span>
                  </div>
                ) : rules.length > 0 ? (
                  <div className="form-group">
                    <label className="form-label">Select Verification Rule</label>
                    <select
                      className="form-select"
                      value={selectedRuleId}
                      onChange={(e) => {
                        setSelectedRuleId(e.target.value);
                        setRequiresTokenId(false);
                      }}
                    >
                      {rules.map((rule) => (
                        <option key={rule._id} value={rule._id}>
                          {rule.ruleType === 'quantity'
                            ? `Hold >= ${rule.minQuantity} NFT(s)`
                            : `Trait: ${rule.traitType} = ${rule.traitValue}`}{' '}
                          ({getNetworkLabel(rule.network)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={styles.emptyRules}>
                    <AlertTriangle size={18} color="var(--warning)" />
                    <span>No verification setups found for this server. Contact the admin.</span>
                  </div>
                )}
              </>
            )}

            {activeRule && activeRule.ruleType === 'trait' && (
              <div className="form-group animate-fade-in">
                <label className="form-label">
                  Token ID <span style={{ color: 'var(--text-muted)' }}>(Required for Trait checking)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 4022"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                />
                <span style={styles.inputHelp}>
                  <HelpCircle size={12} /> Input the specific NFT Token ID you own from this contract to verify its traits.
                </span>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          <button
            onClick={handleVerify}
            disabled={!user || !isConnected || !selectedRuleId || status === 'loading'}
            style={styles.verifyBtn}
            className="btn btn-primary"
          >
            {status === 'loading' ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div> Verifying...
              </>
            ) : (
              <>
                Verify NFT Ownership <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Status Window */}
        <div style={styles.statusPanel}>
          {status === 'idle' && (
            <div className="glass-card" style={styles.statusCardIdle}>
              <h3 style={styles.statusTitleText}>Verification Status</h3>
              <p style={styles.statusBodyText}>
                Please complete Steps 1 & 2, confirm the server settings in Step 3, and click "Verify NFT Ownership" to run checks.
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="glass-card" style={styles.statusCardLoading}>
              <div className="spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }}></div>
              <h3 style={styles.statusTitleText}>Processing Verification</h3>
              <p style={styles.statusBodyText}>{statusMessage}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="glass-card" style={styles.statusCardSuccess}>
              <CheckCircle size={40} color="var(--success)" style={{ marginBottom: '16px' }} />
              <h3 style={{ ...styles.statusTitleText, color: 'var(--success)' }}>Verification Successful</h3>
              <p style={styles.statusBodyText}>{statusMessage}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="glass-card" style={styles.statusCardError}>
              <AlertTriangle size={40} color="var(--error)" style={{ marginBottom: '16px' }} />
              <h3 style={{ ...styles.statusTitleText, color: 'var(--error)' }}>Verification Failed</h3>
              <p style={styles.statusBodyText}>{statusMessage}</p>
              {requiresTokenId && (
                <div style={styles.inlineInfo}>
                  <strong>Notice:</strong> Automatic background scanning is unavailable because the developer hasn't configured an API key. You must manually input a Token ID you own in Step 3.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner"></div>
      </div>
    }>
      <VerifyContent />
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
    gap: '40px',
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
  layout: {
    display: 'grid',
    gridTemplateColumns: '3fr 2fr',
    gap: '30px',
    alignItems: 'start',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '24px',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  stepNumber: {
    background: 'var(--primary)',
    color: 'white',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: '700',
    fontFamily: 'var(--font-display)',
  },
  stepTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
  },
  connectedBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    padding: '12px 16px',
    borderRadius: '12px',
  },
  connectedLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  connectedValue: {
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  btnFullDiscord: {
    background: '#5865f2',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s ease',
  },
  btnFullWeb3: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fbbf24',
    padding: '12px 20px',
    borderRadius: '10px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s ease',
  },
  loadingWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
  },
  emptyRules: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
    padding: '12px 16px',
    borderRadius: '12px',
    color: 'var(--warning)',
    fontSize: '0.9rem',
  },
  inputHelp: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  verifyBtn: {
    width: '100%',
    padding: '14px 20px',
    fontSize: '1rem',
  },
  statusPanel: {
    position: 'sticky',
    top: '110px',
  },
  statusCardIdle: {
    borderLeft: '4px solid var(--text-muted)',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  statusCardLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    borderLeft: '4px solid var(--primary)',
  },
  statusCardSuccess: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    borderLeft: '4px solid var(--success)',
    background: 'rgba(16, 185, 129, 0.02)',
  },
  statusCardError: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    borderLeft: '4px solid var(--error)',
    background: 'rgba(239, 68, 68, 0.02)',
  },
  statusTitleText: {
    fontSize: '1.2rem',
    fontWeight: '700',
    marginBottom: '8px',
  },
  statusBodyText: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: '1.5',
  },
  inlineInfo: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '16px',
    fontSize: '0.8rem',
    textAlign: 'left',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
};
