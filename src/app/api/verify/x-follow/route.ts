import { NextRequest, NextResponse } from 'next/server';

const BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const USER_FEATURES = {
  hidden_profile_likes_enabled: true,
  hidden_profile_subscriptions_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
};

const FOLLOWING_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  rweb_video_timestamps_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

function makeTwitterHeaders(authToken: string, ct0: string) {
  return {
    cookie: `auth_token=${authToken}; ct0=${ct0}`,
    'x-csrf-token': ct0,
    authorization: BEARER,
    'content-type': 'application/json',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
  };
}

async function getTwitterUserId(screenName: string, authToken: string, ct0: string): Promise<string | null> {
  const variables = { screen_name: screenName, withSafetyModeUserFields: true };
  const url = `https://x.com/i/api/graphql/NimuplG1OB7Fd2btCLdBOw/UserByScreenName?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(USER_FEATURES))}`;

  const res = await fetch(url, { headers: makeTwitterHeaders(authToken, ct0) });
  if (!res.ok) return null;

  const data = await res.json();
  return data?.data?.user?.result?.rest_id || null;
}

async function getFollowingHandles(userId: string, authToken: string, ct0: string): Promise<string[]> {
  const variables = { userId, count: 200, includePromotedContent: false };
  const url = `https://x.com/i/api/graphql/2vUj-_Ek-UmBVDNtd8OnQA/Following?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(FOLLOWING_FEATURES))}`;

  const res = await fetch(url, { headers: makeTwitterHeaders(authToken, ct0) });
  if (!res.ok) return [];

  const data = await res.json();
  const instructions: any[] = data?.data?.user?.result?.timeline?.timeline?.instructions || [];
  const entries = instructions.flatMap((i: any) => i.entries || []);

  return entries
    .map((e: any) => e?.content?.itemContent?.user_results?.result?.legacy?.screen_name?.toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const { userHandle, targetUrl } = await req.json();

    if (!userHandle || !targetUrl) {
      return NextResponse.json({ error: 'Missing userHandle or targetUrl' }, { status: 400 });
    }

    const authToken = process.env.TWITTER_AUTH_TOKEN;
    const ct0 = process.env.TWITTER_CT0;

    if (!authToken || !ct0) {
      console.error('[X Verify] Missing TWITTER_AUTH_TOKEN or TWITTER_CT0 env vars');
      return NextResponse.json({ error: 'Server Twitter authentication not configured.' }, { status: 500 });
    }

    // Clean up user handle
    const cleanUserHandle = userHandle.trim().replace('@', '').toLowerCase();

    // Clean up target handle from URL
    let targetHandle = targetUrl.trim().replace(/\/+$/, '');
    if (targetHandle.includes('x.com/') || targetHandle.includes('twitter.com/')) {
      const parts = targetHandle.split('/');
      targetHandle = parts[parts.length - 1];
    }
    targetHandle = targetHandle.replace('@', '').split('?')[0].trim().toLowerCase();

    if (!cleanUserHandle || !targetHandle) {
      return NextResponse.json({ error: 'Invalid user handle or target URL.' }, { status: 400 });
    }

    // Step 1: Get the user's Twitter ID
    const userId = await getTwitterUserId(cleanUserHandle, authToken, ct0);
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: `Could not find X account: @${cleanUserHandle}. Check your username and try again.`,
      });
    }

    // Step 2: Get their following list
    const followingHandles = await getFollowingHandles(userId, authToken, ct0);

    const isFollowing = followingHandles.includes(targetHandle);

    if (isFollowing) {
      return NextResponse.json({ success: true, verified: true });
    } else {
      return NextResponse.json({
        success: false,
        verified: false,
        error: `@${cleanUserHandle} is not following @${targetHandle}. Please follow first, then verify.`,
      });
    }
  } catch (err: any) {
    console.error('[X Verify] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
