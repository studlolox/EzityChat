---
name: mobile-first-ui
description: "Architecture, heuristics, and refactoring guidelines for converting desktop-first chat and workspace interfaces into mobile-first responsive designs within the EzityChat / LibreChat codebase."
---

# Mobile-First UI Skill

Specialized guide and heuristics for building, auditing, and refactoring the EzityChat / LibreChat web application to follow a **strict mobile-first design system**.

---

## 1. Core Principles & Heuristics

### A. Strict Mobile-First Tailwind Convention
1. **Base Classes Define Mobile (`320px` to `639px`):**
   * Write default CSS/Tailwind utilities for narrow touch screens first.
   * Progressively enhance larger screens with:
     * `sm:` (≥ 640px) — Large phones in landscape, small tablets
     * `md:` (≥ 768px) — Tablets, narrow split screens
     * `lg:` (≥ 1024px) — Laptops, desktop viewports
     * `xl:` (≥ 1280px) — Wide desktops
     * `2xl:` (≥ 1536px) — Ultra-wide displays
2. **Prohibit Desktop-First Antipatterns:**
   * Do NOT use `max-sm:`, `max-md:`, or `max-lg:` override hacks.
   * If a component displays differently on mobile vs. desktop, default to the mobile presentation and apply `md:` for desktop adaptations.

### B. Touch Target Ergonomics & Thumb Zone
1. **44×44px Minimum Hit Area:**
   * Every clickable icon, button, chip, checkbox, or menu item must satisfy a minimum touch target of `44x44px` (or `48x48px` where feasible).
   * For small visible icon glyphs (e.g. 16px–20px), use padding (`p-2.5` to `p-3`) or an invisible tap-target wrapper:
     ```tsx
     // Example accessible touch wrapper
     <button className="relative flex h-8 w-8 items-center justify-center p-0 md:h-7 md:w-7">
       <span className="absolute -inset-1.5 md:hidden" aria-hidden="true" />
       <Icon className="size-4.5" />
     </button>
     ```
2. **The Ergonomic Thumb Zone:**
   * Primary actions (Chat input, Send, Voice Dictation, Add Attachments, Drawer toggle) belong in the lower third of the screen.
   * Secondary or destructive actions (Delete conversation, System settings, Export) belong in top app bars or slide-up action sheets.

### C. Viewport, Safe Area, and Virtual Keyboard Handling
1. **Viewport Meta Configuration:**
   * Require `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />`.
   * Without `viewport-fit=cover`, notched devices and bottom home indicator bars evaluate `env(safe-area-inset-*)` to `0px`.
2. **Dynamic Viewport Height:**
   * Use `100dvh` or `min-h-dvh` instead of `100vh` to avoid browser navigation bar jumpiness on mobile Safari and Chrome.
3. **Safe Area Padding:**
   * Top bar: `pt-[env(safe-area-inset-top)]`.
   * Fixed bottom composer: `pb-[max(0.5rem,env(safe-area-inset-bottom))]`.
4. **Virtual Keyboard Coordination:**
   * Consume `--visual-viewport-height` (provided by `useVirtualKeyboard`) to ensure the composer and latest message stay anchored without being hidden behind on-screen keyboards.

### D. Touch Interactions vs. Hover Dependencies
1. **Eliminate Hover Exclusivity:**
   * Message action buttons (Copy, Edit, Regenerate, Fork, Continue) must not rely on `opacity-0 group-hover:opacity-100`.
   * *Mobile strategy:* Provide persistent action rows at reduced opacity (e.g., `opacity-70 active:opacity-100`), or tap-to-reveal / long-press context menus.
2. **Horizontal Overflow Containment:**
   * Markdown code snippets, LaTeX formulas, and data tables must have `min-width: 0` on flex ancestors and dedicated horizontal scroll containers:
     ```tsx
     <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
       {/* Code / Table / Math */}
     </div>
     ```

### E. Mobile Design Forks (Sheets vs. Popovers)
1. **Adaptive Surfaces:**
   * Menus, model selectors, and file drawers that render as floating popovers or dropdowns on desktop should adapt to **bottom sheets / swipeable drawers** on mobile viewports (`< md`).
2. **Fullscreen Overlays:**
   * Avoid jarring raw full-screen overlays (such as `fixed inset-0 z-[100]`) without swipe-down-to-dismiss gestures and visible close headers.

---

## 2. LibreChat Architectural Rules (AGENTS.md Compliance)

When applying mobile-first refactoring to EzityChat / LibreChat, you **MUST** follow these repository constraints:
1. **Design Primitives:** Compose existing `@librechat/client` primitives (`Button`, `DropdownPopup`, `Input`, `Dialog`) and their `cva` variants.
2. **Ariakit Over Radix:** Never use Radix `DropdownMenu` for action or sort menus. Use `DropdownPopup` with `Ariakit.MenuButton`.
3. **State Management:**
   * New state must use **Jotai** atoms (`atom` / `atomWithLocalStorage`).
   * App-global shell state must be passed down through props or feature contexts rather than read directly from `~/store`.
4. **Theming & Color Roles:**
   * Use semantic Tailwind tokens (`bg-surface-canvas`, `text-text-primary`, `border-border-light`, `bg-surface-secondary`).
   * Never introduce hard-coded hex colors (`#1a1a1a`), raw palette classes (`bg-gray-800`), or custom CSS outside existing theme boundaries.
5. **Localization:**
   * Wrap all visible user copy in `useLocalize()` or localized helper functions.
6. **Code Quality:**
   * Run import sorter: `node scripts/sort-imports.mts <touched-files>`.
   * Run prettier: `npx prettier --write <touched-files>`.
   * Run ESLint: `npx eslint --fix --config eslint.config.mjs --no-warn-ignored --max-warnings=0 <touched-files>`.
   * Run Typecheck: `npx tsc --noEmit` in touched workspaces.

