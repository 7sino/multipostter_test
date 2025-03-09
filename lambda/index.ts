// https://github.com/bluesky-social/atproto/issues/910
import Proto, { RichText } from "@atproto/api";
import sharp from "sharp";
import { CommonPostData, SNSSource } from "./client/types.js";
import { initBsky } from "./client/bsky.js";
import * as mastodon from "./client/mastodon.js";
import { fetchMyPosts } from "./client/misskey.js";
import { TwitterClient } from "./client/twitter.js";
import { setTimeout } from "timers/promises";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const MISSKEY_USER_ID = Deno.env.get("MISSKEY_USER_ID");
const MASTODON_USER_ID = Deno.env.get("MASTODON_USER_ID");
const MASTODON_ACCESS_TOKEN = Deno.env.get("MASTODON_ACCESS_TOKEN");
const BSKY_ID = Deno.env.get("BSKY_ID")!;
const BSKY_APP_PASS = Deno.env.get("BSKY_APP_PASS")!;
const TWITTER_API_KEY = Deno.env.get("TWITTER_API_KEY")!;
const TWITTER_API_SECRET = Deno.env.get("TWITTER_API_SECRET")!;
const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")!;
const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")!;
const SOURCE = Deno.env.get("SOURCE")! as SNSSource;
const DDB_TABLE_NAME = Deno.env.get("DDB_TABLE_NAME")!;

const fetchSourcePosts = async (
  source: SNSSource,
  credential: {
    MISSKEY_USER_ID?: string;
    MASTODON_USER_ID?: string;
    MASTODON_ACCESS_TOKEN?: string;
  },
  sourceSinceID: string | null
): Promise<CommonPostData[]> => {
  if (source === "misskey" && credential.MISSKEY_USER_ID) {
    return await fetchMyPosts(credential.MISSKEY_USER_ID, sourceSinceID);
  } else if (
    source === "mastodon" &&
    credential.MASTODON_USER_ID &&
    credential.MASTODON_ACCESS_TOKEN
  ) {
    return await mastodon.fetchMyPosts(
      credential.MASTODON_USER_ID,
      sourceSinceID,
      credential.MASTODON_ACCESS_TOKEN
    );
  }

  throw Error("cannot fetch source posts");
};

const main = async () => {
  if (!SOURCE) {
    throw Error("SOURCE is not set");
  }
  if (SOURCE !== "misskey" && SOURCE !== "mastodon") {
    throw Error(`Invalid SOURCE: ${SOURCE}`);
  }

  if (!DDB_TABLE_NAME) {
    throw Error("DDB_TABLE_NAME is not set");
  }

  const credential = {
    MISSKEY_USER_ID,
    MASTODON_USER_ID,
    MASTODON_ACCESS_TOKEN,
  };

  const kv = await Deno.openKv();

  const getLastID = async (source: SNSSource): Promise<string | null> => {
    const res = await kv.get<string>([source]);
    return res.value;
  };

  const putLastID = async (id: string, source: SNSSource): Promise<void> => {
    await kv.set([source], id);
  };

  const sourceSinceID = await getLastID(SOURCE);

  const posts = await fetchSourcePosts(SOURCE, credential, sourceSinceID);
  console.log(`process ${posts.length} posts...`);

  // bskyはinitializeをするだけでAPIレートを消費し、スロットリングするので
  if (posts.length > 0) {
    const bskyAgent = await initBsky(BSKY_ID, BSKY_APP_PASS);
    const twitterAgent = new TwitterClient(
      TWITTER_API_KEY,
      TWITTER_API_SECRET,
      TWITTER_ACCESS_TOKEN,
      TWITTER_ACCESS_TOKEN_SECRET
    );

    for (const post of posts) {
      await setTimeout(1000);
      await bskyAgent.post(post);
      await twitterAgent.post(post);
      await putLastID(post.originalID, SOURCE);
      console.log(post.originalID, post.text);
    }
  }
};

const handler = async (req: Request): Promise<Response> => {
  await main();
  return new Response("ok");
};

serve(handler);

if (import.meta.main) {
  await main();
}
