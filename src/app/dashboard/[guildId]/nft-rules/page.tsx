'use client';

import React, { useState, useEffect, use } from 'react';
import { Shield, Plus, Trash2, CheckCircle2, ShieldAlert, AlertCircle, HelpCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default function NftRulesPage({ params }: PageProps) {
  // Resolve params
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;

  // States
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Form State
  const [contractAddress, setContractAddress] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [network, setNetwork] = useState('ethereum');
  const [ruleType, setRuleType] = useState<'quantity' | 'trait'>('quantity');
  const [minQuantity, setMinQuantity] = useState('1');
  const [traitType, setTraitType] = useState('');
  const [traitValue, setTraitValue] = useState('');

  // Channel & Verification Panel state
  const [channels, setChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [embedTitle, setEmbedTitle] = useState('🔐 Wallet NFT Verification');
  const [embedDesc, setEmbedDesc] = useState('Click the buttons below to verify your NFT holdings and receive your exclusive roles.');
  const [embedImageUrl, setEmbedImageUrl] = useState('');
  const [panelStatus, setPanelStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [panelMessage, setPanelMessage] = useState('');

  // Status
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load rules
  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const res = await fetch(`/api/verify?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Error fetching verification rules:', err);
    } finally {
      setLoadingRules(false);
    }
  };

  // Load roles
  const loadRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch(`/api/roles?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        // Filter out everyone role (which has position 0 or is named @everyone)
        const filteredRoles = (data.roles || []).filter(
          (role: any) => role.name !== '@everyone' && !role.managed
        );
        // Sort by position descending (highest roles first)
        filteredRoles.sort((a: any, b: any) => b.position - a.position);
        setRoles(filteredRoles);
        if (filteredRoles.length > 0) {
          setSelectedRoleId(filteredRoles[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching guild roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  // Load channels
  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch(`/api/channels?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        if (data.channels && data.channels.length > 0) {
          setSelectedChannelId(data.channels[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching guild channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    loadRules();
    loadRoles();
    loadChannels();
  }, [guildId]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress.trim())) {
      setSubmitStatus('error');
      setStatusMessage('Please enter a valid EVM contract address (0x...).');
      return;
    }

    if (!selectedRoleId) {
      setSubmitStatus('error');
      setStatusMessage('Please select a target role to award.');
      return;
    }

    if (ruleType === 'trait' && (!traitType.trim() || !traitValue.trim())) {
      setSubmitStatus('error');
      setStatusMessage('Please enter both trait type and value.');
      return;
    }

    setSubmitStatus('loading');
    setStatusMessage('Creating verification rule...');

    try {
      const payload = {
        guildId,
        contractAddress,
        roleId: selectedRoleId,
        network,
        ruleType,
        minQuantity: ruleType === 'quantity' ? Number(minQuantity) : undefined,
        traitType: ruleType === 'trait' ? traitType : undefined,
        traitValue: ruleType === 'trait' ? traitValue : undefined,
      };

      const res = await fetch('/api/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitStatus('success');
        setStatusMessage('NFT Verification Rule created successfully!');
        // Reset form
        setContractAddress('');
        setMinQuantity('1');
        setTraitType('');
        setTraitValue('');
        // Reload rules
        loadRules();
      } else {
        setSubmitStatus('error');
        setStatusMessage(data.error || 'Failed to create verification rule.');
      }
    } catch (err: any) {
      console.error('Create rule error:', err);
      setSubmitStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this verification rule?')) return;

    try {
      const res = await fetch(`/api/verify?ruleId=${ruleId}&guildId=${guildId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRules((prev) => prev.filter((r) => r._id !== ruleId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete rule.');
      }
    } catch (err) {
      console.error('Delete rule error:', err);
      alert('An error occurred while deleting the rule.');
    }
  };

  const handleSendPanel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChannelId) {
      setPanelStatus('error');
      setPanelMessage('Please select a target channel.');
      return;
    }

    setPanelStatus('loading');
    setPanelMessage('Sending verification panel embed to Discord...');

    try {
      const res = await fetch('/api/verify/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId,
          channelId: selectedChannelId,
          title: embedTitle,
          description: embedDesc,
          imageUrl: embedImageUrl,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPanelStatus('success');
        setPanelMessage('Verification panel sent to Discord channel successfully!');
        setEmbedImageUrl('');
      } else {
        setPanelStatus('error');
        setPanelMessage(data.error || 'Failed to send verification panel.');
      }
    } catch (err: any) {
      console.error('Send panel error:', err);
      setPanelStatus('error');
      setPanelMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    return role ? role.name : roleId;
  };

  const getRoleColor = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.color === 0) return '#ffffff';
    // Convert decimal color to hex
    return `#${role.color.toString(16).padStart(6, '0')}`;
  };

  const getNetworkLabel = (net: string) => {
    switch (net) {
      case 'ethereum': return 'Ethereum';
      case 'sepolia': return 'Sepolia';
      case 'polygon': return 'Polygon';
      case 'arbitrum': return 'Arbitrum';
      case 'optimism': return 'Optimism';
      case 'base': return 'Base';
      default: return net;
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Page Header */}
      <div style={styles.header}>
        <div style={styles.iconCircle}>
          <Shield size={24} color="var(--primary)" />
        </div>
        <div>
          <h1 style={styles.title}>NFT Role Verification Setup</h1>
          <p style={styles.subtitle}>Configure token-gated access roles based on NFT quantity or trait holdings.</p>
        </div>
      </div>

      <div style={styles.layout}>
        {/* Creation Card */}
        <div className="glass-card" style={styles.formCard}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} color="var(--primary)" /> Add Verification Rule
          </h2>

          <form onSubmit={handleCreateRule} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Contract Address (EVM)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                required
              />
            </div>

            <div style={styles.formRow}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Blockchain Network</label>
                <select className="form-select" value={network} onChange={(e) => setNetwork(e.target.value)}>
                  <option value="ethereum">Ethereum Mainnet</option>
                  <option value="base">Base</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum One</option>
                  <option value="optimism">Optimism</option>
                  <option value="sepolia">Sepolia Testnet</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Target Discord Role</label>
                {loadingRoles ? (
                  <div style={styles.loadingSmall}>
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                    <span>Loading roles...</span>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div style={styles.modeTabs}>
              <button
                type="button"
                onClick={() => setRuleType('quantity')}
                style={ruleType === 'quantity' ? styles.activeTab : styles.tab}
              >
                Quantity Rule
              </button>
              <button
                type="button"
                onClick={() => setRuleType('trait')}
                style={ruleType === 'trait' ? styles.activeTab : styles.tab}
              >
                Trait Rule
              </button>
            </div>

            {ruleType === 'quantity' && (
              <div className="form-group animate-fade-in">
                <label className="form-label">Minimum Quantity Held</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  required
                />
              </div>
            )}

            {ruleType === 'trait' && (
              <div style={styles.formRow} className="animate-fade-in">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Trait Type (Attribute Name)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Background"
                    value={traitType}
                    onChange={(e) => setTraitType(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Trait Value</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Red"
                    value={traitValue}
                    onChange={(e) => setTraitValue(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Actions Status */}
            {submitStatus === 'success' && (
              <div style={styles.statusSuccess}>
                <CheckCircle2 size={16} />
                <span>{statusMessage}</span>
              </div>
            )}
            {submitStatus === 'error' && (
              <div style={styles.statusError}>
                <ShieldAlert size={16} />
                <span>{statusMessage}</span>
              </div>
            )}

            <button type="submit" disabled={submitStatus === 'loading'} className="btn btn-primary" style={{ width: '100%' }}>
              {submitStatus === 'loading' ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div> Creating...
                </>
              ) : (
                'Add Rule Settings'
              )}
            </button>
          </form>
        </div>

        {/* Display Current Rules & Notice */}
        <div style={styles.displayPanel}>
          <div style={styles.rulesList}>
            <h3 style={styles.panelTitle}>Active Verification Rules</h3>

            {loadingRules ? (
              <div style={styles.loadingCenter}>
                <div className="spinner"></div>
                <span>Loading rules...</span>
              </div>
            ) : rules.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {rules.map((rule) => (
                  <div key={rule._id} className="glass-card" style={styles.ruleCard}>
                    <div style={styles.ruleContent}>
                      <div style={styles.ruleCore}>
                        <span style={styles.ruleTargetBadge}>
                          Award: <strong style={{ color: getRoleColor(rule.roleId) }}>@{getRoleName(rule.roleId)}</strong>
                        </span>
                        <span style={styles.networkBadge}>{getNetworkLabel(rule.network)}</span>
                      </div>
                      <div style={styles.ruleDetails}>
                        <div style={styles.ruleContract}>
                          Contract: <code style={styles.code}>{rule.contractAddress}</code>
                        </div>
                        <div style={styles.ruleSummaryText}>
                          {rule.ruleType === 'quantity' ? (
                            <span>Condition: Holds <strong>&gt;= {rule.minQuantity}</strong> NFT(s)</span>
                          ) : (
                            <span>Condition: NFT Trait <strong>{rule.traitType} = {rule.traitValue}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteRule(rule._id)} style={styles.deleteBtn} title="Delete Rule">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyRules}>
                <AlertCircle size={24} color="var(--text-muted)" />
                <p>No verification rules have been created for this server yet.</p>
              </div>
            )}
          </div>

          {/* Verification Panel setup */}
          <div className="glass-card" style={styles.formCard}>
            <h4 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--primary)" /> Send Verification Panel Embed
            </h4>

            <form onSubmit={handleSendPanel} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Discord Target Channel</label>
                {loadingChannels ? (
                  <div style={styles.loadingSmall}>
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                    <span>Loading channels...</span>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    required
                  >
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Panel Embed Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={embedTitle}
                  onChange={(e) => setEmbedTitle(e.target.value)}
                  placeholder="e.g. 🔐 Wallet NFT Verification"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Panel Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                  value={embedDesc}
                  onChange={(e) => setEmbedDesc(e.target.value)}
                  placeholder="Description shown to users inside the embed"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Verification Image URL (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={embedImageUrl}
                  onChange={(e) => setEmbedImageUrl(e.target.value)}
                  placeholder="https://example.com/banner.png"
                />
              </div>

              {panelStatus === 'success' && (
                <div style={styles.statusSuccess}>
                  <CheckCircle2 size={16} />
                  <span>{panelMessage}</span>
                </div>
              )}
              {panelStatus === 'error' && (
                <div style={styles.statusError}>
                  <ShieldAlert size={16} />
                  <span>{panelMessage}</span>
                </div>
              )}

              <button type="submit" disabled={panelStatus === 'loading'} className="btn btn-primary" style={{ width: '100%' }}>
                {panelStatus === 'loading' ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div> Sending Panel...
                  </>
                ) : (
                  'Send Verification Panel to Discord'
                )}
              </button>
            </form>
          </div>

          {/* Setup Advice */}
          <div className="glass-card" style={styles.adviceBox}>
            <h4 style={styles.adviceTitle}>
              <HelpCircle size={16} color="var(--primary)" /> Bot Role Order Requirement
            </h4>
            <p style={styles.adviceText}>
              In your Discord Server Settings under <strong>Roles</strong>, make sure the <strong>Organik Bot</strong> role is positioned <strong>above</strong> all the roles it is configured to award. Discord's permission system prevents bots from assigning roles that reside higher than their own in the hierarchy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    width: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '20px',
  },
  iconCircle: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    width: '54px',
    height: '54px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '30px',
    alignItems: 'start',
  },
  formCard: {
    display: 'flex',
    flexDirection: 'column',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
  },
  modeTabs: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '10px',
    padding: '4px',
    border: '1px solid var(--border-color)',
  },
  tab: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    padding: '10px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    transition: 'all 0.2s ease',
  },
  activeTab: {
    flex: 1,
    background: 'var(--bg-base)',
    border: '1px solid var(--border-color)',
    color: 'white',
    padding: '10px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
  },
  loadingSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 0',
  },
  statusSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '0.9rem',
  },
  statusError: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    padding: '12px',
    borderRadius: '10px',
    fontSize: '0.9rem',
  },
  displayPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    position: 'sticky',
    top: '110px',
  },
  rulesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panelTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  ruleCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  ruleContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  ruleCore: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  ruleTargetBadge: {
    fontSize: '0.85rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    padding: '4px 10px',
    borderRadius: '8px',
    color: 'var(--text-primary)',
  },
  networkBadge: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    color: '#c084fc',
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
    textTransform: 'uppercase',
  },
  ruleDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  ruleContract: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  code: {
    fontFamily: 'monospace',
    color: '#06b6d4',
  },
  ruleSummaryText: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  deleteBtn: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  emptyRules: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    padding: '40px 20px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    color: 'var(--text-muted)',
  },
  adviceBox: {
    borderLeft: '4px solid var(--primary)',
    background: 'rgba(139, 92, 246, 0.01)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  adviceTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.95rem',
    fontWeight: '700',
    color: '#a78bfa',
  },
  adviceText: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 0',
  },
};
