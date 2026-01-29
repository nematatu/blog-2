import { visit } from "unist-util-visit";

const TWITTER_HOSTS = new Set([
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "x.com",
  "www.x.com",
]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (!TWITTER_HOSTS.has(url.hostname)) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  let path = null;

  if (parts.length >= 3 && parts[1] === "status" && /^\d+$/.test(parts[2])) {
    path = `${parts[0]}/status/${parts[2]}`;
  } else if (
    parts.length >= 4 &&
    parts[0] === "i" &&
    parts[1] === "web" &&
    parts[2] === "status" &&
    /^\d+$/.test(parts[3])
  ) {
    path = `i/web/status/${parts[3]}`;
  }

  if (!path) return null;

  let normalized = `https://twitter.com/${path}`;
  if (url.search) normalized += url.search;
  return normalized;
}

function getTweetUrl(node) {
  if (!node || node.type !== "paragraph") return null;
  if (!Array.isArray(node.children) || node.children.length !== 1) return null;

  const child = node.children[0];
  if (!child) return null;

  let rawUrl = null;
  if (child.type === "link") rawUrl = child.url;
  if (child.type === "text") rawUrl = child.value;
  if (!rawUrl) return null;

  return normalizeUrl(rawUrl);
}

export default function remarkTwitterCard() {
  return (tree) => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || index === undefined) return;

      const tweetUrl = getTweetUrl(node);
      if (!tweetUrl) return;

      const safeUrl = escapeHtml(tweetUrl);
      const html = `<div class="twitter-card not-prose"><blockquote class="twitter-tweet"><a href="${safeUrl}" rel="noopener noreferrer">${safeUrl}</a></blockquote></div><script>(function(){if(window.twttr&&window.twttr.widgets){window.twttr.widgets.load();return;}if(window.__twitterWidgetsLoading){return;}window.__twitterWidgetsLoading=true;var s=document.createElement('script');s.async=true;s.src='https://platform.twitter.com/widgets.js';s.charset='utf-8';s.onload=function(){window.__twitterWidgetsLoading=false;if(window.twttr&&window.twttr.widgets){window.twttr.widgets.load();}};document.head.appendChild(s);}());</script>`;

      parent.children[index] = { type: "html", value: html };
    });
  };
}
