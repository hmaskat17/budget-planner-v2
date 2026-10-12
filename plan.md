# Plan

- Domain: TypeScript
- Web: Vite + Lit
- Mobile: NativeScript

## Todo

### Phase 0 - Validate the technical direction
- DONE! Mobile: Use NativeScript Core with TypeScript/XML for the initial Android app. Create a small spike to verify workspace compatibility and the Android development workflow.
- DONE! Mobile: Target Android only for the initial release; defer iOS support until a later phase.
- DONE! Architecture: Confirm package boundaries and how the web and NativeScript apps will consume the shared TypeScript domain package.

#### Phase 0 findings

- Spike: `../budget-planner-v2-android` (separate folder, kept outside this repo for now) builds, installs and renders on a physical Android 16 device with `npm run android`. Requirements: JDK 21 (Gradle 8.14.3 fails on JDK 25) and `@nativescript/android` as a devDependency; the blank template did not include it, and the CLI reported the runtime version as `null` without it.
- Shared-core boundary (to extract in Phase 1):
  - Into `packages/core`: types in `models.js`; person rules (1-2 persons, at least one, ids, names) from `person-store.js`; income, expense and asset totals with settlement-free base totals (`baseTotal` logic in `total-aggregator.js`); remaining balance per person (income - personal expenses - shared expenses paid, from `budget-savings.js`); savings percentage allocation and shared-savings pooling (`budget-savings.js`); proportional contribution, share, paid and balance-to-settle plus settlement application (`budget-proportional-contributions.js`); scenario and entry handling and `formatAmount`/`uid` from `scenario-budget.js`.
  - Stays in each app: custom elements, shadow DOM styles and rendering; DOM events (`income-changed` etc.) and `document.querySelector` lookups, which currently act as the data layer; `localStorage` access in `person-store.js` and `budget-savings.js`, to become a storage adapter.
  - Main refactor risk: components read each other's state through the DOM (e.g. savings and proportional contributions query `budget-income` elements). The core must own this state and expose pure functions that take data in and return results.

### Phase 1 - Refactoring project structure
- DONE! Configure an npm workspaces monorepo with separate web and mobile apps and a shared core domain package. Important! Do not yet implement the NativeScript mobile app, only create the empty folder.
- DONE! Domain: Extract shared models, budget calculations, and validation into UI-independent TypeScript modules.
- DONE! Domain: Add Vitest unit tests alongside the extracted rules, including settlement and edge cases.
- Web: Add and configure Vite and TypeScript. Migrate the existing JavaScript incrementally, using current JSDoc types as a guide.
- Web: Add Lit and migrate the current UI incrementally. Use Lit templates and styles for presentation; use @lit/context for state shared within the web component tree, not as the cross-platform domain layer.

### Phase 2 - Product design decisions
- Product: Review the current budget experience and logic. Prioritize findings and agree on which product changes are in scope before implementation.
- Web: Explore 3-4 low-fidelity layout directions, choose one against usability goals, then implement the redesign.

### Phase 3 - Additional web functionality
- Web: Add Cypress end-to-end tests for the critical budgeting workflows. Keep domain unit tests in the core package; add web component tests where they provide useful coverage.
- Web: Add a summary view for the key household totals, reusing domain calculations where appropriate.
- Web: Add selectable color schemes and light/dark modes.
- Web: Add English and Finnish localization, including locale-aware number and currency formatting.
- Web/Domain: Add export/import using a versioned data format and shared validation; keep storage and file interactions in platform-specific adapters.

### Phase 4 - Build the mobile app
- Mobile: Implement the Android app with NativeScript Core and reuse the shared domain package.
- Mobile: Add Android persistence and test the core mobile workflows on Android.
- Future: Reassess iOS support after the Android app is established.

## Project structure example

Illustrative only. Final NativeScript app files and directories should follow the NativeScript Core template.

budget-planner/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── adapters/
│   │   │   └── main.ts
│   │   └── vite.config.ts
│   │
│   └── mobile/
│       ├── app/
│       │   ├── screens/
│       │   ├── components/
│       │   ├── navigation/
│       │   └── adapters/
│       └── package.json
│
├── packages/
│   └── core/
│       └── src/
│           └── domain/
│               ├── models/
│               └── rules/
│
├── package.json
└── tsconfig.base.json