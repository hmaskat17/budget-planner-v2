# Plan

- Domain: TypeScript
- Web: Vite + Lit
- Mobile: NativeScript

## Todo

### Phase 1 - Refactoring project structure
- Configure project structure. Use a monorepo managed by npm workspaces. We want UI presentation layers for web and mobile and a core domain layer.
- Web: Add and configure Vite.
- Web: Add TypeScript and migrate from JavaScript to TypeScript.
- Domain: Move core shared logic to domain layer. 
- Web: Add Lit and migrate current web UI to use Lit for components, styling and state management. Use @lit/context for global state.

### Phase 2 - Product design decisions
- Product: Review current state of budget app and logic. Does the app provide a good budget planner experience? Are there potential missing features or improvements? Make necessary changes.
- Web: Redesign the UI and layout. Keep UI clean and minimilistic. Consider drafting 3-4 different designs before implementing. Make the changes.

### Phase 3 - Additional web functionality
- Web: Add unit tests with Vitest (unless we can use a shared test library for web and mobile)
- Web: Add end-to-end tests with Cypress.
- Web/Domain: Add a summary component to list common totals from each component, so that you can easily get a budget overview.
- Web/Domain: Add selectable color schemes and light/dark modes.
- Web/Domain: Add english and finnish localizations.
- Web/Domain: Add export/import functions for app data persistance.

### Phase 4 - Adding mobile view
- Mobile: Plan the mobile support.

## Project structure example

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