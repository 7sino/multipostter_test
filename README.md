# multipostter

multi-post tool: from misskey.io to bluesky / Twitter

- install pnpm
- check your Architecture (ARM or x86)
  - if your architecture is not ARM, modify Lambda's param in `lib/multipostter-stack.ts`
- start Docker

### build & deploy

```bash
pnpm i
cp bin/mpost{.sample,}.ts
# change bin/mpost.ts
pnpx cdk deploy  --require-approval=never --concurrency 20 --all
# set lastID in the DDB table
```

### set credentials on the SSM Parameter Store

```ts
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
```

## local run

```bash
SOURCE="xxx" DDB_TABLE_NAME="xxx" PARAMSTORE_NAME="xxx" pnpx tsx ./lambda/index.ts
```