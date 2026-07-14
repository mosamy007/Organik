import os
import sys
from dotenv import load_dotenv

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
    print("CRITICAL ERROR: Discord bot token is missing in .env")
    sys.exit(1)

# Setup MongoDB connection
db = None
if MONGODB_URI:
    try:
        client = MongoClient(MONGODB_URI)
        # Extract database name if specified in URI, otherwise default to 'organik_bot'
        db_name = MONGODB_URI.split("/")[-1].split("?")[0] or "organik_bot"
        db = client[db_name]
        print(f"✅ Successfully connected to MongoDB database: {db_name}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
else:
    print("WARNING: MONGODB_URI is not set. Database commands will not function.")

# Setup Discord Bot
intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)

# UI views
class VerifyLinkView(discord.ui.View):
    def __init__(self, guild_id: str):
        super().__init__(timeout=None)
        verify_url = f"{APP_URL}/verify?guildId={guild_id}"
        self.add_item(
            discord.ui.Button(
                label="Verify Wallet",
                url=verify_url,
                emoji="🔐",
                style=discord.ButtonStyle.link
            )
        )

class GiveawayLinkView(discord.ui.View):
    def __init__(self, giveaway_id: str, guild_id: str):
        super().__init__(timeout=None)
        giveaway_url = f"{APP_URL}/giveaways?id={giveaway_id}&guildId={guild_id}"
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
    # Sync the bot slash commands globally
    try:
        synced = await bot.tree.sync()
        print(f"🔄 Synced {len(synced)} slash commands globally.")
    except Exception as e:
        print(f"❌ Failed to sync slash commands: {e}")
    print(f"🚀 Organik Bot is active and logged in as: {bot.user}")

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