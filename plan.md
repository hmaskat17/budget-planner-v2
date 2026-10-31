# Plan

Overall requirements, architecture and phases. Task status is tracked in [tasks.md](./tasks.md); detailed requirements are in [specs.md](./specs.md); Phase 0 research is in [docs/phase-0-findings.md](./docs/phase-0-findings.md).

## Tech stack
- Domain: TypeScript in `packages/core`, unit tested with Vitest
- Web: Vite + Lit (`@lit/context` for shared UI state, `@lit/task` for async data), Cypress for end-to-end tests
- Mobile: NativeScript Core (TypeScript/XML), Android only for the initial release

## Architecture
- npm workspaces monorepo (`apps/*`, `packages/*`).
- `packages/core` (`@budget-planner/core`) holds UI-independent models, calculations, settlement and contribution rules, scenarios, summaries and validation as pure functions that take data in and return results. It is consumed as TypeScript source via its `exports` entry (`src/index.ts`).
- Each app owns rendering, UI events and platform adapters (e.g. `localStorage` on web).
- State is owned by the core and shared through context; components must not read each other's state through the DOM.

## Current structure
```
budget-planner-v2/
├── apps/
│   ├── web/                     # @budget-planner/web (Vite + Lit)
│   │   ├── src/
│   │   │   ├── adapters/        # platform adapters (local-storage-adapter.ts, locale-preference.ts)
│   │   │   ├── i18n/            # en/fi/sv dictionaries, t(), money(), locale detection (add a language: new dictionary typed as Messages + register in locales.ts)
│   │   │   ├── components/      # Lit custom elements (budget-*, person-editor, scenario-budget, locale-settings)
│   │   │   ├── context/         # @lit/context budget state
│   │   │   ├── dev/             # sample data
│   │   │   ├── ui/              # shared styles and icons
│   │   │   ├── main.ts
│   │   │   └── styles.css
│   │   ├── cypress/e2e/         # end-to-end tests (budgeting.cy.ts)
│   │   ├── cypress.config.ts
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   └── mobile/                  # empty; NativeScript app comes in Phase 5
├── packages/
│   └── core/                    # @budget-planner/core
│       └── src/
│           ├── domain/          # models, calculations, settlements, summary, scenarios,
│           │                    # persons, validation, utils (+ *.test.ts next to the code)
│           └── index.ts         # public API
├── docs/                        # research notes (phase-0-findings.md)
├── plan.md  tasks.md  specs.md
└── package.json                 # workspaces and root scripts
```
The NativeScript app files will follow the NativeScript Core template when created.

## Testing
- Unit: Vitest, run from the root with `npm test` (`npm run test:watch` for watch mode). Test files live beside the code as `*.test.ts`, currently in `packages/core`.
- End-to-end: Cypress for the web app, run with `npm run test:e2e` (starts Vite, then runs `cypress run`). Specs are in `apps/web/cypress/e2e`.
- Type checking: `npm run typecheck` in each workspace.
- Business rules belong in core with unit tests; web tests cover critical workflows and components where useful.

## Phases
- **Phase 0 - Validate the technical direction**: Prove that NativeScript works for an Android app in this workspace and decide the package boundaries between the apps and the shared core.
- **Phase 1 - Project structure**: Turn the original JavaScript prototype into a TypeScript monorepo with a tested shared core and a Vite + Lit web app.
- **Phase 2 - Product design**: Explore layout directions for the web app, choose one against usability goals and implement the redesign.
- **Phase 3 - Additional web functionality**: Grow the web app from a working prototype into a complete product: more contribution methods, summaries, theming, localization (English, Finnish and Swedish; selectable currency and number format), and data export/import, backed by end-to-end tests.
- **Phase 4 - Web product review**: Review the web budget experience and logic, prioritize findings and agree on which changes are in scope before implementing them.
- **Phase 5 - Mobile app**: Build the Android app with NativeScript, reusing the shared core. Includes layout design, local persistence and testing the main workflows on a device.
- **Phase 6 - Cross-platform review**: Review the current state of both the web and mobile apps together: consistency of behavior and UX, shared-core gaps, test coverage, performance and accessibility. Agree on fixes before release work starts.
- **Phase 7 - Deployment and production**: Prepare for real users: build and release pipelines, web hosting, Android distribution, environment configuration, monitoring, privacy and data-handling checks, and release documentation. A changelog is added here.
- **Phase 8 - Maintenance and future plans**: Keep the product healthy after release (dependency updates, bug fixes, user feedback) and decide which ideas from the future list in tasks.md to pursue, including iOS support.
