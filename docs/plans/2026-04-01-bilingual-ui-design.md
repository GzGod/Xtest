# Bilingual UI Design

## Goal

Convert the current UI from English-only to a bilingual Chinese/English interface with:

- Chinese as the default language
- an explicit language toggle in the UI
- persisted language choice using `localStorage`

This is a localization pass for user-facing interface text, not a translation of imported account data from X.

## Chosen Approach

Use lightweight local locale files instead of a full i18n framework.

### Why

- the app currently has a single main page and a small number of components
- most user-facing strings are hardcoded in `App.tsx`
- adding `react-i18next` would be heavier than needed right now
- a local translation layer keeps the code simple and makes future migration easier

## Architecture

### Locale Files

Add separate locale dictionaries:

- `locales/zh-CN.js`
- `locales/en-US.js`

Each file will export a flat translation map for:

- sidebar
- search
- profile actions
- shared-following controls
- legend
- methodology modal
- graph control tooltips

### Locale Service

Add a lightweight helper module:

- normalize locale values
- resolve initial locale using `localStorage`
- return translated strings with fallback behavior

Default locale will always be `zh-CN`.

### Persistence

Use `localStorage` with a dedicated key such as:

- `ai-influencers-locale`

Behavior:

- first visit: use Chinese
- after user switches language: persist selection
- next visit: restore saved locale

## UI Scope

### Translate

Translate all interface copy visible to users, including:

- page title and “data last updated”
- search placeholder
- creator card labels
- profile action buttons
- shared-following panel controls and empty states
- legend labels
- methodology modal copy
- graph zoom/reset tooltips

### Do Not Translate

Do not translate dynamic account content such as:

- node names
- handles
- bios from X
- roles pulled from source data

These remain source-language content.

## Toggle Placement

Add a compact language switcher in the upper-right area of the app, visually aligned with existing floating controls.

Behavior:

- shows `中文` and `EN`
- current selection is visually highlighted
- switching updates the page immediately

## Error Handling

- unknown locale values fall back to `zh-CN`
- missing translation keys fall back to English, then the key name
- localStorage failures should not break rendering

## Testing Strategy

Add tests for:

- locale normalization
- initial locale resolution from storage
- fallback behavior when translation key is missing
- translator returns Chinese by default

UI rendering will be verified by production build plus focused manual inspection.
