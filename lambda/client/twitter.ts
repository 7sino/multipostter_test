import { EUploadMimeType, TwitterApi } from "twitter-api-v2";
import { CommonPostData } from "./types.js";

export class TwitterClient {
  userClient: TwitterApi;

  constructor(
    appKey: string,
    appSecret: string,
    accessToken: string,
    accessSecret: string
  ) {
    this.userClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });
  }

  uploadMedia = async (
    original: Blob,
    extension: string
  ): Promise<string | undefined> => {
    const origBuffer = await original.arrayBuffer();
    if (!extension) {
      console.error(`Invalid extension: ${extension}`);
      return undefined;
    }

    const getMimeType = (value: string) => {
      switch (value) {
        case "jpg":
        case "jpeg":
          return EUploadMimeType.Jpeg;
        case "png":
          return EUploadMimeType.Png;
        case "webp":
          return EUploadMimeType.Webp;
        case "gif":
          return EUploadMimeType.Gif;
        case "mov":
          return EUploadMimeType.Mov;
        case "mp4":
          return EUploadMimeType.Mp4;
        default:
          console.error(`Invalid extension: ${extension}`);
          return undefined;
      }
    };
    const mimeType = getMimeType(extension.toLowerCase());
    if (!mimeType) return undefined;
    const resp = await this.userClient.v1.uploadMedia(Buffer.from(origBuffer), {
      mimeType: getMimeType(extension),
    });
    return resp;
  };

  post = async (post: CommonPostData) => {
    const mediaIDs = (
      await Promise.all(
        // 4つまで
        post.files.slice(0, 4).map(async (f) => {
          const url = f.url;
          // `.webp?sensitive=true` などに対処
          const extension = url
            .split(".")
            .pop()!
            .replace(/\?+.*$/, "");
          const origblob = await fetch(url).then((r) => r.blob());
          const mediaID = await this.uploadMedia(origblob, extension);
          if (!mediaID)
            throw new Error(
              `[Twitter] Cannot upload image: ${f.url}, ext: ${extension}`
            );
          return mediaID;
        })
      )
    ).filter((e) => e !== "");
    const param =
      mediaIDs.length > 0
        ? {
            media: {
              media_ids: mediaIDs as [string], // Type Errorを回避するため、適当に長さ1を指定
            },
          }
        : {};
    const text = () => {
      if (post.text.length >= 140) return post.text.slice(0, 135) + "[略]";
      else return post.text;
    };
    const t = await this.userClient.v2.tweet(text(), param);
    console.log(t.data);
  };
}
