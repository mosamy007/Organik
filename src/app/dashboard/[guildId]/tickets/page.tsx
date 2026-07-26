'use client';

import React, { useState, useEffect, use } from 'react';
import { Ticket, Send, CheckCircle2, ShieldAlert, Sparkles, Lock, UserCheck } from 'lucide-react';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default function TicketsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;

  // Channels & Roles
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [staffRoleIds, setStaffRoleIds] = useState<string[]>([]);
  const [embedTitle, setEmbedTitle] = useState('?? Support & Help Desk');
  const [embedDesc, setEmbedDesc] = useState('Click the button below to open a private support ticket with our server team.');
  const [embedColor, setEmbedColor] = useState('#5865f2');
  const [buttonText, setButtonText] = useState('Open Ticket');
  const [buttonEmoji, setButtonEmoji] = useState('??');

  // Status
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load Channels, Roles & existing Ticket Config
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const [channelsRes, rolesRes, configRes] = await Promise.all([
          fetch(`/api/channels?guildId=${guildId}`),
          fetch(`/api/roles?guildId=${guildId}`),
          fetch(`/api/tickets/panel?guildId=${guildId}`),
        ]);

        if (channelsRes.ok) {
          const cData = await channelsRes.json();
          const chans = cData.channels || [];
          setChannels(chans);
          if (chans.length > 0) setSelectedChannelId(chans[0].id);
        }

        if (rolesRes.ok) {
          const rData = await rolesRes.json();
          setRoles((rData.roles || []).filter((r: any) => r.name !== '@everyone' && !r.managed));
        }

        if (configRes.ok) {
          const cfgData = await configRes.json();
          if (cfgData.config) {
            const cfg = cfgData.config;
            if (cfg.channelId) setSelectedChannelId(cfg.channelId);
            if (cfg.staffRoleIds) setStaffRoleIds(cfg.staffRoleIds);
            if (cfg.embedTitle) setEmbedTitle(cfg.embedTitle);
            if (cfg.embedDesc) setEmbedDesc(cfg.embedDesc);
            if (cfg.embedColor) setEmbedColor(cfg.embedColor);
            if (cfg.buttonText) setButtonText(cfg.buttonText);
            if (cfg.buttonEmoji) setButtonEmoji(cfg.buttonEmoji);
          }
        }
      } catch (err) {
        console.error('Error loading tickets page data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [guildId]);

  const toggleStaffRole = (roleId: string) => {
    if (staffRoleIds.includes(roleId)) {
      setStaffRoleIds(staffRoleIds.filter((id) => id !== roleId));
    } else {
      setStaffRoleIds([...staffRoleIds, roleId]);
    }
  };

  const handleDeployPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelId) {
      setStatus('error');
      setStatusMessage('Please select a target channel for the support panel.');
      return;
    }

    setStatus('loading');
    setStatusMessage('Deploying support ticket panel...');

    try {
      const res = await fetch('/api/tickets/panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId,
          channelId: selectedChannelId,
          staffRoleIds,
          embedTitle,
          embedDesc,
          embedColor,
          buttonText,
          buttonEmoji,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setStatusMessage('Support ticket panel deployed successfully!');
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Failed to deploy ticket panel.');
      }
    } catch (err: any) {
      console.error('Deploy ticket panel error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <div className="page-header">
        <div style={styles.iconCircle} className="page-icon-circle">
          <Ticket size={24} color="var(--primary)" />
        </div>
        <div>
          <h1 className="page-title">Support Ticket System</h1>
          <p className="page-subtitle">Deploy an interactive support panel. Users click to open private channels managed by your staff.</p>
        </div>
      </div>

      <div className="page-two-col">
        {/* Form Settings */}
        <div className="glass-card" style={styles.formCard}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="var(--primary)" /> Ticket System Setup
          </h2>

          <form onSubmit={handleDeployPanel} style={styles.form}>
            {/* Target Channel */}
            <div className="form-group">
              <label className="form-label">Support Panel Channel</label>
              {loadingData ? (
                <div style={styles.loadingRow}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  <span>Loading channels...</span>
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedChannelId}
                  onChange={(e) => setSelectedChannelId(e.target.value)}
                  required
                >
                  {channels.map((chan) => (
                    <option key={chan.id} value={chan.id}>
                      # {chan.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Staff Roles Selection */}
            <div className="form-group">
              <label className="form-label">Support Staff Roles (Access to all tickets)</label>
              {loadingData ? (
                <div style={styles.loadingRow}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  <span>Loading roles...</span>
                </div>
              ) : (
                <div style={styles.rolesGrid}>
                  {roles.map((role) => {
                    const isSelected = staffRoleIds.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleStaffRole(role.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          transition: 'all 0.2s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <UserCheck size={12} /> {role.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Embed Customization */}
            <div className="form-row-inline">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Panel Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={embedTitle}
                  onChange={(e) => setEmbedTitle(e.target.value)}
                  placeholder="e.g. ?? Support & Help Desk"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Theme Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    className="form-input"
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    style={{ padding: '2px', height: '42px', width: '45px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    placeholder="#5865f2"
                    style={{ flexGrow: 1 }}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Panel Description</label>
              <textarea
                className="form-textarea"
                value={embedDesc}
                onChange={(e) => setEmbedDesc(e.target.value)}
                placeholder="Instructions for opening a ticket..."
                rows={4}
                required
              />
            </div>

            {/* Button Customization */}
            <div className="form-row-inline">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Open Ticket Button Label</label>
                <input
                  type="text"
                  className="form-input"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Open Ticket"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Button Emoji</label>
                <input
                  type="text"
                  className="form-input"
                  value={buttonEmoji}
                  onChange={(e) => setButtonEmoji(e.target.value)}
                  placeholder="??"
                />
              </div>
            </div>

            {/* Status messages */}
            {status === 'success' && (
              <div style={styles.statusSuccess}>
                <CheckCircle2 size={16} />
                <span>{statusMessage}</span>
              </div>
            )}
            {status === 'error' && (
              <div style={styles.statusError}>
                <ShieldAlert size={16} />
                <span>{statusMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '10px' }}
            >
              {status === 'loading' ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div> Deploying...
                </>
              ) : (
                <>
                  Deploy Ticket Panel <Send size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Instant Discord Preview */}
        <div style={styles.previewPanel} className="preview-panel-sticky">
          <div style={styles.previewTitle}>
            <Sparkles size={14} color="var(--primary)" />
            <span>Support Panel Preview</span>
          </div>

          <div style={styles.discordMessageBg}>
            <div style={styles.discordMessage}>
              <img
                src="https://cdn.discordapp.com/embed/avatars/0.png"
                alt="Bot Logo"
                style={styles.botAvatar}
              />
              <div style={styles.msgBody}>
                <div style={styles.botHeaderRow}>
                  <span style={styles.botName}>Organik Bot</span>
                  <span style={styles.botBadge}>BOT</span>
                  <span style={styles.msgTime}>Today at 12:00 PM</span>
                </div>

                <div style={{ ...styles.discordEmbed, borderLeftColor: embedColor }}>
                  <div style={styles.embedTitleText}>{embedTitle || '?? Support & Help Desk'}</div>
                  <div style={styles.embedDescText}>{embedDesc || 'Click button below to open a ticket.'}</div>
                  <div style={styles.embedFooterText}>Organik Bot Support System</div>
                </div>

                {/* Open Ticket Button Preview */}
                <div style={{ marginTop: '12px' }}>
                  <div
                    style={{
                      background: '#5865f2',
                      color: '#ffffff',
                      padding: '8px 18px',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}
                  >
                    <span>{buttonEmoji || '??'}</span>
                    <span>{buttonText || 'Open Ticket'}</span>
                  </div>
                </div>
              </div>
            </div>
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
  formCard: {
    display: 'flex',
    flexDirection: 'column',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
  },
  rolesGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    maxHeight: '140px',
    overflowY: 'auto',
    padding: '4px',
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
  previewPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  previewTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  discordMessageBg: {
    background: '#313338',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(0, 0, 0, 0.3)',
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
  },
  discordMessage: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  botAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
  },
  msgBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  botHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  botName: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '0.95rem',
  },
  botBadge: {
    background: '#5865f2',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '1px 4px',
    borderRadius: '4px',
  },
  msgTime: {
    color: '#949ba4',
    fontSize: '0.75rem',
  },
  discordEmbed: {
    background: '#1e1f22',
    borderLeft: '4px solid #5865f2',
    borderRadius: '4px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '6px',
  },
  embedTitleText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '1rem',
  },
  embedDescText: {
    color: '#dbdee1',
    fontSize: '0.875rem',
    lineHeight: '1.35',
    whiteSpace: 'pre-wrap',
  },
  embedFooterText: {
    color: '#949ba4',
    fontSize: '0.75rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.03)',
    paddingTop: '8px',
  },
};
