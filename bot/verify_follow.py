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

    # Strategy 0: Direct REST friendships/show.json Lookup (Fast & 100% Accurate)
    try:
        import aiohttp
        url = f"https://api.twitter.com/1.1/friendships/show.json?source_screen_name={user_clean}&target_screen_name={target_clean}"
        headers = {
            'cookie': f'auth_token={auth_token}; ct0={ct0}',
            'x-csrf-token': ct0,
            'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    is_following = data.get('relationship', {}).get('source', {}).get('following', False)
                    if is_following:
                        return {
                            "success": True,
                            "following": True,
                            "user": user_clean,
                            "target": target_clean
                        }
    except Exception as e0:
        print(f"[CheckFollow Strategy 0 Error]: {e0}")

    try:
        user = await client.get_user_by_screen_name(user_clean)
        target = await client.get_user_by_screen_name(target_clean)

        is_verified_user = getattr(user, 'is_blue_verified', False) or getattr(user, 'verified', False)
        is_following = False

        # Strategy 1: Search User's Following List (paginated up to 25 pages / 5000 items)
        try:
            following = await user.get_following(count=200)
            curr = following
            pages = 0
            while curr and pages < 25:
                handles = {x.screen_name.lower() for x in curr}
                if target_clean in handles:
                    is_following = True
                    break
                pages += 1
                if hasattr(curr, 'next'):
                    try:
                        curr = await curr.next()
                    except Exception:
                        break
                else:
                    break
        except Exception as e1:
            print(f"[CheckFollow Strategy 1 Error]: {e1}")

        # Strategy 2: Search Target's Verified Followers List (for verified X users, up to 25 pages / 5000 items)
        if not is_following and is_verified_user:
            try:
                v_followers = await target.get_verified_followers(count=200)
                curr = v_followers
                pages = 0
                while curr and pages < 25:
                    v_handles = {x.screen_name.lower() for x in curr}
                    if user_clean in v_handles:
                        is_following = True
                        break
                    pages += 1
                    if hasattr(curr, 'next'):
                        try:
                            curr = await curr.next()
                        except Exception:
                            break
                    else:
                        break
            except Exception as e2:
                print(f"[CheckFollow Strategy 2 Error]: {e2}")

        # Strategy 3: Search Target's Standard Followers List (paginated up to 25 pages / 5000 items)
        if not is_following:
            try:
                followers = await target.get_followers(count=200)
                curr = followers
                pages = 0
                while curr and pages < 25:
                    f_handles = {x.screen_name.lower() for x in curr}
                    if user_clean in f_handles:
                        is_following = True
                        break
                    pages += 1
                    if hasattr(curr, 'next'):
                        try:
                            curr = await curr.next()
                        except Exception:
                            break
                    else:
                        break
            except Exception as e3:
                print(f"[CheckFollow Strategy 3 Error]: {e3}")

        # Strategy 4: Target's Followers You Know
        if not is_following:
            try:
                k_followers = await target.get_followers_you_know(count=200)
                k_handles = {x.screen_name.lower() for x in k_followers}
                if user_clean in k_handles:
                    is_following = True
            except Exception as e4:
                print(f"[CheckFollow Strategy 4 Error]: {e4}")

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
