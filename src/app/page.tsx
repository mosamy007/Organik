'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Gift, Command, CheckCircle2, ChevronRight } from 'lucide-react';

export default function Home() {
  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.badgeGlow}>
          <span style={styles.badgeText}>Powered by Web3</span>
        </div>
        <h1 style={styles.heroTitle}>
          Supercharge Your Discord Server with <span style={styles.gradientText}>Organik Bot</span>
        </h1>
        <p style={styles.heroSubtitle}>
          The professional alternative for NFT verification, customizable web3 giveaways, and full-featured server administration. Direct, on-chain checks and easy configuration.
        </p>

        <div style={styles.ctaGroup}>
          <Link href="/verify" className="btn btn-primary" style={{ padding: '14px 28px' }}>
            Verify Wallet NFT <ChevronRight size={18} />
          </Link>
          <Link href="/giveaways" className="btn btn-secondary" style={{ padding: '14px 28px' }}>
            Browse Giveaways
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section style={styles.statsSection}>
        <div className="glass-card" style={styles.statCard}>
          <h3 style={styles.statVal}>99.9%</h3>
          <p style={styles.statLabel}>Uptime On-Chain</p>
        </div>
        <div className="glass-card" style={styles.statCard}>
          <h3 style={styles.statVal}>Collab.Land</h3>
          <p style={styles.statLabel}>Direct Alternative</p>
        </div>
        <div className="glass-card" style={styles.statCard}>
          <h3 style={styles.statVal}>Instant</h3>
          <p style={styles.statLabel}>Role Assignments</p>
        </div>
      </section>

      {/* Features Grid */}
      <section style={styles.featuresSection}>
        <h2 style={styles.sectionTitle}>What Organik Bot Offers</h2>
        <div style={styles.featuresGrid}>
          {/* Card 1 */}
          <div className="glass-card" style={styles.featureCard}>
            <div style={styles.iconWrapperPurple}>
              <Shield size={24} />
            </div>
            <h3 style={styles.featureName}>Professional NFT Verification</h3>
            <p style={styles.featureText}>
              Verify user holdings from any EVM smart contract. Configure rules based on NFT quantity held or specific metadata traits (e.g. skin, background) to award custom server roles automatically.
            </p>
            <ul style={styles.featureList}>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--success)" /> Quantity-based roles</li>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--success)" /> Metadata trait verification</li>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--success)" /> Multi-network support</li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="glass-card" style={styles.featureCard}>
            <div style={styles.iconWrapperCyan}>
              <Gift size={24} />
            </div>
            <h3 style={styles.featureName}>Web3 Giveaway Manager</h3>
            <p style={styles.featureText}>
              Boost community engagement with custom giveaways. Enforce participation requirements like specific Discord roles or tasks (X follow link, wallet address submission, retweets).
            </p>
            <ul style={styles.featureList}>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--secondary)" /> Role restriction checks</li>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--secondary)" /> Custom verification tasks</li>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--secondary)" /> Automated drawing & reward roles</li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="glass-card" style={styles.featureCard}>
            <div style={styles.iconWrapperPink}>
              <Command size={24} />
            </div>
            <h3 style={styles.featureName}>Interactive Admin Control</h3>
            <p style={styles.featureText}>
              Manage the bot's features using our web dashboard. Easily compose and send custom announcements, rich text, and embeds directly to any channel in your Discord server.
            </p>
            <ul style={styles.featureList}>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--accent)" /> Discord OAuth login</li>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--accent)" /> Channel selection picker</li>
              <li style={styles.listItem}><CheckCircle2 size={16} color="var(--accent)" /> Custom Embed support</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '60px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '80px',
    width: '100%',
  },
  hero: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    maxWidth: '800px',
    margin: '40px auto 0 auto',
  },
  badgeGlow: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '100px',
    padding: '6px 16px',
    display: 'inline-flex',
    boxShadow: '0 0 15px rgba(139, 92, 246, 0.15)',
  },
  badgeText: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-display)',
  },
  heroTitle: {
    fontSize: '3.5rem',
    lineHeight: '1.15',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    letterSpacing: '-0.03em',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '1.2rem',
    lineHeight: '1.6',
  },
  ctaGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '12px',
  },
  statsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    textAlign: 'center',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '30px 20px',
  },
  statVal: {
    fontSize: '2rem',
    background: 'linear-gradient(135deg, #ffffff, var(--text-secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontFamily: 'var(--font-display)',
    fontWeight: '800',
  },
  statLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  featuresSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
  },
  sectionTitle: {
    fontSize: '2rem',
    textAlign: 'center',
    fontWeight: '800',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '30px',
  },
  featureCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
  },
  iconWrapperPurple: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperCyan: {
    background: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    color: '#22d3ee',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperPink: {
    background: 'rgba(217, 70, 239, 0.1)',
    border: '1px solid rgba(217, 70, 239, 0.2)',
    color: '#f472b6',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureName: {
    fontSize: '1.25rem',
    fontWeight: '700',
  },
  featureText: {
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    flexGrow: 1,
  },
  featureList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '20px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
};
