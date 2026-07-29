'use client';

import React, { useState, useEffect, use } from 'react';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { BarChart2, CheckCircle2, ShieldAlert, Sparkles, RefreshCw, ExternalLink, Activity } from 'lucide-react';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default function GloomblesStatsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { user } = useDiscordAuth();

  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState('5');
  const [liveStats, setLiveStats] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch channels
        const cRes = await fetch(`/api/channels?guildId=${guildId}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          setChannels(cData.channels || []);
        }

        // Fetch tracker config & live stats
        const sRes = await fetch(`/api/gloombles-stats?guildId=${guildId}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.config) {
            setEnabled(Boolean(sData.config.enabled));
            setSelectedChannelId(sData.config.channelId || '');
            setIntervalMinutes(String(sData.config.intervalMinutes || 5));
          }
          if (sData.liveStats) {
            setLiveStats(sData.liveStats);
          }
        }
      } catch (err) {
        console.error('Error loading Gloombles stats setup:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [guildId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (enabled && !selectedChannelId) {
      setStatus('error');
      setStatusMessage('Please select a target channel to post the live stats tracker.');
      return;
    }

    setSaving(true);
    setStatus('idle');

    try {
      const res = await fetch('/api/gloombles-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guildId,
          channelId: selectedChannelId,
          enabled,
          intervalMinutes: Number(intervalMinutes),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setStatusMessage(
          enabled
            ? '🚀 Gloombles Live Stats Tracker launched! The master card has been posted and will auto-update.'
            : '🛑 Gloombles Live Stats Tracker has been disabled.'
        );
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Failed to save tracker configuration.');
      }
    } catch (err: any) {
      console.error('Error saving Gloombles tracker:', err);
      setStatus('error');
      setStatusMessage(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const refreshLiveStats = async () => {
    try {
      const res = await fetch('https://gloombles.com/api/stats', { cache: 'no-store' });
      if (res.ok) {
        setLiveStats(await res.json());
      }
    } catch (e) {
      console.error('Error refreshing live stats:', e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '10px' }}>
        <div className="spinner"></div>
        <span>Loading Gloombles Tracker configurations...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart2 color="var(--primary)" size={28} /> Gloombles Live Stats Tracker
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
          Post an automated live-updating metrics embed in your Discord server directly from <a href="https://gloombles.com/stats" target="_blank" rel="noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline' }}>gloombles.com/stats <ExternalLink size={12} /></a>.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Form Controls */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity color="var(--primary)" size={20} /> Tracker Configuration
          </h3>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEnabled(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: enabled ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: enabled ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    color: enabled ? '#a78bfa' : 'var(--text-secondary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🟢 Enabled
                </button>
                <button
                  type="button"
                  onClick={() => setEnabled(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: !enabled ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                    background: !enabled ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: !enabled ? '#f87171' : 'var(--text-secondary)',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🛑 Disabled
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Discord Target Channel</label>
              <select
                className="form-select"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
              >
                <option value="">Select a channel...</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Update Frequency</label>
              <select
                className="form-select"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
              >
                <option value="5">Every 5 Minutes (Recommended)</option>
                <option value="10">Every 10 Minutes</option>
                <option value="15">Every 15 Minutes</option>
              </select>
            </div>

            {status === 'success' && (
              <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid #34d399', color: '#34d399', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{statusMessage}</span>
              </div>
            )}

            {status === 'error' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#f87171', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} />
                <span>{statusMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            >
              {saving ? 'Saving...' : enabled ? '🚀 Launch / Update Live Tracker' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#a78bfa' }}>
              👾 Discord Card Live Preview
            </h3>
            <button
              onClick={refreshLiveStats}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={12} /> Refresh Data
            </button>
          </div>

          {liveStats ? (
            <div style={{ background: '#18181b', borderRadius: '10px', padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#ffffff', marginBottom: '4px' }}>
                👾 GLOOMBLES LIVE METRICS
              </div>
              <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginBottom: '16px' }}>
                Live collection metrics straight from the Ethereum blockchain.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>📦 Total Supply</span>
                  <code style={{ color: '#a78bfa' }}>{liveStats.collectionSize ?? 2600}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>🪙 Minted All-Time</span>
                  <code style={{ color: '#a78bfa' }}>{liveStats.mintedAllTime ?? 3697}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>🔥 Total Burned</span>
                  <code style={{ color: '#a78bfa' }}>{(liveStats.burned || 0) + (liveStats.deadBurned || 0)}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>🎲 Total Re-rolls</span>
                  <code style={{ color: '#a78bfa' }}>{liveStats.totalRolls ?? 2890}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>🧬 Merges Done</span>
                  <code style={{ color: '#a78bfa' }}>{liveStats.merges ?? 58}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>📦 Untouched</span>
                  <code style={{ color: '#a78bfa' }}>{liveStats.untouched ?? 1798}</code>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #27272a', margin: '14px 0', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>👑 Mythics</span>
                  <code style={{ color: '#facc15' }}>{liveStats.mythic ?? 145}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>✨ Grails</span>
                  <code style={{ color: '#38bdf8' }}>{liveStats.grails ?? 8}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>🟣 Epics</span>
                  <code style={{ color: '#c084fc' }}>{liveStats.epics ?? 14}</code>
                </div>
                <div>
                  <span style={{ color: '#a1a1aa', display: 'block' }}>🟡 Legendaries</span>
                  <code style={{ color: '#fde047' }}>{liveStats.legendaries ?? 2}</code>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '12px' }}>
                Live Auto-Update • Refreshed every 5 mins • gloombles.com
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Fetching live preview from gloombles.com...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
