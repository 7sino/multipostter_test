import { convert } from "html-to-text";
import { DateTime } from "luxon";
import { createRestAPIClient, mastodon } from "masto";
import { CommonPostData } from "./types.js";

export async function fetchMyPosts(
  myUserId: string,
  sinceId: string | undefined,
  accessToken: string
): Promise<CommonPostData[]> {
  const masto = createRestAPIClient({
    url: "https://mastodon.social/",
    accessToken,
  });

  const posts = await masto.v1.accounts.$select(myUserId).statuses.list({
    sinceId,
    limit: 50,
  });

  const t = posts.map(parseNote);
  t.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
  return t;
}

function parseNote(note: mastodon.v1.Status): CommonPostData {
  const textContent = convert(note.content, {
    selectors: [{ selector: "a", options: { hideLinkHrefIfSameAsText: true } }],
  });

  const d = {
    originalID: note.id,
    text: textContent,
    files: note.mediaAttachments.map((e) => ({
      url: e.url!,
    })),
    createdAt: DateTime.fromISO(note.createdAt),
    isPublic: note.visibility === "public",
  };
  console.log(d);
  return d;
}
