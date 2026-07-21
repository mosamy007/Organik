import sys
import asyncio
import os
import json
from dotenv import load_dotenv

bot_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(bot_dir, ".env"))
load_dotenv(os.path.join(os.path.dirname(bot_dir), ".env"))

from twikit import Client

async def check_follow(user_handle: str, target_handle: str):
    auth_token = os.getenv("TWITTER_AUTH_TOKEN")
    ct0 = os.getenv("TWITTER_CT0")

    if not auth_token or not ct0:
        return {"success": False, "error": "Bot Twitter authentication missing"}

    client = Client('en-US')
    client.set_cookies({
        'auth_token': auth_token,
        'ct0': ct0
    })

    user_clean = user_handle.strip().lstrip('@').lower()
    target_clean = target_handle.strip().lstrip('@').lower()

    try:
        user = await client.get_user_by_screen_name(user_clean)
        following = await user.get_following()
        following_handles = [x.screen_name.lower() for x in following]
        
        is_following = target_clean in following_handles
        return {
            "success": True,
            "following": is_following,
            "user": user_clean,
            "target": target_clean
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)

    user_arg = sys.argv[1]
    target_arg = sys.argv[2]
    res = asyncio.run(check_follow(user_arg, target_arg))
    print(json.dumps(res))
