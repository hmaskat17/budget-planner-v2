# Plan

- Domain: TypeScript
- Web: Vite + Lit
- Mobile: NativeScript

## Todo

### Phase 0 - Validate the technical direction
- Mobile: Use NativeScript Core with TypeScript/XML for the initial Android app. Create a small spike to verify workspace compatibility and the Android development workflow.
- Mobile: Target Android only for the initial release; defer iOS support until a later phase.
- Architecture: Confirm package boundaries and how the web and NativeScript apps will consume the shared TypeScript domain package.

### Phase 1 - Refactoring project structure
- Configure an npm workspaces monorepo with separate web and mobile apps and a shared core domain package.
- Web: Add and configure Vite and TypeScript. Migrate the existing JavaScript incrementally, using current JSDoc types as a guide.
- Domain: Extract shared models, budget calculations, and validation into UI-independent TypeScript modules.
- Domain: Add Vitest unit tests alongside the extracted rules, including settlement and edge cases.
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