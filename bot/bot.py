import os
import sys
import io
from dotenv import load_dotenv

# Force UTF-8 encoding for standard output/error to prevent UnicodeEncodeErrors on Windows
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import discord
from discord.ext import commands, tasks
from discord import app_commands
from pymongo import MongoClient
from bson import ObjectId
import urllib.request
import xml.etree.ElementTree as ET
import re
import json
import twikit

# Initialize twikit client
twikit_client = twikit.Client('en-US')

# Load env variables
# Load bot/.env explicitly if it exists to support running the bot from root CWD
bot_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(bot_env_path):
    load_dotenv(bot_env_path)
else:
    load_dotenv()

TOKEN = os.getenv("TOKEN")
MONGODB_URI = os.getenv("MONGODB_URI")
APP_URL = os.getenv("APP_URL") or os.getenv("NEXT_PUBLIC_APP_URL") or "http://localhost:3000"

# Set up twikit cookies
twitter_auth_token = os.getenv("TWITTER_AUTH_TOKEN")
twitter_ct0 = os.getenv("TWITTER_CT0")

if twitter_auth_token and twitter_ct0:
    try:
        twikit_client.set_cookies({
            'auth_token': twitter_auth_token.strip(),
            'ct0': twitter_ct0.strip()
        })
        print("[Twitter Twikit] Loaded cookies from environment variables successfully.")
    except Exception as cookie_err:
        print(f"[Twitter Twikit] Error initializing cookies: {cookie_err}")
else:
    print("[Twitter Twikit] WARNING: TWITTER_AUTH_TOKEN or TWITTER_CT0 is not set in .env. Twikit scraper will not work.")

if not TOKEN:
    print("[CRITICAL] Discord bot token is missing in .env")
    sys.exit(1)

# Setup MongoDB connection
db = None
if MONGODB_URI:
    try:
        client = MongoClient(MONGODB_URI)
        # Extract database name if specified in URI, otherwise default to 'organik_bot'
        db_name = MONGODB_URI.split("/")[-1].split("?")[0] or "organik_bot"
        db = client[db_name]
        print(f"[SUCCESS] Connected to MongoDB database: {db_name}")
    except Exception as e:
        print(f"[ERROR] Failed to connect to MongoDB: {e}")
else:
    print("[WARNING] MONGODB_URI is not set. Database commands will not function.")

import secrets
from datetime import datetime, timedelta

def create_one_time_token(discord_id: str, username: str, avatar_url: str) -> str:
    if db is not None:
        try:
            token = secrets.token_hex(16)
            db["one_time_tokens"].insert_one({
                "_id": token,
                "discordId": discord_id,
                "username": username,
                "avatar": avatar_url,
                "expiresAt": datetime.utcnow() + timedelta(minutes=10)
            })
            return token
        except Exception as e:
            print(f"[WARNING] Failed to create one-time token: {e}")
    return ""

import aiohttp

# Setup Discord Bot
intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

# Helper to dynamically retrieve the Next.js app URL from MongoDB
def get_app_url():
    if db is not None:
        try:
            settings = db["system_settings"].find_one({"_id": "global_settings"})
            if settings and settings.get("appUrl"):
                url = settings.get("appUrl")
                return url[:-1] if url.endswith("/") else url
        except Exception as e:
            print(f"[WARNING] Error reading global_settings: {e}")
    return APP_URL

# API helper to call Next.js auto-verify endpoint
async def call_auto_verify(discord_id: str, guild_id: str):
    url = f"{get_app_url()}/api/verify"
    headers = {
        "Authorization": f"Bot {TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "action": "auto_verify",
        "discordId": discord_id,
        "guildId": guild_id
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    try:
                        err_data = await resp.json()
                        return {
                            "success": False,
                            "error": err_data.get("error", "API returned error"),
                            "message": err_data.get("message", "")
                        }
                    except:
                        return {"success": False, "error": f"API returned status {resp.status}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# UI views
class VerifyLinkView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Link New Wallet", style=discord.ButtonStyle.secondary, emoji="🔗", custom_id="link_new_wallet_btn", row=0)
    async def link_new_wallet(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        
        guild_id = str(interaction.guild_id)
        user_id = str(interaction.user.id)
        username = str(interaction.user.name)
        avatar_url = interaction.user.display_avatar.url if interaction.user.display_avatar else ""
        
        token = create_one_time_token(user_id, username, avatar_url)
        verify_url = f"{get_app_url()}/verify?guildId={guild_id}"
        if token:
            verify_url += f"&token={token}"
            
        view = discord.ui.View()
        view.add_item(discord.ui.Button(label="Open Link Portal", url=verify_url, style=discord.ButtonStyle.link, emoji="🔓"))
        
        await interaction.followup.send(
            content="🔐 **Personalized Verification Link**\nClick below to securely connect and link your wallet. This link is private to you and logs you in automatically.",
            view=view,
            ephemeral=True
        )

    @discord.ui.button(label="Verify NFT Roles", style=discord.ButtonStyle.success, emoji="🔐", custom_id="auto_verify_btn", row=0)
    async def auto_verify(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        # Send real-time progress feedback to the user
        loading_msg = await interaction.followup.send(
            content="🔍 **Checking NFT holdings on multiple chains...** Please wait a moment.",
            ephemeral=True
        )
        
        guild_id = str(interaction.guild_id)
        res = await call_auto_verify(str(interaction.user.id), guild_id)
        
        if res.get("success"):
            wallet = res.get("walletAddress", "")
            wallet_short = f"{wallet[:6]}...{wallet[-4:]}" if len(wallet) > 10 else wallet
            await loading_msg.edit(
                content=f"✅ **Verification Success!**\nRegistered Wallet: `{wallet_short}`\n\n{res.get('message', 'Your roles have been updated.')}"
            )
        else:
            err_type = res.get("error")
            wallet = res.get("walletAddress", "")
            wallet_short = f"{wallet[:6]}...{wallet[-4:]}" if len(wallet) > 10 else wallet
            
            if err_type == "no_wallet_linked":
                token = create_one_time_token(str(interaction.user.id), str(interaction.user.name), interaction.user.display_avatar.url if interaction.user.display_avatar else "")
                verify_url = f"{get_app_url()}/verify?guildId={guild_id}"
                if token:
                    verify_url += f"&token={token}"
                view = discord.ui.View()
                view.add_item(discord.ui.Button(label="Link Wallet Now", url=verify_url, style=discord.ButtonStyle.link, emoji="🔗"))
                await loading_msg.delete()
                await interaction.followup.send(
                    content="❌ **No Wallet Registered!**\nYou haven't linked an EVM wallet to your Discord account yet. Please click below to verify and link your wallet.",
                    view=view,
                    ephemeral=True
                )
            elif err_type == "role_assignment_failed":
                await loading_msg.edit(
                    content=f"⚠️ **Role Assignment Failed!**\nChecked Wallet: `{wallet_short}`\n\n**You hold the required NFTs**, but the bot lacks permission to assign the role in this server.\n\n👉 **Server Admins:** Please go to **Server Settings -> Roles**, and drag the **Organik Bot** role so that it is positioned **above** the verified role."
                )
            elif err_type == "not_eligible":
                await loading_msg.edit(
                    content=f"❌ **Holdings Check Failed!**\nChecked Wallet: `{wallet_short}`\n\nYou do not hold the required NFTs for any verification rules in this server."
                )
            else:
                await loading_msg.edit(
                    content=f"❌ **Verification Error:** {res.get('message') or res.get('error') or 'An unexpected error occurred.'}"
                )

# Helper to fetch Twitter RSS (supports usernames or direct RSS URLs)
def fetch_tweets_rss(source: str):
    source = source.strip()
    if source.startswith("http://") or source.startswith("https://"):
        urls = [source]
        username = "rss_feed"
    else:
        username = source.replace('@', '')
        urls = [
            f"https://nitter.privacydev.net/{username}/rss",
            f"https://nitter.poast.org/{username}/rss",
            f"https://nitter.moomoo.me/{username}/rss",
            f"https://rsshub.app/twitter/user/{username}"
        ]

    for url in urls:
        try:
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()
                root = ET.fromstring(xml_data)
                items = []
                for item in root.findall('.//item'):
                    link = item.find('link').text if item.find('link') is not None else ''
                    guid_elem = item.find('guid')
                    guid = guid_elem.text if guid_elem is not None else link
                    title = item.find('title').text if item.find('title') is not None else ''
                    
                    tweet_id_match = re.search(r'/status/(\d+)', link)
                    tweet_id = tweet_id_match.group(1) if tweet_id_match else guid
                    
                    if tweet_id:
                        display_link = link
                        # Normalize Twitter/Nitter status URLs to standard x.com links
                        if "twitter.com" in link or "nitter" in link:
                            link_user = username
                            user_match = re.search(r'(?:twitter\.com|nitter\.[a-z\.]+)/([^/]+)/status', link)
                            if user_match:
                                link_user = user_match.group(1)
                            display_link = f"https://x.com/{link_user}/status/{tweet_id}"
                        
                        items.append({
                            'id': tweet_id,
                            'title': title,
                            'link': display_link
                        })
                if items:
                    return items
        except Exception as e:
            # Silence and try next URL
            pass
    return []

# Helper to fetch Twitter tweets via Twikit (using cookie auth)
async def fetch_tweets_twikit(username: str):
    username = username.replace('@', '').strip()
    if not os.getenv("TWITTER_AUTH_TOKEN") or not os.getenv("TWITTER_CT0"):
        print("[Twitter Twikit] WARNING: Cannot query twikit. TWITTER_AUTH_TOKEN or TWITTER_CT0 is not set in .env.")
        return []
    try:
        user = await twikit_client.get_user_by_screen_name(username)
        tweets = await user.get_tweets('Tweets', count=10)
        items = []
        for t in tweets:
            items.append({
                'id': t.id,
                'title': t.text if hasattr(t, 'text') else '',
                'link': f"https://x.com/{username}/status/{t.id}"
            })
        return items
    except Exception as e:
        print(f"[Twitter Twikit] Error fetching tweets for {username}: {e}")
        return []

# Helper to fetch OpenSea sales
def fetch_opensea_sales(slug: str):
    opensea_key = os.getenv("OPENSEA_API_KEY")
    if not opensea_key:
        print("[OpenSea API] OPENSEA_API_KEY is missing in bot environment")
        return []
    url = f"https://api.opensea.io/api/v2/events/collection/{slug}?event_type=sale&limit=5"
    try:
        req = urllib.request.Request(
            url,
            headers={
                'x-api-key': opensea_key,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('asset_events', [])
    except Exception as e:
        print(f"[OpenSea API] Error fetching sales for slug {slug}: {e}")
    return []

# Helper to resolve OpenSea slug from contract address
async def resolve_opensea_slug(chain: str, address: str):
    opensea_key = os.getenv("OPENSEA_API_KEY")
    if not opensea_key:
        return None
    url = f"https://api.opensea.io/api/v2/chain/{chain}/contract/{address}"
    try:
        req = urllib.request.Request(
            url,
            headers={
                'x-api-key': opensea_key,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return {
                "slug": data.get("collection", ""),
                "name": data.get("name", "Unnamed Collection")
            }
    except Exception as e:
        print(f"[OpenSea Slug Resolution] Error for {address}: {e}")
    return None

# Twitter Polling Loop
@tasks.loop(seconds=60)
async def twitter_polling_loop():
    if db is None:
        return
    try:
        active_twitter = db["integrations"].find({
            "twitter.enabled": True,
            "twitter.channelId": {"$ne": ""}
        })
        for config in active_twitter:
            guild_id = config.get("guildId")
            channel_id = config.get("twitter", {}).get("channelId")
            accounts = config.get("twitter", {}).get("accounts", [])
            last_processed = config.get("twitter", {}).get("lastProcessedIds", {})

            if not channel_id or not accounts:
                continue

            channel = bot.get_channel(int(channel_id))
            if not channel:
                try:
                    channel = await bot.fetch_channel(int(channel_id))
                except Exception:
                    continue

            db_updated = False
            for username in accounts:
                if username.startswith("http://") or username.startswith("https://"):
                    tweets = fetch_tweets_rss(username)
                else:
                    tweets = await fetch_tweets_twikit(username)
                if not tweets:
                    continue

                processed_ids = last_processed.get(username, [])
                
                # If this is the first time we poll this feed, initialize it with current tweets
                # but send the single most recent one to confirm the connection works.
                if not processed_ids:
                    if tweets:
                        processed_ids = [t['id'] for t in tweets[1:]]
                        last_processed[username] = processed_ids
                        db_updated = True
                    else:
                        processed_ids = []
                        last_processed[username] = processed_ids
                        db_updated = True
                        continue

                new_tweets = [t for t in tweets if t['id'] not in processed_ids]

                for tweet in reversed(new_tweets):
                    try:
                        await channel.send(tweet['link'])
                        processed_ids.append(tweet['id'])
                        db_updated = True
                    except Exception as send_err:
                        print(f"[Twitter Loop] Error posting tweet {tweet['id']} to channel {channel_id}: {send_err}")

                if len(processed_ids) > 50:
                    processed_ids = processed_ids[-50:]
                last_processed[username] = processed_ids

            if db_updated:
                db["integrations"].update_one(
                    {"guildId": guild_id},
                    {"$set": {"twitter.lastProcessedIds": last_processed}}
                )
    except Exception as e:
        print(f"[Twitter Loop] Error in background task: {e}")

# Sales Polling Loop
@tasks.loop(seconds=120)
async def sales_polling_loop():
    if db is None:
        return
    try:
        active_sales = db["integrations"].find({
            "sales.enabled": True,
            "sales.channelId": {"$ne": ""}
        })
        for config in active_sales:
            guild_id = config.get("guildId")
            channel_id = config.get("sales", {}).get("channelId")
            contracts = config.get("sales", {}).get("contracts", [])
            last_processed = config.get("sales", {}).get("lastProcessedTxHashes", [])

            if not channel_id or not contracts:
                continue

            channel = bot.get_channel(int(channel_id))
            if not channel:
                try:
                    channel = await bot.fetch_channel(int(channel_id))
                except Exception:
                    continue

            db_updated = False
            for contract in contracts:
                address = contract.get("address")
                chain = contract.get("chain", "ethereum")
                slug = contract.get("slug")
                name = contract.get("name") or "Unnamed Collection"

                if not address:
                    continue

                # If collection slug is missing, attempt to fetch it and update DB config
                if not slug:
                    resolved = await resolve_opensea_slug(chain, address)
                    if resolved:
                        slug = resolved["slug"]
                        name = resolved["name"]
                        db["integrations"].update_one(
                            {"guildId": guild_id, "sales.contracts.address": address},
                            {"$set": {
                                "sales.contracts.$.slug": slug,
                                "sales.contracts.$.name": name
                            }}
                        )
                    else:
                        continue

                events = fetch_opensea_sales(slug)
                if not events:
                    continue

                for event in reversed(events):
                    tx_hash = event.get('transaction')
                    nft_info = event.get('nft', {})
                    token_id = nft_info.get('identifier')

                    if not tx_hash or not token_id:
                        continue

                    sale_key = f"{tx_hash}:{token_id}"
                    if sale_key in last_processed:
                        continue

                    payment = event.get('payment', {})
                    quantity = payment.get('quantity')
                    decimals = payment.get('decimals')
                    if decimals is None:
                        decimals = 18
                    symbol = payment.get('symbol')
                    if not symbol or symbol.strip() == "":
                        symbol = 'ETH'

                    price_formatted = "Unknown"
                    if quantity:
                        try:
                            price = float(quantity) / (10 ** decimals)
                            price_formatted = f"{price:.4f}".rstrip('0').rstrip('.')
                        except Exception:
                            pass

                    nft_name = nft_info.get('name') or f"{name} #{token_id}"
                    image_url = nft_info.get('image_url')
                    opensea_url = nft_info.get('opensea_url') or f"https://opensea.io/assets/{chain}/{address}/{token_id}"
                    explorer_url = f"https://basescan.org/tx/{tx_hash}" if chain == "base" else f"https://etherscan.io/tx/{tx_hash}"

                    embed = discord.Embed(
                        title="🎉 New NFT Sale!",
                        description=f"**[{nft_name}]({opensea_url})** has been sold!",
                        color=0x06b6d4,
                        url=opensea_url
                    )
                    embed.add_field(name="Price", value=f"💰 {price_formatted} {symbol}", inline=True)
                    embed.add_field(name="Blockchain", value=f"⛓️ {chain.capitalize()}", inline=True)
                    embed.add_field(name="Transaction", value=f"🔗 [View Tx]({explorer_url})", inline=True)
                    
                    if image_url:
                        embed.set_image(url=image_url)

                    try:
                        await channel.send(embed=embed)
                        last_processed.append(sale_key)
                        db_updated = True
                    except Exception as send_err:
                        print(f"[Sales Loop] Error posting sale embed to channel {channel_id}: {send_err}")

            if db_updated:
                if len(last_processed) > 50:
                    last_processed = last_processed[-50:]
                db["integrations"].update_one(
                    {"guildId": guild_id},
                    {"$set": {"sales.lastProcessedTxHashes": last_processed}}
                )
    except Exception as e:
        print(f"[Sales Loop] Error in background task: {e}")

class GiveawayLinkView(discord.ui.View):
    def __init__(self, giveaway_id: str, guild_id: str):
        super().__init__(timeout=None)
        self.add_item(
            discord.ui.Button(
                label="Enter Giveaway",
                style=discord.ButtonStyle.primary,
                emoji="🎉",
                custom_id=f"enter_giveaway_{giveaway_id}_{guild_id}"
            )
        )

@bot.event
async def on_ready():
    # Register persistent verification view
    bot.add_view(VerifyLinkView())
    # Sync the bot slash commands globally
    try:
        synced = await bot.tree.sync()
        print(f"[SYNC] Synced {len(synced)} slash commands globally.")
    except Exception as e:
        print(f"[ERROR] Failed to sync slash commands: {e}")

    # Start background loops if not already running
    if not twitter_polling_loop.is_running():
        twitter_polling_loop.start()
        print("[SUCCESS] Started Twitter polling loop task.")
    if not sales_polling_loop.is_running():
        sales_polling_loop.start()
        print("[SUCCESS] Started NFT sales polling loop task.")

    print(f"[READY] Organik Bot is active and logged in as: {bot.user}")

@bot.event
async def on_interaction(interaction: discord.Interaction):
    if interaction.data:
        custom_id = interaction.data.get("custom_id", "")
        if custom_id and custom_id.startswith("enter_giveaway_"):
            try:
                parts = custom_id.split("_")
                if len(parts) >= 4:
                    giveaway_id = parts[2]
                    guild_id = parts[3]
                    
                    await interaction.response.defer(ephemeral=True)
                    
                    user_id = str(interaction.user.id)
                    username = str(interaction.user.name)
                    avatar_url = interaction.user.display_avatar.url if interaction.user.display_avatar else ""
                    
                    token = create_one_time_token(user_id, username, avatar_url)
                    
                    url = f"{get_app_url()}/giveaways?id={giveaway_id}&guildId={guild_id}"
                    if token:
                        url += f"&token={token}"
                        
                    view = discord.ui.View()
                    view.add_item(discord.ui.Button(label="Open Giveaway Portal", url=url, style=discord.ButtonStyle.link, emoji="🔓"))
                    
                    await interaction.followup.send(
                        content="🎉 **Giveaway Entry Link**\nClick below to participate in this giveaway. This link is private to you and logs you in automatically.",
                        view=view,
                        ephemeral=True
                    )
            except Exception as e:
                print(f"[ERROR] on_interaction enter_giveaway failed: {e}")

# /verify command - Send ephemeral verification button for user
@bot.tree.command(name="verify", description="Get your NFT verification link")
async def verify(interaction: discord.Interaction):
    if not interaction.guild_id:
        await interaction.response.send_message(
            "❌ This command can only be used in a Discord server.",
            ephemeral=True
        )
        return

    view = VerifyLinkView()
    await interaction.response.send_message(
        content="🔐 Click the button below to connect your EVM wallet and verify your NFT holdings or traits to claim roles.",
        view=view,
        ephemeral=True
    )

# /verify-setup command - Admin command to post persistent verification embed
@bot.tree.command(name="verify-setup", description="Post the persistent NFT verification panel in the current channel")
@app_commands.checks.has_permissions(administrator=True)
async def verify_setup(interaction: discord.Interaction):
    if not interaction.guild_id:
        await interaction.response.send_message(
            "❌ This command can only be used in a Discord server.",
            ephemeral=True
        )
        return

    embed = discord.Embed(
        title="☘️ Organik NFT Verification Portal",
        description=(
            "Welcome to our official Web3 Role Verification portal!\n\n"
            "To gain access to token-gated roles and unlock exclusive channels, "
            "you must verify your NFT holdings or specific traits.\n\n"
            "**Steps to Verify:**\n"
            "1️⃣ Click the **Verify Wallet** button below.\n"
            "2️⃣ Link your Discord account and EVM wallet.\n"
            "3️⃣ Sign a gasless message in your wallet to verify ownership.\n\n"
            "*Organik Bot uses secure, read-only signature verification. "
            "We will never ask you to execute a transaction or approve gas.*"
        ),
        color=0x8b5cf6  # Premium purple color
    )
    
    # Optional branding thumbnail
    embed.set_thumbnail(url=interaction.guild.icon.url if interaction.guild.icon else "https://cdn.discordapp.com/embed/avatars/0.png")
    embed.set_footer(text="Organik Concepts © 2026 • Secure Web3 Verification")

    view = VerifyLinkView()
    
    # Send message to channel
    await interaction.channel.send(embed=embed, view=view)
    
    # Confirm command execution to the admin
    await interaction.response.send_message(
        "✅ Verification panel has been posted in this channel.",
        ephemeral=True
    )

# /giveaway-post command - Admin command to post a giveaway card
@bot.tree.command(name="giveaway-post", description="Post a giveaway entry card in the channel")
@app_commands.describe(giveaway_id="Enter the database ID of the giveaway")
@app_commands.checks.has_permissions(administrator=True)
async def giveaway_post(interaction: discord.Interaction, giveaway_id: str):
    if not db:
        await interaction.response.send_message(
            "❌ Bot database is not connected.",
            ephemeral=True
        )
        return

    try:
        # Fetch giveaway from mongo
        giveaway = db.giveaways.find_one({"_id": ObjectId(giveaway_id)})
        
        if not giveaway:
            await interaction.response.send_message(
                f"❌ Giveaway with ID `{giveaway_id}` was not found in database.",
                ephemeral=True
            )
            return

        # Double check guild matches
        if str(giveaway.get("guildId")) != str(interaction.guild_id):
            await interaction.response.send_message(
                "❌ This giveaway belongs to a different server.",
                ephemeral=True
            )
            return

        # Build giveaway embed
        prize = giveaway.get("prize", "Custom Reward")
        desc = giveaway.get("description", "No description provided.")
        winners = giveaway.get("winnerCount", 1)
        end_time = giveaway.get("endTime")

        embed = discord.Embed(
            title=f"🎉 GIVEAWAY: {prize} 🎉",
            description=f"{desc}\n\n🏆 Winners: **{winners}**\n🕒 Ends: **{end_time}**",
            color=0x06b6d4  # Cyber cyan color
        )
        
        # Display required tasks if present
        tasks = giveaway.get("tasks", [])
        if tasks:
            tasks_str = ""
            for task in tasks:
                req = "*" if task.get("required") else ""
                tasks_str += f"- {task.get('label')}{req}\n"
            embed.add_field(name="📋 Requirements", value=tasks_str, inline=False)

        embed.set_footer(text="Click 'Enter Giveaway' to complete tasks and participate!")
        
        view = GiveawayLinkView(giveaway_id, str(interaction.guild_id))
        
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ Giveaway card posted.", ephemeral=True)

    except Exception as e:
        print(f"Error posting giveaway: {e}")
        await interaction.response.send_message(
            f"❌ Failed to post giveaway. Error: {str(e)}",
            ephemeral=True
        )

# /giveaway-list command - Show active giveaways for users
@bot.tree.command(name="giveaways", description="List active giveaways for this server")
async def giveaways_list(interaction: discord.Interaction):
    if not interaction.guild_id:
        await interaction.response.send_message(
            "❌ This command can only be used in a Discord server.",
            ephemeral=True
        )
        return

    if not db:
        await interaction.response.send_message(
            "❌ Bot database is not connected.",
            ephemeral=True
        )
        return

    try:
        # Query active giveaways
        active_gws = list(db.giveaways.find({
            "guildId": str(interaction.guild_id),
            "status": "active"
        }))

        if not active_gws:
            await interaction.response.send_message(
                "🎁 There are currently no active giveaways in this server.",
                ephemeral=True
            )
            return

        embed = discord.Embed(
            title="🎁 Active Server Giveaways",
            description="Complete required tasks and submit entries to win!",
            color=0x10b981  # Green
        )

        for gw in active_gws:
            giveaway_url = f"{APP_URL}/giveaways?id={str(gw['_id'])}&guildId={interaction.guild_id}"
            embed.add_field(
                name=gw.get("prize"),
                value=f"{gw.get('description', 'No description')}\n🕒 Ends: {gw.get('endTime')}\n🔗 [Join here]({giveaway_url})",
                inline=False
            )

        await interaction.response.send_message(embed=embed, ephemeral=True)

    except Exception as e:
        print(f"Error fetching active giveaways: {e}")
        await interaction.response.send_message(
            "❌ Failed to fetch giveaways list.",
            ephemeral=True
        )

# Error handler for permissions
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.MissingPermissions):
        await interaction.response.send_message(
            "❌ You do not have permissions to use this command.",
            ephemeral=True
        )
    else:
        print(f"Unhandled Command Error: {error}")

# Run Bot
bot.run(TOKEN)