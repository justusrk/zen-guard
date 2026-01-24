# Zen Guard

A Chrome browser extension for website blocking and focus management. Take control of your browsing by blocking distracting websites during specific time windows.

## Features

- **Zen Windows** - Create time-based blocking schedules with custom start/end times and days of the week
- **Global Rules** - Set rules that apply at all times, regardless of active Zen Windows
- **Flexible Rule Types**:
  - Block or allow specific URLs and domains
  - Block or allow by keywords found in URL, page headings, or body content
  - Block or allow specific YouTube channels
- **Custom Block Messages** - Display motivational messages when a page is blocked
- **Import/Export** - Backup and restore your configuration
- **Weekly Stats** - Track how many distractions were blocked

## How It Works

1. Create a **Zen Window** with your focus hours (e.g., 9am-5pm on weekdays)
2. Add **rules** to block distracting sites (e.g., social media, news sites)
3. When you try to visit a blocked site during your Zen Window, you'll see a block page with your custom message
4. Use **Global Rules** for sites you want blocked at all times

---

## Development

Built with Svelte 5, TypeScript, Vite, and CRXJS Vite plugin for Chrome Manifest v3.

### Quick Start

1. Install dependencies:

```bash
bun install
```

2. Start development server:

```bash
bun run dev
```

3. Open Chrome and navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension from the `dist` directory.

4. Build for production:

```bash
bun run build
```

### Project Structure

- `src/sidepanel/` - Main management UI for Zen Windows and rules
- `src/popup/` - Quick status view popup
- `src/content/` - Content scripts injected into pages
- `src/background/` - Service worker for navigation handling
- `src/blocked/` - Block page UI
- `src/lib/` - Shared library code (storage, rules engine, types)
- `manifest.config.ts` - Chrome extension manifest configuration

### Chrome Extension Development Notes

- Use `manifest.config.ts` to configure your extension
- The CRXJS plugin automatically handles manifest generation
- Content scripts are in `src/content/`
- Side panel UI is in `src/sidepanel/`

### Documentation

- [Svelte Documentation](https://svelte.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Documentation](https://crxjs.dev/vite-plugin)
