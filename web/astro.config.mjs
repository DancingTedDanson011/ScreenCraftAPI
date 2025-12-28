import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind(),
    react(),
    sitemap({
      filter: (page) => !page.includes('/admin/') && !page.includes('/dashboard/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  site: 'https://screencraftapi.com',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
