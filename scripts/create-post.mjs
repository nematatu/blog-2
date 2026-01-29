import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import inquirer from "inquirer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const postsDir = path.join(rootDir, "src", "content", "blog");

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeSlug(raw) {
  const trimmed = raw.trim().replaceAll(" ", "-");
  if (!trimmed) return "";
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return "";
  if (!/^[A-Za-z0-9-]+$/.test(trimmed)) return "";
  return trimmed;
}

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function parseTagsFromFrontmatter(contents) {
  const lines = contents.split(/\r?\n/);
  const tags = [];
  let inFrontmatter = false;
  let listMode = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFrontmatter) {
      if (trimmed === "---") {
        inFrontmatter = true;
        continue;
      }
      break;
    }
    if (trimmed === "---") break;
    if (listMode) {
      if (trimmed.startsWith("-")) {
        const value = stripQuotes(trimmed.slice(1).trim());
        if (value) tags.push(value);
        continue;
      }
      if (trimmed !== "") listMode = false;
    }
    const match = trimmed.match(/^tags:\s*(.*)$/);
    if (!match) continue;
    const rest = match[1].trim();
    if (rest.startsWith("[")) {
      const inner = rest.replace(/^\[/, "").replace(/\]$/, "");
      inner
        .split(",")
        .map((item) => stripQuotes(item.trim()))
        .filter(Boolean)
        .forEach((tag) => tags.push(tag));
    } else if (rest) {
      tags.push(stripQuotes(rest));
    } else {
      listMode = true;
    }
  }
  return tags;
}

async function getExistingTags() {
  const files = await listMarkdownFiles(postsDir);
  const tagSet = new Set();
  for (const file of files) {
    const content = await readFile(file, "utf8");
    parseTagsFromFrontmatter(content).forEach((tag) => tagSet.add(tag));
  }
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ja"));
}

function mergeTags(selectedTags, extraTags) {
  const seen = new Set();
  const merged = [];
  const add = (tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  };
  selectedTags.forEach(add);
  extraTags.forEach(add);
  return merged;
}

async function promptForPost(existingTags) {
  const { slug: rawSlug, title, description, ogImage } = await inquirer.prompt([
    {
      type: "input",
      name: "slug",
      message: "slug (required)",
      filter: (value) => value.trim().replaceAll(" ", "-"),
      validate: (value) =>
        sanitizeSlug(value)
          ? true
          : "slugが不正です。英数字とハイフンのみで指定してください。",
    },
    {
      type: "input",
      name: "title",
      message: "title (required)",
      validate: (value) => (value.trim() ? true : "titleは必須です。"),
    },
    {
      type: "input",
      name: "description",
      message: "description",
      default: "",
    },
    {
      type: "input",
      name: "ogImage",
      message: "ogImage（任意・URL）",
      default: "",
    },
  ]);

  let selectedTags = [];
  if (existingTags.length > 0) {
    const result = await inquirer.prompt([
      {
        type: "checkbox",
        name: "tags",
        message: "tags（既存タグから選択）",
        choices: existingTags,
        pageSize: Math.min(12, existingTags.length),
        theme: {
          keybindings: ["vim"],
        },
      },
    ]);
    selectedTags = result.tags;
  }

  const { extraTags: extraTagsRaw } = await inquirer.prompt([
    {
      type: "input",
      name: "extraTags",
      message: "tags追加（任意・カンマ区切り）",
      default: "",
    },
  ]);

  const extraTags = extraTagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    slug: sanitizeSlug(rawSlug),
    title: title.trim(),
    description: description.trim(),
    ogImage: ogImage.trim(),
    tags: mergeTags(selectedTags, extraTags),
  };
}

async function ensureNotExists(filePath) {
  try {
    await access(filePath);
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const existingTags = await getExistingTags();
  const { slug, title, description, ogImage, tags } = await promptForPost(
    existingTags,
  );
  const publishDate = formatDate();

  const filePath = path.join(postsDir, `${slug}.md`);
  const canWrite = await ensureNotExists(filePath);
  if (!canWrite) {
    console.error(`既に存在します: ${path.relative(rootDir, filePath)}`);
    process.exitCode = 1;
    return;
  }

  const lines = [
    "---",
    `title: "${title}"`,
    ...(description ? [`description: "${description}"`] : []),
    `date: "${publishDate}"`,
    "draft: true",
  ];

  if (ogImage) lines.push(`ogImage: "${ogImage}"`);

  if (tags.length > 0) {
    const tagList = tags.map((tag) => `"${tag}"`).join(", ");
    lines.push(`tags: [${tagList}]`);
  } else {
    lines.push("tags: []");
  }

  lines.push("---", "", "");

  await writeFile(filePath, lines.join("\n"), "utf8");

  console.log(`作成しました: ${path.relative(rootDir, filePath)}`);
}

main().catch((error) => {
  if (error?.isTtyError) {
    console.error("この環境では対話入力ができません。");
    process.exitCode = 1;
    return;
  }
  if (error?.name === "ExitPromptError") {
    process.exitCode = 130;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
