'use client';

import React, { useState, useEffect, use } from 'react';
import { useDiscordAuth } from '@/components/DiscordAuthProvider';
import { MessageSquare, Send, CheckCircle2, ShieldAlert, Sparkles, Plus, Trash2, ExternalLink, MousePointerClick, Edit3, Search, FileEdit } from 'lucide-react';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

interface MessageButton {
  id: string;
  label: string;
  style: 'link' | 'primary' | 'secondary' | 'success' | 'danger';
  url?: string;
  emoji?: string;
}

export default function SendMessagePage({ params }: PageProps) {
  // Resolve params
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;

  const { user } = useDiscordAuth();

  // Component States
  const [channels, setChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  
  // Action Type (Send new vs Edit existing)
  const [actionType, setActionType] = useState<'send' | 'edit'>('send');
  const [editMessageId, setEditMessageId] = useState('');
  const [fetchingMessage, setFetchingMessage] = useState(false);

  // Message settings
  const [msgMode, setMsgMode] = useState<'text' | 'embed'>('text');
  const [textContent, setTextContent] = useState('');
  
  // Embed settings
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDesc, setEmbedDesc] = useState('');
  const [embedColor, setEmbedColor] = useState('#5865f2');
  const [embedFooter, setEmbedFooter] = useState('');
  const [embedThumbnail, setEmbedThumbnail] = useState('');
  const [embedImage, setEmbedImage] = useState('');

  // Interactive Buttons settings
  const [buttons, setButtons] = useState<MessageButton[]>([]);

  const addButton = () => {
    if (buttons.length >= 5) return;
    setButtons([
      ...buttons,
      {
        id: Date.now().toString(),
        label: `Button ${buttons.length + 1}`,
        style: 'link',
        url: 'https://organikbot.com',
      },
    ]);
  };

  const updateButton = (id: string, field: keyof MessageButton, value: string) => {
    setButtons(buttons.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeButton = (id: string) => {
    setButtons(buttons.filter((b) => b.id !== id));
  };

  // Status
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load guild channels
  useEffect(() => {
    const fetchChannels = async () => {
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
    fetchChannels();
  }, [guildId]);

  // Fetch Existing Message by ID for editing
  const fetchExistingMessage = async () => {
    if (!selectedChannelId || !editMessageId.trim()) {
      setStatus('error');
      setStatusMessage('Please select a channel and enter a valid Message ID.');
      return;
    }

    setFetchingMessage(true);
    setStatus('loading');
    setStatusMessage('Fetching message details from Discord...');

    try {
      const res = await fetch(`/api/send-message?guildId=${guildId}&channelId=${selectedChannelId}&messageId=${editMessageId.trim()}`);
      const result = await res.json();

      if (res.ok && result.data) {
        const d = result.data;
        setMsgMode(d.msgMode || 'text');
        setTextContent(d.textContent || '');
        if (d.embed) {
          setEmbedTitle(d.embed.title || '');
          setEmbedDesc(d.embed.description || '');
          setEmbedColor(d.embed.color || '#5865f2');
          setEmbedFooter(d.embed.footer || '');
          setEmbedThumbnail(d.embed.thumbnail || '');
          setEmbedImage(d.embed.image || '');
        } else {
          setEmbedTitle('');
          setEmbedDesc('');
          setEmbedFooter('');
          setEmbedThumbnail('');
          setEmbedImage('');
        }
        setButtons(d.buttons || []);
        setStatus('success');
        setStatusMessage('Message loaded successfully! Edit its details below and click "Update Message".');
      } else {
        setStatus('error');
        setStatusMessage(result.error || 'Failed to fetch message from Discord.');
      }
    } catch (err: any) {
      console.error('Fetch message error:', err);
      setStatus('error');
      setStatusMessage('Network error loading message.');
    } finally {
      setFetchingMessage(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChannelId) {
      setStatus('error');
      setStatusMessage('Please select a target channel.');
      return;
    }

    if (actionType === 'edit' && !editMessageId.trim()) {
      setStatus('error');
      setStatusMessage('Please enter a valid Message ID to edit.');
      return;
    }

    if (msgMode === 'text' && !textContent.trim()) {
      setStatus('error');
      setStatusMessage('Please enter some text content.');
      return;
    }

    if (msgMode === 'embed' && !embedTitle.trim() && !embedDesc.trim()) {
      setStatus('error');
      setStatusMessage('Please enter at least a title or description for the embed.');
      return;
    }

    setStatus('loading');
    setStatusMessage(actionType === 'edit' ? 'Updating message on Discord...' : 'Sending message to channel...');

    try {
      const payload: any = {
        guildId,
        channelId: selectedChannelId,
      };

      if (actionType === 'edit') {
        payload.messageId = editMessageId.trim();
      }

      if (msgMode === 'text') {
        payload.content = textContent;
      } else {
        // Convert hex color to decimal
        const decColor = parseInt(embedColor.replace('#', ''), 16) || 5793010;
        payload.embed = {
          title: embedTitle || undefined,
          description: embedDesc || undefined,
          color: decColor,
          footer: embedFooter ? { text: embedFooter } : undefined,
          thumbnail: embedThumbnail ? { url: embedThumbnail } : undefined,
          image: embedImage ? { url: embedImage } : undefined,
          timestamp: new Date().toISOString(),
        };
      }

      if (buttons.length > 0) {
        payload.buttons = buttons.map((b) => ({
          label: b.label,
          style: b.style,
          url: b.url ? b.url.trim() : undefined,
          emoji: b.emoji || undefined,
        }));
      }

      const res = await fetch('/api/send-message', {
        method: actionType === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setStatusMessage(actionType === 'edit' ? 'Message updated successfully on Discord!' : 'Message sent successfully!');
        if (actionType === 'send') {
          setButtons([]);
          if (msgMode === 'text') {
            setTextContent('');
          } else {
            setEmbedTitle('');
            setEmbedDesc('');
            setEmbedFooter('');
            setEmbedThumbnail('');
            setEmbedImage('');
          }
        }
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Failed to process message.');
      }
    } catch (err: any) {
      console.error('Send/Edit message error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      <div className="page-header">
        <div style={styles.iconCircle} className="page-icon-circle">
          <MessageSquare size={24} color="var(--primary)" />
        </div>
        <div>
          <h1 className="page-title">Send Message</h1>
          <p className="page-subtitle">Send text announcements or rich embeds directly to your server channels.</p>
        </div>
      </div>

      <div className="page-two-col">
        {/* Editor Form */}
        <div className="glass-card" style={styles.editorCard}>
          {/* Action Type Mode Switcher */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setActionType('send')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: actionType === 'send' ? 'var(--primary)' : 'transparent',
                color: actionType === 'send' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={14} /> Send New Message
            </button>
            <button
              type="button"
              onClick={() => setActionType('edit')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: actionType === 'edit' ? 'var(--primary)' : 'transparent',
                color: actionType === 'edit' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <Edit3 size={14} /> Edit Existing Message
            </button>
          </div>

          {/* Edit Message ID Loader */}
          {actionType === 'edit' && (
            <div className="animate-fade-in" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileEdit size={14} color="var(--primary)" /> Message ID to Edit
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Paste Discord Message ID (e.g. 1234567890123456789)"
                  value={editMessageId}
                  onChange={(e) => setEditMessageId(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={fetchExistingMessage}
                  disabled={fetchingMessage || !editMessageId.trim()}
                  className="btn btn-secondary"
                  style={{ padding: '0 16px', whiteSpace: 'nowrap' }}
                >
                  {fetchingMessage ? (
                    <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                  ) : (
                    <>
                      <Search size={14} /> Load Message
                    </>
                  )}
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
                💡 Right-click any message sent by Organik Bot in Discord and click "Copy Message ID".
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Target Text Channel</label>
            {loadingChannels ? (
              <div style={styles.loadingRow}>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                <span>Loading channels...</span>
              </div>
            ) : (
              <select
                className="form-select"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
              >
                {channels.map((chan) => (
                  <option key={chan.id} value={chan.id}>
                    # {chan.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mode Switcher */}
          <div style={styles.modeTabs}>
            <button
              onClick={() => setMsgMode('text')}
              style={msgMode === 'text' ? styles.activeTab : styles.tab}
            >
              Simple Text
            </button>
            <button
              onClick={() => setMsgMode('embed')}
              style={msgMode === 'embed' ? styles.activeTab : styles.tab}
            >
              Styled Embed
            </button>
          </div>

          {/* Text Editor */}
          {msgMode === 'text' && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Message Content</label>
              <textarea
                className="form-textarea"
                placeholder="Type your message here... Supports standard Discord markdown formatting."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
              />
            </div>
          )}

          {/* Embed Editor */}
          {msgMode === 'embed' && (
            <div style={styles.embedForm} className="animate-fade-in">
              <div className="form-row-inline">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Embed Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Announcement!"
                    value={embedTitle}
                    onChange={(e) => setEmbedTitle(e.target.value)}
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
                      style={{ padding: '2px', height: '42px', width: '50px', cursor: 'pointer' }}
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
                <label className="form-label">Description (Markdown Supported)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Body content of the embed..."
                  value={embedDesc}
                  onChange={(e) => setEmbedDesc(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="form-row-inline">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Thumbnail URL</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://..."
                    value={embedThumbnail}
                    onChange={(e) => setEmbedThumbnail(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Image URL</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://..."
                    value={embedImage}
                    onChange={(e) => setEmbedImage(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Footer Text</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Footer text..."
                  value={embedFooter}
                  onChange={(e) => setEmbedFooter(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Interactive Buttons Builder */}
          <div style={{ marginTop: '10px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MousePointerClick size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Message Buttons (Optional)</h3>
              </div>
              <button
                type="button"
                onClick={addButton}
                disabled={buttons.length >= 5}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <Plus size={14} /> Add Button ({buttons.length}/5)
              </button>
            </div>

            {buttons.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No buttons added yet. Click "Add Button" to attach interactive link or action buttons to your message.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {buttons.map((btn, index) => (
                  <div
                    key={btn.id}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        Button #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeButton(btn.id)}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="form-row-inline">
                      <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                        <label className="form-label">Button Text</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Visit Website"
                          value={btn.label}
                          onChange={(e) => updateButton(btn.id, 'label', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Type / Color</label>
                        <select
                          className="form-select"
                          value={btn.style}
                          onChange={(e) => updateButton(btn.id, 'style', e.target.value as any)}
                        >
                          <option value="link">🌐 Link (Opens Web URL)</option>
                          <option value="primary">🟣 Primary (Blurple Action)</option>
                          <option value="secondary">⚪ Secondary (Grey Action)</option>
                          <option value="success">🟢 Success (Green Action)</option>
                          <option value="danger">🔴 Danger (Red Action)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row-inline">
                      <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                        <label className="form-label">Link URL (Optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="https://yourwebsite.com"
                          value={btn.url || ''}
                          onChange={(e) => updateButton(btn.id, 'url', e.target.value)}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ℹ️ Enter a web link (`https://...`). If a colored button is clicked, the bot will deliver your link in Discord!
                        </span>
                      </div>

                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Emoji (Optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. 🔗 or 🚀"
                          value={btn.emoji || ''}
                          onChange={(e) => updateButton(btn.id, 'emoji', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Status */}
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

          {/* Send / Update Trigger */}
          <button
            onClick={handleSendMessage}
            disabled={status === 'loading'}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
          >
            {status === 'loading' ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div> {actionType === 'edit' ? 'Updating...' : 'Sending...'}
              </>
            ) : (
              <>
                {actionType === 'edit' ? 'Update Message' : 'Send Message'} {actionType === 'edit' ? <Edit3 size={16} /> : <Send size={16} />}
              </>
            )}
          </button>
        </div>

        {/* Discord Preview Panel */}
        <div style={styles.previewPanel} className="preview-panel-sticky">
          <div style={styles.previewTitle}>
            <Sparkles size={14} color="var(--primary)" />
            <span>Instant Discord Preview</span>
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

                {/* Render Text Message */}
                {msgMode === 'text' && (
                  <div style={styles.discordTextPreview}>
                    {textContent.trim() ? (
                      <p style={{ whiteSpace: 'pre-wrap' }}>{textContent}</p>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Start typing in the text editor to preview message...
                      </span>
                    )}
                  </div>
                )}

                {/* Render Embed Message */}
                {msgMode === 'embed' && (
                  <>
                    {(!embedTitle.trim() && !embedDesc.trim()) ? (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        Start typing in the fields to preview embed layout...
                      </span>
                    ) : (
                      <div style={{ ...styles.discordEmbed, borderLeftColor: embedColor }}>
                        <div style={styles.embedCore}>
                          <div style={styles.embedMainText}>
                            {embedTitle && <div style={styles.embedTitleText}>{embedTitle}</div>}
                            {embedDesc && <div style={styles.embedDescText}>{embedDesc}</div>}
                          </div>
                          {embedThumbnail && (
                            <img src={embedThumbnail} alt="Thumb" style={styles.embedThumbnailImg} onError={(e)=>{(e.target as any).style.display='none'}} />
                          )}
                        </div>
                        {embedImage && (
                          <img src={embedImage} alt="Main" style={styles.embedImageImg} onError={(e)=>{(e.target as any).style.display='none'}} />
                        )}
                        {embedFooter && <div style={styles.embedFooterText}>{embedFooter}</div>}
                      </div>
                    )}
                  </>
                )}

                {/* Render Interactive Buttons in Discord Preview */}
                {buttons.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    {buttons.map((btn) => {
                      const getBg = () => {
                        switch (btn.style) {
                          case 'primary': return '#5865f2';
                          case 'secondary': return '#4e5058';
                          case 'success': return '#248046';
                          case 'danger': return '#da373c';
                          case 'link': default: return '#4e5058';
                        }
                      };
                      return (
                        <div
                          key={btn.id}
                          style={{
                            background: getBg(),
                            color: '#ffffff',
                            padding: '6px 14px',
                            borderRadius: '4px',
                            fontSize: '0.82rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          }}
                        >
                          {btn.emoji && <span>{btn.emoji}</span>}
                          <span>{btn.label || 'Button'}</span>
                          {btn.style === 'link' && <ExternalLink size={12} style={{ opacity: 0.8 }} />}
                        </div>
                      );
                    })}
                  </div>
                )}
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
    gridTemplateColumns: '1.1fr 1fr',
    gap: '30px',
    alignItems: 'start',
  },
  editorCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 0',
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
  embedForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
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
  discordTextPreview: {
    color: '#dbdee1',
    fontSize: '0.95rem',
    lineHeight: '1.4',
  },
  discordEmbed: {
    background: '#1e1f22',
    borderLeft: '4px solid #5865f2',
    borderRadius: '4px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '6px',
    maxWidth: '520px',
  },
  embedCore: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
  },
  embedMainText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
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
  embedThumbnailImg: {
    width: '80px',
    height: '80px',
    borderRadius: '4px',
    objectFit: 'cover',
  },
  embedImageImg: {
    width: '100%',
    maxHeight: '300px',
    borderRadius: '4px',
    objectFit: 'cover',
  },
  embedFooterText: {
    color: '#949ba4',
    fontSize: '0.75rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.03)',
    paddingTop: '8px',
  },
};
