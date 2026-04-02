import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Zen Guard',
  version: pkg.version,
  description: 'Block distracting websites during work sessions',
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [{
    js: ['src/content/main.ts'],
    matches: ['<all_urls>'],
    run_at: 'document_start',
  }],
  permissions: [
    'storage',
    'webNavigation',
    'alarms',
    'sidePanel',
  ],
  host_permissions: ['<all_urls>'],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  web_accessible_resources: [{
    resources: ['src/blocked/index.html'],
    matches: ['<all_urls>'],
  }],
  incognito: 'split',
})
