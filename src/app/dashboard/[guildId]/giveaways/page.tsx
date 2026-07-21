'use client';

import React, { useState, useEffect, use } from 'react';
import { Gift, Plus, Trash2, Clock, Users, ShieldAlert, CheckCircle2, Trophy, HelpCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default function AdminGiveawaysPage({ params }: PageProps) {
  // Resolve params
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;

  // States
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [editingGiveawayId, setEditingGiveawayId] = useState<string | null>(null);

  // Form State
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [endTime, setEndTime] = useState('');
  
  // Role gates
  const [rewardRoleId, setRewardRoleId] = useState('');
  const [restrictRoleId, setRestrictRoleId] = useState(''); // Empty string = Everyone

  // Channel & Image fields
  const [channels, setChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Tasks Builder State
  const [tasks, setTasks] = useState<any[]>([
    { id: 't1', type: 'wallet_input', label: 'Submit EVM Wallet Address', required: true }
  ]);

  // Status
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load giveaways
  const loadGiveaways = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/giveaways?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        setGiveaways(data.giveaways || []);
      }
    } catch (err) {
      console.error('Error fetching server giveaways:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Load roles
  const loadRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch(`/api/roles?guildId=${guildId}`);
      if (res.ok) {
        const data = await res.json();
        const filteredRoles = (data.roles || []).filter(
          (role: any) => role.name !== '@everyone' && !role.managed
        );
        filteredRoles.sort((a: any, b: any) => b.position - a.position);
        setRoles(filteredRoles);
        if (filteredRoles.length > 0) {
          setRewardRoleId(filteredRoles[0].id);
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
    loadGiveaways();
    loadRoles();
    loadChannels();
  }, [guildId]);

  const handleAddTask = (type: 'wallet_input' | 'custom_link') => {
    const id = `t-${Date.now()}`;
    if (type === 'wallet_input') {
      setTasks((prev) => [...prev, { id, type, label: 'Submit EVM Wallet Address', required: true }]);
    } else {
      setTasks((prev) => [...prev, { id, type, label: 'Follow our official X Account', url: 'https://x.com/', required: true }]);
    }
  };

  const handleRemoveTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTask = (id: string, updates: Partial<any>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const formatLocalDatetime = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const applyTimePreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case '1h':
        now.setHours(now.getHours() + 1);
        break;
      case '6h':
        now.setHours(now.getHours() + 6);
        break;
      case '12h':
        now.setHours(now.getHours() + 12);
        break;
      case '1d':
        now.setDate(now.getDate() + 1);
        break;
      case '2d':
        now.setDate(now.getDate() + 2);
        break;
      case '3d':
        now.setDate(now.getDate() + 3);
        break;
      case '7d':
        now.setDate(now.getDate() + 7);
        break;
      default:
        break;
    }
    setEndTime(formatLocalDatetime(now));
  };

  const handleCreateGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prize.trim()) {
      setSubmitStatus('error');
      setStatusMessage('Please enter a prize description.');
      return;
    }

    if (!endTime) {
      setSubmitStatus('error');
      setStatusMessage('Please set a valid ending date and time.');
      return;
    }

    if (new Date(endTime) <= new Date()) {
      setSubmitStatus('error');
      setStatusMessage('The end time must be in the future.');
      return;
    }

    const isEditing = !!editingGiveawayId;
    setSubmitStatus('loading');
    setStatusMessage(isEditing ? 'Updating server giveaway...' : 'Creating server giveaway...');

    try {
      const payload = {
        guildId,
        giveawayId: editingGiveawayId || undefined,
        action: isEditing ? 'edit_giveaway' : undefined,
        title: prize.trim(),
        prize: prize.trim(),
        description: description.trim(),
        winnerCount: Number(winnerCount),
        endTime: new Date(endTime).toISOString(),
        winnerRoleRewardId: rewardRoleId || null,
        restrictRoleId: restrictRoleId || null,
        channelId: selectedChannelId || null,
        imageUrl: imageUrl.trim() || null,
        tasks: tasks.map((t) => ({
          id: t.id,
          type: t.type,
          label: t.label,
          url: t.url,
          required: t.required,
        })),
      };

      const res = await fetch('/api/giveaways', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitStatus('success');
        setStatusMessage(isEditing ? 'Giveaway updated successfully!' : 'Giveaway created successfully!');
        // Reset form
        setPrize('');
        setDescription('');
        setWinnerCount('1');
        setEndTime('');
        setImageUrl('');
        setRewardRoleId('');
        setRestrictRoleId('');
        setTasks([{ id: 't1', type: 'wallet_input', label: 'Submit EVM Wallet Address', required: true }]);
        setEditingGiveawayId(null);
        // Reload giveaways
        loadGiveaways();
      } else {
        setSubmitStatus('error');
        setStatusMessage(data.error || (isEditing ? 'Failed to update giveaway.' : 'Failed to create giveaway.'));
      }
    } catch (err: any) {
      console.error('Save giveaway error:', err);
      setSubmitStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred.');
    }
  };

  const handleDrawWinners = async (giveawayId: string) => {
    if (!confirm('Are you sure you want to end this giveaway and draw winners now?')) return;

    try {
      const res = await fetch('/api/giveaways', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          giveawayId,
          guildId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Winners drawn successfully!');
        loadGiveaways();
      } else {
        alert(data.error || 'Failed to draw winners.');
      }
    } catch (err) {
      console.error('Draw winners error:', err);
      alert('An error occurred during drawing.');
    }
  };

  const handleExportWinners = (gw: any) => {
    if (!gw.winners || gw.winners.length === 0) {
      alert('No winners to export.');
      return;
    }

    const headers = ['Username', 'Discord ID', 'Wallet Address'];
    const rows = gw.winners.map((w: any) => {
      const username = typeof w === 'object' ? w.username : '';
      const discordId = typeof w === 'object' ? w.discordId : w;
      const walletAddress = typeof w === 'object' ? w.walletAddress : '';
      return [username, discordId, walletAddress].map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(gw.prize || 'giveaway').replace(/[^a-zA-Z0-9]/g, '_')}_winners.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCancelEdit = () => {
    setEditingGiveawayId(null);
    setPrize('');
    setDescription('');
    setWinnerCount('1');
    setEndTime('');
    setImageUrl('');
    setRewardRoleId('');
    setRestrictRoleId('');
    setTasks([{ id: 't1', type: 'wallet_input', label: 'Submit EVM Wallet Address', required: true }]);
  };

  const handleEditClick = (gw: any) => {
    setEditingGiveawayId(gw._id);
    setPrize(gw.prize || '');
    setDescription(gw.description || '');
    setWinnerCount(gw.winnerCount?.toString() || '1');
    
    // Format date for datetime-local input
    if (gw.endTime) {
      const date = new Date(gw.endTime);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const formatted = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
      setEndTime(formatted);
    } else {
      setEndTime('');
    }
    
    setSelectedChannelId(gw.channelId || '');
    setImageUrl(gw.imageUrl || '');
    setRewardRoleId(gw.winnerRoleRewardId || '');
    setRestrictRoleId(gw.restrictRoleId || '');
    setTasks(gw.tasks && gw.tasks.length > 0 ? gw.tasks : [{ id: 't1', type: 'wallet_input', label: 'Submit EVM Wallet Address', required: true }]);
  };

  const handleDeleteGiveaway = async (giveawayId: string) => {
    if (!confirm('Are you sure you want to permanently delete this giveaway and all its entries? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/giveaways?giveawayId=${giveawayId}&guildId=${guildId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Giveaway deleted successfully!');
        loadGiveaways();
        if (editingGiveawayId === giveawayId) {
          handleCancelEdit();
        }
      } else {
        alert(data.error || 'Failed to delete giveaway.');
      }
    } catch (err) {
      console.error('Delete giveaway error:', err);
      alert('An error occurred during deletion.');
    }
  };

  const getRoleName = (roleId: string) => {
    if (!roleId) return 'Everyone';
    const role = roles.find((r) => r.id === roleId);
    return role ? role.name : roleId;
  };

  const formatTimeRemaining = (dateString: string) => {
    const end = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Page Header */}
      <div style={styles.header}>
        <div style={styles.iconCircle}>
          <Gift size={24} color="var(--primary)" />
        </div>
        <div>
          <h1 style={styles.title}>Web3 Giveaway Manager</h1>
          <p style={styles.subtitle}>Configure custom server giveaways featuring entry role gates and task list verifications.</p>
        </div>
      </div>

      <div style={styles.layout}>
        {/* Creation Card */}
        <div className="glass-card" style={styles.formCard}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} color="var(--primary)" /> {editingGiveawayId ? 'Edit Server Giveaway' : 'Create Server Giveaway'}
          </h2>

          <form onSubmit={handleCreateGiveaway} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Prize Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. VIP Role or NFT Whitelist Spots"
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description / Guidelines</label>
              <textarea
                className="form-textarea"
                placeholder="Instructions or details for participants..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div style={styles.formRow}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Announcement Channel</label>
                {loadingChannels ? (
                  <div style={styles.loadingSmall}>
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
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

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Giveaway Image URL (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://example.com/giveaway-banner.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Winner Count</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={winnerCount}
                  onChange={(e) => setWinnerCount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">End Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {['1h', '6h', '12h', '1d', '2d', '3d', '7d'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyTimePreset(preset)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.formRow}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Target Role to Award (Optional)</label>
                {loadingRoles ? (
                  <div style={styles.loadingSmall}>
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={rewardRoleId}
                    onChange={(e) => setRewardRoleId(e.target.value)}
                  >
                    <option value="">None (Custom Reward)</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Restrict Entry To Role</label>
                {loadingRoles ? (
                  <div style={styles.loadingSmall}>
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={restrictRoleId}
                    onChange={(e) => setRestrictRoleId(e.target.value)}
                  >
                    <option value="">Everyone (No gate)</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Task Builder Section */}
            <div style={styles.taskBuilderHeader}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Entry Tasks</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => handleAddTask('wallet_input')} style={styles.taskBtn}>
                  + Wallet
                </button>
                <button type="button" onClick={() => handleAddTask('custom_link')} style={styles.taskBtn}>
                  + Link / Social
                </button>
              </div>
            </div>

            <div style={styles.tasksListBuilder}>
              {tasks.map((task, idx) => (
                <div key={task.id} style={styles.taskBuilderItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={styles.taskTypeBadge}>{task.type === 'wallet_input' ? 'Wallet Sub' : 'Link Task'}</span>
                    <button type="button" onClick={() => handleRemoveTask(task.id)} style={styles.removeTaskBtn}>
                      Remove
                    </button>
                  </div>

                  <div className="form-group" style={{ margin: '8px 0' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={task.label}
                      onChange={(e) => handleUpdateTask(task.id, { label: e.target.value })}
                      placeholder="Task Action Text (e.g. Follow us on Twitter)"
                      required
                    />
                  </div>

                  {task.type === 'custom_link' && (
                    <div className="form-group" style={{ margin: '8px 0' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={task.url || ''}
                        onChange={(e) => handleUpdateTask(task.id, { url: e.target.value })}
                        placeholder="Action URL (e.g. https://x.com/...)"
                        required
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={submitStatus === 'loading'}
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                {submitStatus === 'loading' ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>{' '}
                    {editingGiveawayId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingGiveawayId ? 'Update Giveaway' : 'Launch Giveaway'
                )}
              </button>
              {editingGiveawayId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn btn-secondary"
                  style={{ flex: 1, color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Giveaways Display */}
        <div style={styles.displayPanel}>
          <h3 style={styles.panelTitle}>Server Giveaways</h3>

          {loadingList ? (
            <div style={styles.loadingCenter}>
              <div className="spinner"></div>
              <span>Loading giveaways...</span>
            </div>
          ) : giveaways.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {giveaways.map((gw) => {
                const isEnded = gw.status === 'ended' || new Date() > new Date(gw.endTime);

                return (
                  <div key={gw._id} className="glass-card" style={styles.giveawayCard}>
                    <div style={styles.cardHeader}>
                      <span style={isEnded ? styles.statusBadgeEnded : styles.statusBadgeActive}>
                        {isEnded ? 'Ended' : 'Active'}
                      </span>
                      <span style={styles.metaBadge}>
                        <Users size={12} /> {gw.winnerCount} Winner(s)
                      </span>
                    </div>

                    <h4 style={styles.cardPrize}>{gw.prize}</h4>
                    <p style={styles.cardDesc}>{gw.description}</p>

                    <div style={styles.cardInfoRow}>
                      <div style={styles.infoCol}>
                        <Clock size={14} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.85rem' }}>
                          {isEnded ? 'Ended' : formatTimeRemaining(gw.endTime) + ' remaining'}
                        </span>
                      </div>
                      <div style={styles.infoCol}>
                        <Trophy size={14} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.85rem' }}>
                          Gate: {getRoleName(gw.restrictRoleId)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                      {!isEnded && (
                        <>
                          <button
                            onClick={() => handleDrawWinners(gw._id)}
                            className="btn btn-secondary"
                            style={{ flex: 2, color: '#34d399', borderColor: 'rgba(16,185,129,0.2)' }}
                          >
                            End & Draw
                          </button>
                          <button
                            onClick={() => handleEditClick(gw)}
                            className="btn btn-secondary"
                            style={{ flex: 1, color: '#fbbf24', borderColor: 'rgba(245,158,11,0.2)' }}
                          >
                            Edit
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteGiveaway(gw._id)}
                        className="btn btn-secondary"
                        style={{ flex: 1, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>

                    {isEnded && (
                      <div style={{ ...styles.drawnWinnersBox, marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#fbbf24' }}>🏆 Winners drawn:</strong>
                          {gw.winners && gw.winners.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleExportWinners(gw)}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.1)' }}
                            >
                              📥 Export Excel/CSV
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', marginTop: '6px', lineHeight: '1.4' }}>
                          {gw.winners && gw.winners.length > 0 ? (
                            gw.winners.map((w: any, idx: number) => {
                              const username = typeof w === 'object' ? (w.username || w.discordId) : w;
                              const wallet = typeof w === 'object' && w.walletAddress ? ` (${w.walletAddress})` : '';
                              return (
                                <div key={idx} style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                                  • <strong>@{username}</strong>{wallet ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{wallet}</span> : null}
                                </div>
                              );
                            })
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No participants entered</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyList}>
              <ShieldAlert size={24} color="var(--text-muted)" />
              <p>No giveaways have been launched on this server yet.</p>
            </div>
          )}
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
  loadingSmall: {
    padding: '10px 0',
  },
  taskBuilderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '16px',
  },
  taskBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    padding: '4px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
    fontFamily: 'var(--font-display)',
    transition: 'all 0.2s ease',
  },
  tasksListBuilder: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  taskBuilderItem: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '12px',
  },
  taskTypeBadge: {
    background: 'rgba(139, 92, 246, 0.1)',
    color: '#a78bfa',
    border: '1px solid rgba(139,92,246,0.2)',
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  removeTaskBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--error)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600',
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
    gap: '16px',
    position: 'sticky',
    top: '110px',
  },
  panelTitle: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  giveawayCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  metaBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  cardPrize: {
    fontSize: '1.15rem',
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  cardInfoRow: {
    display: 'flex',
    gap: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '10px',
  },
  infoCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  drawnWinnersBox: {
    background: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
    borderRadius: '8px',
    padding: '10px',
  },
  emptyList: {
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
  loadingCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px 0',
  },
};
