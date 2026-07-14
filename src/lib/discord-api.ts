const API_ENDPOINT = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  botInGuild?: boolean;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

/**
 * Exchanges OAuth authorization code for Discord tokens.
 */
export async function getDiscordTokens(code: string, redirectUri?: string) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Discord client configurations in environment variables.');
  }

  const actualRedirectUri = redirectUri || REDIRECT_URI;
  if (!actualRedirectUri) {
    throw new Error('Missing Discord Redirect URI.');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: actualRedirectUri,
  });

  const res = await fetch(`${API_ENDPOINT}/oauth2/token`, {
    method: 'POST',
    body: params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!res.ok) {
    const errorData = await res.json();
    console.error('OAuth code exchange failed:', errorData);
    throw new Error(`Failed to retrieve Discord token: ${errorData.error_description || res.statusText}`);
  }

  return res.json();
}

/**
 * Fetches user profile using OAuth access token.
 */
export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${API_ENDPOINT}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to retrieve Discord user profile.');
  }

  return res.json();
}

/**
 * Fetches user guilds using OAuth access token.
 */
export async function getDiscordUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch(`${API_ENDPOINT}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to retrieve Discord user guilds.');
  }

  return res.json();
}

/**
 * Checks if the bot is in a specific guild by fetching the guild details.
 */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  const res = await fetch(`${API_ENDPOINT}/guilds/${guildId}`, {
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
  });

  return res.ok;
}

/**
 * Fetches text channels for a specific guild.
 */
export async function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  if (!BOT_TOKEN) throw new Error('Missing Discord Bot Token.');

  const res = await fetch(`${API_ENDPOINT}/guilds/${guildId}/channels`, {
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve channels: ${res.statusText}`);
  }

  const channels: DiscordChannel[] = await res.json();
  // Filter for text channels (type 0) or announcement channels (type 5)
  return channels.filter((channel) => channel.type === 0 || channel.type === 5);
}

/**
 * Fetches roles for a specific guild.
 */
export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  if (!BOT_TOKEN) throw new Error('Missing Discord Bot Token.');

  const res = await fetch(`${API_ENDPOINT}/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to retrieve roles: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Assigns a role to a user in a specific guild.
 */
export async function assignGuildRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
  if (!BOT_TOKEN) throw new Error('Missing Discord Bot Token.');

  const url = `${API_ENDPOINT}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
  console.log(`Assigning role: ${url}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Audit-Log-Reason': 'Wallet NFT Verification success (Organik Bot)',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to assign role ${roleId} to user ${userId} in guild ${guildId}:`, errText);
    return false;
  }

  return true;
}

/**
 * Sends a message (optionally with an embed) to a specific channel.
 */
export async function sendChannelMessage(
  channelId: string,
  content: string,
  embeds?: any[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!BOT_TOKEN) throw new Error('Missing Discord Bot Token.');

  const body: any = {};
  if (content) body.content = content;
  if (embeds) body.embeds = embeds;

  const res = await fetch(`${API_ENDPOINT}/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to send message to channel ${channelId}:`, errText);
    return { success: false, error: errText };
  }

  const msg = await res.json();
  return { success: true, messageId: msg.id };
}
