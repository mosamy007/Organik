'use client';

import React, { useState, useEffect, use } from 'react';
import { X, TrendingUp, Plus, Trash2, Save, AlertCircle, CheckCircle2, Loader2, Coins } from 'lucide-react';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

interface Contract {
  address: string;
  chain: string;
  name: string;
  slug: string;
}

export default function IntegrationsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;

  // Configuration States
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Twitter State
  const [twitterEnabled, setTwitterEnabled] = useState(false);
  const [twitterChannel, setTwitterChannel] = useState('');
  const [twitterAccounts, setTwitterAccounts] = useState<string[]>([]);
  const [newTwitterInput, setNewTwitterInput] = useState('');

  // Sales State
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [salesChannel, setSalesChannel] = useState('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [newContractAddress, setNewContractAddress] = useState('');
  const [newContractChain, setNewContractChain] = useState('ethereum');
  const [newContractName, setNewContractName] = useState('');

  // Load configuration
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/integrations?guildId=${guildId}`);
        if (res.ok) {
          const data = await res.json();
          setChannels(data.channels || []);
          
          if (data.integrations) {
            const { twitter, sales } = data.integrations;
            
            setTwitterEnabled(!!twitter?.enabled);
            setTwitterChannel(twitter?.channelId || '');
            setTwitterAccounts(twitter?.accounts || []);
            
            setSalesEnabled(!!sales?.enabled);
            setSalesChannel(sales?.channelId || '');
            setContracts(sales?.contracts || []);
          }
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setStatusMessage(data.error || 'Failed to load integration settings.');
        }
      } catch (err) {
        console.error('Error fetching integrations config:', err);
        setStatus('error');
        setStatusMessage('Network error loading integrations config.');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [guildId]);

  // Handle adding Twitter account
  const handleAddTwitter = () => {
    let inputVal = newTwitterInput.trim();
    if (!inputVal) return;
    
    // If it's a direct URL, preserve it; otherwise clean username
    const entry = (inputVal.startsWith('http://') || inputVal.startsWith('https://')) 
      ? inputVal 
      : inputVal.replace('@', '');

    if (twitterAccounts.includes(entry)) {
      alert('This Twitter account/feed is already added.');
      return;
    }
    setTwitterAccounts([...twitterAccounts, entry]);
    setNewTwitterInput('');
  };

  // Handle deleting Twitter account
  const handleRemoveTwitter = (indexToRemove: number) => {
    setTwitterAccounts(twitterAccounts.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle adding NFT Contract
  const handleAddContract = () => {
    const address = newContractAddress.trim().toLowerCase();
    if (!address) {
      alert('Please enter a contract address.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      alert('Please enter a valid Ethereum/Base contract address.');
      return;
    }
    if (contracts.some(c => c.address.toLowerCase() === address)) {
      alert('This contract address is already added.');
      return;
    }

    const newContract: Contract = {
      address,
      chain: newContractChain,
      name: newContractName.trim() || 'Unnamed Collection',
      slug: '', // Will be resolved by the backend OpenSea API lookup on save
    };

    setContracts([...contracts, newContract]);
    setNewContractAddress('');
    setNewContractName('');
  };

  // Handle deleting NFT Contract
  const handleRemoveContract = (indexToRemove: number) => {
    setContracts(contracts.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Save
  const handleSaveSettings = async () => {
    setSubmitting(true);
    setStatus('idle');
    setStatusMessage('');

    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guildId,
          twitter: {
            enabled: twitterEnabled,
            channelId: twitterChannel,
            accounts: twitterAccounts,
          },
          sales: {
            enabled: salesEnabled,
            channelId: salesChannel,
            contracts,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus('success');
        setStatusMessage('Integration settings updated successfully!');
        if (data.integrations?.sales?.contracts) {
          // Update resolved names/slugs returned from backend
          setContracts(data.integrations.sales.contracts);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setStatusMessage(data.error || 'Failed to save integrations.');
      }
    } catch (err) {
      console.error('Error saving integrations settings:', err);
      setStatus('error');
      setStatusMessage('Network error saving settings.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingCenter}>
        <Loader2 className="spinner" size={32} />
        <span>Loading integrations settings...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Server Integrations</h1>
        <p style={styles.description}>
          Automate announcements in your Discord server. Monitored Twitter/X posts and real-time NFT sales alerts.
        </p>
      </div>

      {status !== 'idle' && (
        <div className={`status-banner ${status === 'success' ? 'status-success' : 'status-error'}`} style={styles.banner}>
          {status === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{statusMessage}</span>
        </div>
      )}

      <div style={styles.grid}>
        {/* Twitter Integration Card */}
        <div className="glass-card" style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.titleGroup}>
              <X size={24} color="#f8fafc" />
              <h2 style={styles.cardTitle}>Twitter/X Feed</h2>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={twitterEnabled} 
                onChange={(e) => setTwitterEnabled(e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div style={{ ...styles.cardBody, opacity: twitterEnabled ? 1 : 0.6, pointerEvents: twitterEnabled ? 'auto' : 'none' }}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Announcement Target Channel</label>
              <select 
                className="form-input" 
                value={twitterChannel} 
                onChange={(e) => setTwitterChannel(e.target.value)}
                disabled={!twitterEnabled}
              >
                <option value="">-- Select Channel --</option>
                {channels.map((chan) => (
                  <option key={chan.id} value={chan.id}>
                    # {chan.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.subSection}>
              <label className="form-label">Monitored Twitter Handles / RSS Feeds</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', marginTop: '-4px' }}>
                Enter a Twitter username (e.g. <code>organik_concepts</code>) or paste a direct RSS Feed URL (e.g. from <code>RSS.app</code> or <code>FetchRSS</code>) for 100% reliability.
              </p>
              <div style={styles.inputRow}>
                <div style={styles.handleInputContainer}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Username or RSS Feed URL" 
                    value={newTwitterInput}
                    onChange={(e) => setNewTwitterInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTwitter()}
                    disabled={!twitterEnabled}
                    style={{ paddingLeft: '12px' }}
                  />
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleAddTwitter}
                  disabled={!twitterEnabled}
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              <div style={styles.listContainer}>
                {twitterAccounts.length === 0 ? (
                  <div style={styles.emptyList}>No Twitter handles or RSS Feeds monitored yet.</div>
                ) : (
                  <ul style={styles.list}>
                    {twitterAccounts.map((handle, idx) => (
                      <li key={idx} style={styles.listItem}>
                        <span style={{ wordBreak: 'break-all', paddingRight: '8px' }}>
                          {handle.startsWith('http') ? handle : `@${handle}`}
                        </span>
                        <button 
                          style={styles.deleteBtn} 
                          onClick={() => handleRemoveTwitter(idx)}
                          title="Remove Account"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* NFT Sales Tracker Card */}
        <div className="glass-card" style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.titleGroup}>
              <TrendingUp size={24} color="var(--secondary)" />
              <h2 style={styles.cardTitle}>NFT Sales Tracker</h2>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={salesEnabled} 
                onChange={(e) => setSalesEnabled(e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div style={{ ...styles.cardBody, opacity: salesEnabled ? 1 : 0.6, pointerEvents: salesEnabled ? 'auto' : 'none' }}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Sales Announcement Target Channel</label>
              <select 
                className="form-input" 
                value={salesChannel} 
                onChange={(e) => setSalesChannel(e.target.value)}
                disabled={!salesEnabled}
              >
                <option value="">-- Select Channel --</option>
                {channels.map((chan) => (
                  <option key={chan.id} value={chan.id}>
                    # {chan.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.subSection}>
              <label className="form-label">Monitored NFT Contracts</label>
              
              <div style={styles.contractForm}>
                <div className="form-group">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Contract Address (0x...)" 
                    value={newContractAddress}
                    onChange={(e) => setNewContractAddress(e.target.value)}
                    disabled={!salesEnabled}
                  />
                </div>
                
                <div style={styles.row}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Display Name (optional)" 
                      value={newContractName}
                      onChange={(e) => setNewContractName(e.target.value)}
                      disabled={!salesEnabled}
                    />
                  </div>
                  <div className="form-group" style={{ width: '130px' }}>
                    <select 
                      className="form-input"
                      value={newContractChain} 
                      onChange={(e) => setNewContractChain(e.target.value)}
                      disabled={!salesEnabled}
                    >
                      <option value="ethereum">Ethereum</option>
                      <option value="base">Base</option>
                    </select>
                  </div>
                </div>

                <button 
                  className="btn btn-secondary" 
                  onClick={handleAddContract}
                  disabled={!salesEnabled}
                  style={{ width: '100%' }}
                >
                  <Plus size={16} /> Add NFT Collection Contract
                </button>
              </div>

              <div style={styles.listContainer}>
                {contracts.length === 0 ? (
                  <div style={styles.emptyList}>No NFT collections monitored yet.</div>
                ) : (
                  <div style={styles.contractList}>
                    {contracts.map((c, idx) => (
                      <div key={idx} style={styles.contractItem}>
                        <div style={styles.contractMeta}>
                          <div style={styles.contractHeading}>
                            <span style={styles.contractTitle}>{c.name}</span>
                            <span style={{ 
                              ...styles.badge, 
                              backgroundColor: c.chain === 'base' ? 'rgba(0, 82, 255, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                              color: c.chain === 'base' ? '#0052ff' : 'var(--primary)'
                            }}>
                              {c.chain}
                            </span>
                            {c.slug && (
                              <span style={{ ...styles.badge, backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                OpenSea slug: {c.slug}
                              </span>
                            )}
                          </div>
                          <span style={styles.contractAddress}>{c.address}</span>
                        </div>
                        <button 
                          style={styles.deleteBtn} 
                          onClick={() => handleRemoveContract(idx)}
                          title="Remove Collection"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button 
          className="btn btn-primary" 
          onClick={handleSaveSettings}
          disabled={submitting}
          style={{ width: '220px', gap: '8px' }}
        >
          {submitting ? <Loader2 className="spinner" size={18} /> : <Save size={18} />}
          {submitting ? 'Saving...' : 'Save Integrations'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    height: '60vh',
    width: '100%',
    color: 'var(--text-secondary)',
  },
  header: {
    marginBottom: '30px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    marginBottom: '8px',
  },
  description: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
  },
  banner: {
    padding: '16px 20px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    fontSize: '0.95rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
    gap: '24px',
    marginBottom: '30px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    height: 'fit-content',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    transition: 'opacity 0.3s ease',
  },
  subSection: {
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '20px',
    marginTop: '10px',
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
  },
  handleInputContainer: {
    position: 'relative',
    flexGrow: 1,
  },
  atSymbol: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    pointerEvents: 'none',
  },
  listContainer: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    minHeight: '120px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  emptyList: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textAlign: 'center',
    padding: '40px 20px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    fontSize: '0.95rem',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },
  contractForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  contractList: {
    display: 'flex',
    flexDirection: 'column',
  },
  contractItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
  },
  contractMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  contractHeading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  contractTitle: {
    fontWeight: '600',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  contractAddress: {
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase' as any,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '20px',
  },
};
