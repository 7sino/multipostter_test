// https://github.com/bluesky-social/atproto/issues/910
import Proto, { RichText } from "@atproto/api";
import sharp from "sharp";
import { CommonPostData } from "./types.js";
const { BskyAgent } = Proto;

const FILE_SIZE_LIMIT = 1000000;

class BskyClient {
  agent: Proto.BskyAgent;
  constructor(agent: Proto.BskyAgent) {
    this.agent = agent;
  }

  isValid = (post: CommonPostData): boolean => {
    if (!post.isPublic) {
      console.log(`Post is not public`);
      return false;
    }
    if (!post.createdAt.isValid) {
      console.log(`Invalid time ${post.createdAt}`);
      return false;
    }

    // 許す
    if (!post.text) {
      console.log(`Text is empty`);
      return true;
    }
    // 許す
    if (post.files.length > 4) {
      console.log(`Too many files ${post.files.length}`);
      return true;
    }
    return true;
  };

  convertImg = async (original: Blob): Promise<Buffer> => {
    if (original.size <= FILE_SIZE_LIMIT) {
      return Buffer.from(await original.arrayBuffer());
    }
    for (const w of [1920, 1280, 980, 480]) {
      const buffer = sharp(await original.arrayBuffer());
      const mdg = await buffer.resize({ width: w }).toBuffer();
      if (mdg.byteLength <= FILE_SIZE_LIMIT) {
        return mdg;
      }
    }

    throw new Error("cannot convert image");
  };

  post = async (post: CommonPostData) => {
    if (!this.isValid(post)) {
      throw Error(`Invalid Post`);
    }
    const fileBlobs = await Promise.all(
      post.files
        .slice(0, 4)
        .map(
          async (e): Promise<Proto.ComAtprotoRepoUploadBlob.OutputSchema> => {
            const url = e.url;
            const origblob = await fetch(url).then((r) => r.blob());
            const imgBuffer = await this.convertImg(origblob);

            const { data } = await this.agent.uploadBlob(imgBuffer, {
              encoding: origblob.type,
            });

            return data;
          }
        )
    );

    const rt = new RichText({ text: post.text ?? "-" });
    await rt.detectFacets(this.agent);

    await this.agent.post({
      text: rt.text,
      facets: rt.facets,
      createdAt: post.createdAt.toISO()!,
      langs: ["ja", "ja-JP"],
      embed: {
        $type: "app.bsky.embed.images",
        images: fileBlobs.map((e) => ({
          alt: "",
          image: e.blob,
        })),
      },
    });
  };
}

export const initBsky = async (
  identifier: string,
  password: string
): Promise<BskyClient> => {
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });
  await agent.login({
    identifier,
    password,
  });

  return new BskyClient(agent);
};
