import axios from "axios";
import {XMLParser} from "fast-xml-parser";

async function getVideoDescription(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await axios.get(url).then(res => res.data);

    // New YouTube player JSON (2024–2025)
    const match = html.match(/"shortDescription":"(.*?)"/);

    if (!match) return null;

return match[1].replace(/\\n/g, "\n");
} catch (err) {
  console.error(`Description fetch error: ${err}`);
  return null;
}
}

async function resolveChannelId(input: string): Promise<string | null> {
  try {
    if (input.includes("channel/")) {
  return input.split("channel/")[1].split(/[/?]/)[0];
}

// @handle
if (input.includes("@")) {
  const username = input.split("@")[1];
  const html = await axios.get(`https://www.youtube.com/@${username}`);
  const match = html.data.match(/"channelId":"(.*?)"/);
  return match ? match[1] : null;
}

return null;
} catch {
  return null;
}
}

async function getLatestVideo(channelId: string) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  const res = await axios.get(url);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const feed = parser.parse(res.data);

  const video = feed.feed.entry?.[0];
  if (!video) return null;

  const videoId = video["yt:videoId"];

  const link = Array.isArray(video.link)
    ? video.link.find((l: any) => l["@_rel"] === "alternate")
    : video.link;

  return {
    id: videoId,
    title: video.title,
    url: link?.["@_href"],
    description: await getVideoDescription(videoId),
    published: new Date(video.published)
  };
}

async function getThumbnail(videoId: string): Promise<string> {
  const qualities = [
    "maxresdefault.jpg",
    "sddefault.jpg",
    "hqdefault.jpg",
    "mqdefault.jpg",
    "default.jpg"
  ];

  for (const quality of qualities) {
  const url = `https://i.ytimg.com/vi/${videoId}/${quality}`;

  try {
    // HEAD request to check if file exists
    await axios.head(url);
    return url;
  } catch {
    continue;
  }
}

// fallback to at least *something*
return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

const channelId = await resolveChannelId("@PewDiePie");
console.log("Channel ID:", channelId);

const latest = await getLatestVideo(channelId);
console.log("Latest video:", latest);


// Test description fetch
if (channelId) {
  const latest = await getLatestVideo(channelId);
  if (latest) {
    const desc = await getVideoDescription(latest.id);
    console.log("Description:", desc);
  }
}

const thumbnailUrl = await getThumbnail(latest.id);
console.log("Thumbnail:", thumbnailUrl);