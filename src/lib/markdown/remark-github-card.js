import { visit } from "unist-util-visit";

const DIRECTIVE_NAME = "github";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeRepoInput(input) {
  if (!input) return null;
  let name = String(input).trim();
  if (!name) return null;

  if (/^https?:\/\//i.test(name)) {
    try {
      const url = new URL(name);
      if (url.hostname !== "github.com") return null;
      name = url.pathname;
    } catch {
      return null;
    }
  }

  name = name.replace(/^github\.com\//i, "");
  name = name.replace(/^\//, "");
  name = name.replace(/\/$/, "");

  const parts = name.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const isValid = (part) => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(part);
  if (!parts.every(isValid)) return null;

  if (parts.length >= 2) return { type: "repo", value: `${parts[0]}/${parts[1]}` };
  return { type: "user", value: parts[0] };
}

function buildRepoCard(id, repoName) {
  const safeId = escapeHtml(id);
  const safeRepo = escapeHtml(repoName);
  const realUrl = `https://github.com/${safeRepo}`;
  const script = `(() => {\n  const t = document.getElementById(${JSON.stringify(id)});\n  if (!t) return;\n  const repo = ${JSON.stringify(repoName)};\n  fetch('https://api.github.com/repos/' + repo, { referrerPolicy: 'no-referrer' })\n    .then((response) => response.json())\n    .then((data) => {\n      if (!data || data.message === 'Not Found') {\n        t.classList.add('gh-error');\n        return;\n      }\n      t.classList.remove('gh-loading');\n\n      const descriptionEl = t.querySelector('.gh-description');\n      if (descriptionEl) {\n        if (data.description) {\n          descriptionEl.innerText = data.description.replace(/:[a-zA-Z0-9_]+:/g, '');\n        } else {\n          descriptionEl.style.display = 'none';\n        }\n      }\n\n      const languageEl = t.querySelector('.gh-language');\n      if (languageEl && data.language) languageEl.innerText = data.language;\n\n      const forksEl = t.querySelector('.gh-forks');\n      if (forksEl) forksEl.innerText = Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(data.forks).replaceAll('\\u202f', '');\n\n      const starsEl = t.querySelector('.gh-stars');\n      if (starsEl) starsEl.innerText = Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(data.stargazers_count).replaceAll('\\u202f', '');\n\n      const avatarEl = t.querySelector('.gh-avatar');\n      if (avatarEl && data.owner?.avatar_url) {\n        avatarEl.style.backgroundImage = 'url(' + data.owner.avatar_url + ')';\n      }\n\n      const licenseEl = t.querySelector('.gh-license');\n      if (licenseEl) {\n        if (data.license?.spdx_id) {\n          licenseEl.innerText = data.license.spdx_id;\n        } else {\n          licenseEl.style.display = 'none';\n        }\n      }\n    })\n    .catch((err) => {\n      t.classList.add('gh-error');\n      console.warn('[GITHUB-CARD] Error loading card for ' + repo + ' | ' + ${JSON.stringify(id)} + '.', err);\n    });\n})();`;

  return `\n<div id="${safeId}" class="github-card gh-loading not-prose">\n  <div class="gh-title">\n    <span class="gh-avatar"></span>\n    <a class="gh-text" href="${realUrl}" rel="noopener noreferrer">${safeRepo}</a>\n    <span class="gh-icon" aria-hidden="true"></span>\n  </div>\n  <div class="gh-description">Loading...</div>\n  <div class="gh-chips">\n    <span class="gh-stars">00K</span>\n    <span class="gh-forks">00K</span>\n    <span class="gh-license">MIT</span>\n    <span class="gh-language"></span>\n  </div>\n  <script>${script}</script>\n</div>\n`;
}

function buildUserCard(id, userName) {
  const safeId = escapeHtml(id);
  const safeUser = escapeHtml(userName);
  const realUrl = `https://github.com/${safeUser}`;
  const script = `(() => {\n  const t = document.getElementById(${JSON.stringify(id)});\n  if (!t) return;\n  const user = ${JSON.stringify(userName)};\n  fetch('https://api.github.com/users/' + user, { referrerPolicy: 'no-referrer' })\n    .then((response) => response.json())\n    .then((data) => {\n      if (!data || data.message === 'Not Found') {\n        t.classList.add('gh-error');\n        return;\n      }\n      t.classList.remove('gh-loading');\n\n      const avatarEl = t.querySelector('.gh-avatar');\n      if (avatarEl && data.avatar_url) {\n        avatarEl.style.backgroundImage = 'url(' + data.avatar_url + ')';\n      }\n\n      const followersEl = t.querySelector('.gh-followers');\n      if (followersEl) followersEl.innerText = Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(data.followers).replaceAll('\\u202f', '');\n\n      const reposEl = t.querySelector('.gh-repositories');\n      if (reposEl) reposEl.innerText = Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(data.public_repos).replaceAll('\\u202f', '');\n\n      const regionEl = t.querySelector('.gh-region');\n      if (regionEl) {\n        if (data.location) regionEl.innerText = data.location;\n        else regionEl.style.display = 'none';\n      }\n    })\n    .catch((err) => {\n      t.classList.add('gh-error');\n      console.warn('[GITHUB-CARD] Error loading card for ' + user + ' | ' + ${JSON.stringify(id)} + '.', err);\n    });\n})();`;

  return `\n<div id="${safeId}" class="github-card gh-simple gh-loading not-prose">\n  <div class="gh-title">\n    <span class="gh-avatar"></span>\n    <a class="gh-text" href="${realUrl}" rel="noopener noreferrer">${safeUser}</a>\n    <span class="gh-icon" aria-hidden="true"></span>\n  </div>\n  <div class="gh-chips">\n    <span class="gh-followers">00K</span>\n    <span class="gh-repositories">00K</span>\n    <span class="gh-region"></span>\n  </div>\n  <script>${script}</script>\n</div>\n`;
}

export default function remarkGithubCard() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) return;
      if (!node || node.type !== "leafDirective" || node.name !== DIRECTIVE_NAME) return;

      const attributes = node.attributes || {};
      const rawInput = attributes.repo || attributes.user || null;
      const normalized = sanitizeRepoInput(rawInput);
      if (!normalized) return;

      const id = `GC-${(globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))}`;

      let html = "";
      if (normalized.type === "repo") html = buildRepoCard(id, normalized.value);
      else html = buildUserCard(id, normalized.value);

      parent.children[index] = { type: "html", value: html };
    });
  };
}
