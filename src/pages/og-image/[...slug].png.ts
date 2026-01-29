import { Resvg } from "@resvg/resvg-js";
import type { APIContext, InferGetStaticPropsType } from "astro";
import { getCollection } from "astro:content";
import satori, { type SatoriOptions } from "satori";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { SITE } from "@consts";

export const prerender = true;

const ogCachePath = path.resolve(process.cwd(), ".cache/og-image.json");

function loadOgCache(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(ogCachePath, "utf-8")) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function saveOgCache(cache: Record<string, string>) {
  mkdirSync(path.dirname(ogCachePath), { recursive: true });
  writeFileSync(ogCachePath, JSON.stringify(cache, null, 2));
}

function ogHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function loadFontFromDir(
  dirPath: string,
  matcher: (fileName: string) => boolean,
) {
  if (!existsSync(dirPath)) return null;
  const fileName = readdirSync(dirPath).find(matcher);
  if (!fileName) return null;
  return readFileSync(path.join(dirPath, fileName));
}

function loadFonts() {
  const notoDir = path.resolve(
    process.cwd(),
    "node_modules/@fontsource/noto-sans-jp/files",
  );
  const geistSansDir = path.resolve(
    process.cwd(),
    "node_modules/@fontsource/geist-sans/files",
  );
  const geistMonoDir = path.resolve(
    process.cwd(),
    "node_modules/@fontsource/geist-mono/files",
  );

  const notoRegular =
    loadFontFromDir(
      notoDir,
      (file) =>
        file.includes("japanese") &&
        file.includes("-400-") &&
        file.endsWith(".woff"),
    ) ??
    loadFontFromDir(
      notoDir,
      (file) => file.includes("-400-") && file.endsWith(".woff"),
    );

  const notoBold =
    loadFontFromDir(
      notoDir,
      (file) =>
        file.includes("japanese") &&
        file.includes("-700-") &&
        file.endsWith(".woff"),
    ) ??
    loadFontFromDir(
      notoDir,
      (file) => file.includes("-700-") && file.endsWith(".woff"),
    );

  const geistRegular =
    loadFontFromDir(
      geistSansDir,
      (file) =>
        file.includes("latin") &&
        file.includes("-400-") &&
        file.endsWith(".woff"),
    ) ??
    loadFontFromDir(
      geistSansDir,
      (file) => file.includes("-400-") && file.endsWith(".woff"),
    );

  const geistBold =
    loadFontFromDir(
      geistSansDir,
      (file) =>
        file.includes("latin") &&
        file.includes("-700-") &&
        file.endsWith(".woff"),
    ) ??
    loadFontFromDir(
      geistSansDir,
      (file) => file.includes("-700-") && file.endsWith(".woff"),
    );

  const monoRegular =
    loadFontFromDir(
      geistMonoDir,
      (file) =>
        file.includes("latin") &&
        file.includes("-400-") &&
        file.endsWith(".woff"),
    ) ??
    loadFontFromDir(
      geistMonoDir,
      (file) => file.includes("-400-") && file.endsWith(".woff"),
    );

  const monoBold =
    loadFontFromDir(
      geistMonoDir,
      (file) =>
        file.includes("latin") &&
        file.includes("-700-") &&
        file.endsWith(".woff"),
    ) ??
    loadFontFromDir(
      geistMonoDir,
      (file) => file.includes("-700-") && file.endsWith(".woff"),
    );

  const sansName = notoRegular ? "Noto Sans JP" : "Geist Sans";
  const sansRegular = notoRegular ?? geistRegular;
  const sansBold = notoBold ?? geistBold ?? sansRegular;

  if (!sansRegular) {
    throw new Error("OG image font not found. Run npm install first.");
  }

  return {
    sansName,
    sansRegular,
    sansBold: sansBold ?? sansRegular,
    monoName: "Geist Mono",
    monoRegular,
    monoBold,
  };
}

const fonts = loadFonts();

const ogOptions = {
  height: 630,
  width: 1200,
  fonts: [
    {
      data: fonts.sansRegular,
      name: fonts.sansName,
      style: "normal" as const,
      weight: 400 as const,
    },
    {
      data: fonts.sansBold,
      name: fonts.sansName,
      style: "normal" as const,
      weight: 700 as const,
    },
    ...(fonts.monoRegular
      ? [
          {
            data: fonts.monoRegular,
            name: fonts.monoName,
            style: "normal" as const,
            weight: 400 as const,
          },
        ]
      : []),
    ...(fonts.monoBold
      ? [
          {
            data: fonts.monoBold,
            name: fonts.monoName,
            style: "normal" as const,
            weight: 700 as const,
          },
        ]
      : []),
  ],
} satisfies SatoriOptions;

const h = (
  type: string,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => {
  const filteredChildren = children
    .flat()
    .filter((child) => child !== null && child !== false);
  const nextProps = { ...(props ?? {}) } as Record<string, unknown>;
  if (type === "div") {
    const style = (nextProps.style ?? {}) as Record<string, unknown>;
    if (!("display" in style)) {
      nextProps.style = { ...style, display: "flex" };
    }
  }
  nextProps.children = filteredChildren;
  return { type, props: nextProps };
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", ".");
}

const markup = (title: string, description: string, pubDate: string) =>
  h(
    "div",
    {
      style: {
        position: "relative",
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0b0c0e",
        color: "#e8eaed",
        fontFamily: `${fonts.sansName}, ${fonts.monoName}`,
      },
    },
    h("div", {
      style: {
        position: "absolute",
        inset: "0px",
        backgroundImage:
          "radial-gradient(600px 600px at 95% 0%, rgba(43, 188, 137, 0.25), rgba(11, 12, 14, 0) 70%)",
      },
    }),
    h(
      "div",
      {
        style: {
          position: "relative",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "56px 64px",
          justifyContent: "center",
          gap: "20px",
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: "20px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9aa0a6",
            fontFamily: fonts.monoRegular ? fonts.monoName : fonts.sansName,
          },
        },
        pubDate,
      ),
      h(
        "div",
        {
          style: {
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#ffffff",
            maxWidth: "980px",
          },
        },
        title,
      ),
      description
        ? h(
            "div",
            {
              style: {
                fontSize: "28px",
                lineHeight: 1.4,
                color: "#c9cacc",
                maxWidth: "980px",
              },
            },
            description,
          )
        : null,
    ),
    h(
      "div",
      {
        style: {
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 64px",
          borderTop: "1px solid #1c2b2d",
          backgroundColor: "#0f1113",
          fontSize: "20px",
          color: "#c9cacc",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontWeight: 600,
            color: "#e8eaed",
          },
        },
        SITE.TITLE,
      ),
      h(
        "div",
        {
          style: {
            fontSize: "18px",
            color: "#9aa0a6",
          },
        },
        SITE.DESCRIPTION,
      ),
    ),
  );

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export async function GET(context: APIContext) {
  const { title, description, date } = context.props as Props;
  const slugParam = context.params.slug;
  const slug = Array.isArray(slugParam) ? slugParam.join("/") : slugParam;

  const safeDate = date instanceof Date ? date : new Date(date);
  const pubDate = formatDate(safeDate);
  const svg = await satori(markup(title, description, pubDate), ogOptions);
  const pngBuffer = new Resvg(svg).render().asPng();
  const png = new Uint8Array(pngBuffer);

  if (slug) {
    const outputPath = path.resolve(
      process.cwd(),
      "public/og-image",
      `${slug}.png`,
    );
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, png);
  }

  return new Response(png, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/png",
    },
  });
}

export async function getStaticPaths() {
  const showDrafts = import.meta.env.DEV;
  const blog = (await getCollection("blog")).filter(
    (post) => showDrafts || !post.data.draft,
  );
  const projects = (await getCollection("projects")).filter(
    (project) => showDrafts || !project.data.draft,
  );

  const cache = loadOgCache();
  const nextCache: Record<string, string> = { ...cache };

  const entries = [
    ...blog.map((entry) => ({ entry, prefix: "blog" })),
    ...projects.map((entry) => ({ entry, prefix: "projects" })),
  ];

  const paths = entries
    .filter(({ entry }) => !entry.data.ogImage)
    .flatMap(({ entry, prefix }) => {
      const payload = {
        title: entry.data.title,
        description: entry.data.description,
        date: entry.data.date?.toISOString?.() ?? entry.data.date,
      };
      const hash = ogHash(payload);
      const key = `${prefix}/${entry.id}`;

      nextCache[key] = hash;

      const outputPath = path.resolve(
        process.cwd(),
        "public/og-image",
        `${key}.png`,
      );
      const needsUpdate = !existsSync(outputPath) || cache[key] !== hash;
      if (!needsUpdate) return [];

      return [
        {
          params: { slug: `${prefix}/${entry.id}` },
          props: {
            title: entry.data.title,
            description: entry.data.description,
            date: entry.data.date,
          },
        },
      ];
    });

  saveOgCache(nextCache);
  return paths;
}
