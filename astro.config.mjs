import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import tailwindcss from "@tailwindcss/vite";
import remarkDirective from "remark-directive";
import remarkTwitterCard from "./src/lib/markdown/remark-twitter-card.js";
import rehypeImageCaption from "./src/lib/markdown/rehype-image-caption.js";

// https://astro.build/config
export default defineConfig({
	site: "https://blog.amatatu.com",
	integrations: [sitemap(), mdx(), pagefind()],
	image: {
		domains: ["assets.blog.amatatu.com"],
		service: {
			entrypoint: "astro/assets/services/noop",
		},
	},
	vite: {
		plugins: [tailwindcss()],
	},
	markdown: {
		shikiConfig: {
			theme: "css-variables",
		},
		remarkPlugins: [remarkDirective, remarkTwitterCard],
		rehypePlugins: [rehypeImageCaption],
	},
});
