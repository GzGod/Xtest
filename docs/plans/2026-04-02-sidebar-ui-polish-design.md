# Sidebar UI Polish Design

## Goal

Polish the left sidebar on mobile without changing the underlying graph interactions.

This pass keeps the dark, technical aesthetic, but upgrades the visible quality of:

- the sidebar shell
- the title and search area
- the ranked list item layout
- the shared-following add/select control
- the sidebar collapse toggle

The graph canvas, methodology modal, details card, and shared-following results panel stay functionally unchanged.

## Problems in the Current UI

The current mobile sidebar works, but it feels more like a utility panel than a polished product surface.

Main issues:

- the sidebar is visually flat, with too much uninterrupted black
- the header lacks hierarchy and brand presence
- the search bar feels heavy and generic
- list items are dense and cramped, with weak separation between name, handle, role, and follower count
- the `+` / `check` controls feel inconsistent and oversized in an awkward way
- the collapse button looks detached from the rest of the surface design

## Chosen Direction

Keep the dark sci-fi / data-product tone, but introduce a more refined “ranked card stream” treatment.

### Visual principles

- softer glass-like depth instead of flat black slabs
- stronger hierarchy between title, metadata, row title, row secondary text, and metrics
- more breathing room between rows
- a single consistent visual system for add / selected controls
- subtle gold accent only where shared-following selection matters

## Sidebar Shell

The sidebar becomes a layered dark panel rather than a single opaque rectangle.

Changes:

- richer background using deep navy-to-black gradients
- softened border and shadow to separate it from the graph canvas
- a faint inner highlight to create depth
- slightly more intentional edge spacing on mobile

## Header

The title area should feel like the top of a premium data product.

Changes:

- stronger typography scale for the product title
- cleaner date treatment
- subtle decorative gradient in the header background
- tighter visual grouping between title and metadata

## Search

The search input becomes lighter and more refined.

Changes:

- slightly slimmer geometry
- softer border and better contrast
- more integrated icon placement
- less “default dashboard form field” feeling

## Ranked List Items

Each list item becomes a compact card instead of a plain row.

Changes:

- consistent minimum height per row for visual rhythm
- a cleaner rank badge with more deliberate styling
- stronger emphasis on the account name
- handle moved into a secondary layer
- role kept readable without competing with the name
- follower count presented as a small metric chip instead of a stray number

## Shared-Following Toggle

The current right-side control is replaced by a consistent “selection capsule” system.

### Default state

- fixed size
- deep neutral background
- subtle border
- centered plus icon with consistent stroke weight

### Hover state

- slight brightness lift
- better border clarity
- stronger icon contrast

### Selected state

- same geometry as default
- dark gold surface instead of a flat yellow block
- gold border and icon
- soft inset highlight for a premium feel

This keeps the button clearly interactive while making it feel like part of the product rather than a utility toggle.

## Mobile Layout

This pass only adjusts the left-side visible region.

Changes:

- better spacing around the panel edges
- better coordination between the sidebar shell and the collapse control
- row density tuned for narrow screens so the list feels scannable rather than cramped

## Testing Strategy

Because this is primarily visual work, coverage will focus on the new appearance helper contract that drives the shared-following toggle states.

Tests should verify:

- selected and unselected toggle states share the same geometry
- default state uses a plus icon
- selected state uses a check icon
- selected state exposes the gold-accented visual treatment

Final verification will use:

- `npm test`
- `npm run build:railway`

