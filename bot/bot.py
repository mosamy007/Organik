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
from discord.ext import commands
from discord import app_commands
from pymongo import MongoClient
from bson import ObjectId

# Load env variables
load_dotenv()
TOKEN = os.getenv("TOKEN")
MONGODB_URI = os.getenv("MONGODB_URI")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

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
    def __init__(self, guild_id: str = None):
        super().__init__(timeout=None)
        self.guild_id = guild_id
        if guild_id:
            verify_url = f"{get_app_url()}/verify?guildId={guild_id}"
            self.add_item(
                discord.ui.Button(
                    label="Link New Wallet",
                    url=verify_url,
                    emoji="🔗",
                    style=discord.ButtonStyle.link,
                    row=0
                )
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
                verify_url = f"{get_app_url()}/verify?guildId={guild_id}"
                view = discord.ui.View()
                view.add_item(discord.ui.Button(label="Link Wallet Now", url=verify_url, style=discord.ButtonStyle.link))
                await loading_msg.delete()
                await interaction.followup.send(
                    content="❌ **No Wallet Registered!**\nYou haven't linked an EVM wallet to your Discord account yet. Please click below to verify and link your wallet.",
                    view=view,
                    ephemeral=True
                )
            elif err_type == "not_eligible":
                await loading_msg.edit(
                    content=f"❌ **Holdings Check Failed!**\nChecked Wallet: `{wallet_short}`\n\nYou do not hold the required NFTs for any verification rules in this server."
                )
            else:
                await loading_msg.edit(
                    content=f"❌ **Verification Error:** {res.get('message') or res.get('error') or 'An unexpected error occurred.'}"
                )

class GiveawayLinkView(discord.ui.View):
    def __init__(self, giveaway_id: str, guild_id: str):
        super().__init__(timeout=None)
        giveaway_url = f"{get_app_url()}/giveaways?id={giveaway_id}&guildId={guild_id}"
        self.add_item(
            discord.ui.Button(
                label="Enter Giveaway",
                url=giveaway_url,
                emoji="🎉",
                style=discord.ButtonStyle.link
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
    print(f"[READY] Organik Bot is active and logged in as: {bot.user}")

# /verify command - Send ephemeral verification button for user
@bot.tree.command(name="verify", description="Get your NFT verification link")
async def verify(interaction: discord.Interaction):
    if not interaction.guild_id:
        await interaction.response.send_message(
            "❌ This command can only be used in a Discord server.",
            ephemeral=True
        )
        return

    view = VerifyLinkView(str(interaction.guild_id))
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

    view = VerifyLinkView(str(interaction.guild_id))
    
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