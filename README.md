# multipostter

multi-post tool: from misskey.io to bluesky / Twitter

- install pnpm
- check your Architecture (ARM or x86)
  - if your architecture is not ARM, modify Lambda's param in `lib/multipostter-stack.ts`
- start Docker

### build & deploy

```bash
pnpm i
pnpx cdk deploy  --require-approval=never --concurrency 20 --all
# if you need, set lastID in the DDB table
```

### set credentials on the SSM Parameter Store

```ts
type Credentials = {
  BSKY_ID: string;
  BSKY_APP_PASS: string;
  MISSKEY_USER_ID: string;
  TWITTER_API_KEY: string;
  TWITTER_API_SECRET: string;
  TWITTER_ACCESS_TOKEN: string;
  TWITTER_ACCESS_TOKEN_SECRET: string;
};
```

## local run

```bash
DDB_TABLE_NAME="xxx" PARAMSTORE_NAME="xxx" pnpx tsx ./lambda/index.ts
```