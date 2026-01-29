import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Blog",
  DESCRIPTION: "バドとか、開発とか",
  EMAIL: "",
  NUM_POSTS_ON_HOMEPAGE: 5,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "What's new?",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "ブログ",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "A collection of my projects with links to repositories and live demos.",
};

export const SOCIALS: Socials = [
  {
    NAME: "X for 🏸",
    HREF: "https://x.com/tatuminton",
  },
  {
    NAME: "X for 💻",
    HREF: "https://x.com/tatudeve",
  },
  {
    NAME: "GitHub",
    HREF: "https://github.com/nematatu",
  },
  {
    NAME: "Website",
    HREF: "https://amatatu.com",
  },
];
