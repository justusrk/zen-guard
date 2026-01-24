# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zen Guard is a Chrome Browser Extension for website blocking and focus management. Built with Svelte 5, TypeScript, and Vite using CRXJS Vite Plugin for Chrome Manifest v3 support.

## Commands

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build production extension (output in `dist/`, ZIP in `release/`)

**Development workflow:** Run `bun run dev`, then load the `dist/` folder in `chrome://extensions/` with Developer mode enabled.

## Terminology

- **Zen Window** (code: `Session`) - A time-based blocking schedule with start/end times and days of the week. Only one can be active at a time. Contains its own set of rules.
- **Global Rules** - Rules that apply at all times regardless of active Zen Window. Can be toggled on/off.
- **Rule** - A blocking/allowing pattern. Types:
  - `blacklist_exact` / `whitelist_exact` - Match URLs/domains
  - `blacklist_keyword` / `whitelist_keyword` - Match content in URL, headings, or body
  - `yt_channel_blacklist` / `yt_channel_whitelist` - Match YouTube channels
- **skipRemaining** - Rule flag that stops processing subsequent rules when matched
- **Block Message** - Custom message shown on the blocked page (priority: rule > zen window > global)

## Architecture

### Entry Points (Chrome Extension Manifest v3)

1. **Side Panel** (`src/sidepanel/`) - Main management UI for Zen Windows and rules
2. **Popup** (`src/popup/`) - Quick status view when clicking extension icon
3. **Content Script** (`src/content/`) - Injected into HTTPS pages, extracts page content and YouTube channel info
4. **Service Worker** (`src/background/service-worker.ts`) - Handles navigation events, rule evaluation, and blocking
5. **Blocked Page** (`src/blocked/`) - Displayed when a page is blocked

### Core Library (`src/lib/`)

- **types.ts** - Type definitions for Rule, Session, Settings, EvaluationResult
- **storage.ts** - Chrome storage API wrapper for sessions, rules, settings, stats
- **rules-engine.ts** - `evaluateUrl()` and `evaluateUrlOnly()` for rule matching
- **session-manager.ts** - Time-based session activation logic
- **youtube.ts** - YouTube URL parsing and channel extraction
- **config-io.ts** - Import/export configuration as JSON

### Data Flow

1. **Navigation detected** → Service worker catches `webNavigation.onCommitted`
2. **URL-only check** → `evaluateUrlOnly()` checks exact URL rules immediately
3. **Content scan** → Content script extracts headings, body text, YouTube channel
4. **Full evaluation** → `evaluateUrl()` with content for keyword/channel rules
5. **Blocking** → Redirect to `src/blocked/index.html` with rule info in query params

### Rule Processing Order

Rules are processed in order (session rules first, then global rules). Each rule type can either block or whitelist. The `skipRemaining` flag stops further rule processing when matched.

## Path Alias

`@/*` maps to `src/*` for imports.

## Svelte 5

Uses Svelte 5 runes (`$state`, `$props`, `$derived`) for reactivity. When editing form components, use `$state.snapshot()` to capture initial values and avoid reactivity issues during drag-and-drop operations.
