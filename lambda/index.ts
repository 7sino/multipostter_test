// https://github.com/bluesky-social/atproto/issues/910

import { SSM } from "@aws-sdk/client-ssm";
import * as url from "node:url";
import { setTimeout } from "timers/promises";
import { initBsky } from "./client/bsky.js";
import { DDBClient } from "./client/dynamodb.js";
import * as mastodon from "./client/mastodon.js";
import { fetchMyPosts } from "./client/misskey.js";
import { TwitterClient } from "./client/twitter.js";
import { CommonPostData, SNSSource } from "./client/types.js";

type Credentials = {
  MISSKEY_USER_ID?: string;
  MASTODON_USER_ID?: string;
  MASTODON_ACCESS_TOKEN?: string;
  BSKY_ID: string;
  BSKY_APP_PASS: string;
  TWITTER_API_KEY: string;
  TWITTER_API_SECRET: string;
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_ACCESS_TOKEN_SECRET: string;
};

const getSSMCredentials = async (paramName: string): Promise<Credentials> => {
  const ssm = new SSM();
  const response = await ssm.getParameter({
    Name: paramName,
    WithDecryption: true,
  });
  const credentials: Credentials = JSON.parse(response.Parameter!.Value!);
  return credentials;
};

const fetchSourcePosts = async (
  source: SNSSource,
  credential: Credentials,
  sourceSinceID: string
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
  const SOURCE = process.env.SOURCE! as SNSSource;
  if (!SOURCE) {
    throw Error("SOURCE is not set");
  }
  if (SOURCE !== "misskey" && SOURCE !== "mastodon") {
    throw Error(`Invalid SOURCE: ${SOURCE}`);
  }

  const DDB_TABLE_NAME = process.env.DDB_TABLE_NAME!;
  if (!DDB_TABLE_NAME) {
    throw Error("DDB_TABLE_NAME is not set");
  }
  const PARAMSTORE_NAME = process.env.PARAMSTORE_NAME!;
  if (!PARAMSTORE_NAME) {
    throw Error("PARAMSTORE_NAME is not set");
  }
  const credential = await getSSMCredentials(PARAMSTORE_NAME);

  const ddbClient = new DDBClient(DDB_TABLE_NAME);

  const sourceSinceID = await ddbClient.getLastID(SOURCE);
  if (!sourceSinceID) {
    throw Error("ID is not set in DDB");
  }

  const posts = await fetchSourcePosts(SOURCE, credential, sourceSinceID);
  console.log(`process ${posts.length} posts...`);

  // bskyはinitializeをするだけでAPIレートを消費し、スロットリングするので
  if (posts.length > 0) {
    const bskyAgent = await initBsky(
      credential.BSKY_ID,
      credential.BSKY_APP_PASS
    );
    const twitterAgent = new TwitterClient(
      credential.TWITTER_API_KEY,
      credential.TWITTER_API_SECRET,
      credential.TWITTER_ACCESS_TOKEN,
      credential.TWITTER_ACCESS_TOKEN_SECRET
    );

    for (const post of posts) {
      await setTimeout(1000);
      await bskyAgent.post(post);
      await twitterAgent.post(post);
      await ddbClient.putLastID(post.originalID, SOURCE);
      console.log(post.originalID, post.text);
    }
  }
};

export const handler = async (event: any) => {
  await main();
  return "ok";
};

if (import.meta.url.startsWith("file:")) {
  const modulePath = url.fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath) {
    await main();
  }
}
