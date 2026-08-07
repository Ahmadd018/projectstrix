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
        text: 'Guide & Getting Started',
        collapsed: false,
        items: [
          { text: 'What is Strix?', link: '/guide/what-is-strix' },
          { text: 'Key Features', link: '/guide/features' },
          { text: 'Prerequisites', link: '/guide/prerequisites' },
          { text: 'Ubuntu Deployment', link: '/guide/installation-ubuntu' },
          { text: 'Docker Deployment', link: '/guide/installation-docker' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Updating Strix', link: '/guide/updating' }
        ]
      },
      {
        text: 'Dashboard & UI',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/dashboard/overview' },
          { text: 'Authentication', link: '/dashboard/authentication' },
          { text: 'Role-Based Access', link: '/dashboard/role-based-access' },
          { text: 'Analytics & Charts', link: '/dashboard/analytics-charts' },
          { text: 'System Logs', link: '/dashboard/system-logs' },
          { text: 'API Settings', link: '/dashboard/settings' }
        ]
      },
      {
        text: 'Autonomous Scanning',
        collapsed: false,
        items: [
          { text: 'Creating Scans', link: '/scanning/creating-scans' },
          { text: 'Scan Modes', link: '/scanning/scan-modes' },
          { text: 'Target Lists', link: '/scanning/target-lists' },
          { text: 'Custom Instructions', link: '/scanning/custom-instructions' },
          { text: 'LLM Providers', link: '/scanning/llm-providers' },
          { text: 'Real-Time Streaming', link: '/scanning/real-time-streaming' },
          { text: 'Intelligent Resumption', link: '/scanning/resume-scan' }
        ]
      },
      {
        text: 'Architecture',
        collapsed: false,
        items: [
          { text: 'System Overview', link: '/architecture/system-overview' }
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
