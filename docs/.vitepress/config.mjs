import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Project Strix",
  description: "Autonomous AI Pentesting Platform",
  base: "/ProjectStrix/", // Crucial for GitHub Pages hosting on infat0x.github.io/ProjectStrix/
  outDir: ".vitepress/dist",
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/DESCRIPTION' }
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/DESCRIPTION' },
          { text: 'Architecture', link: '/ARCHITECTURE' }
        ]
      },
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/INSTALLATION' },
          { text: 'User Guide', link: '/USER_GUIDE' }
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Bug Review', link: '/BUG_REVIEW' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/infat0x/ProjectStrix' }
    ],
    
    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present Project Strix'
    }
  }
})
