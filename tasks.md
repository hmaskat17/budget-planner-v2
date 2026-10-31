# Tasks

Persistent task tracking, organized by phase. Phase goals, architecture and structure are in [plan.md](./plan.md).
Mark tasks `[x]` when done. Unsure ideas go in [Future / undecided](#future--undecided).

## Phase 0 - Validate the technical direction
- [x] Mobile: Use NativeScript Core with TypeScript/XML for the initial Android app; spike to verify workspace compatibility and Android workflow (see [findings](./docs/phase-0-findings.md)).
- [x] Mobile: Target Android only for the initial release; defer iOS.
- [x] Architecture: Confirm package boundaries and how web and NativeScript apps consume the shared TypeScript domain package.

## Phase 1 - Refactoring project structure
- [x] Configure an npm workspaces monorepo with separate web and mobile apps and a shared core package (mobile is an empty folder only).
- [x] Domain: Extract shared models, budget calculations, and validation into UI-independent TypeScript modules.
- [x] Domain: Add Vitest unit tests alongside the extracted rules, including settlement and edge cases.
- [x] Web: Add and configure Vite and TypeScript; migrate the existing JavaScript and remove logic already in the domain layer.
- [x] Web: Add Lit and migrate the current UI (@lit/context for shared web state, @lit/task for async if needed).

## Phase 2 - Product design decisions
- [x] Web: Explore 3-4 low-fidelity layout directions, choose one against usability goals, then implement the redesign.

## Phase 3 - Additional web functionality
- [x] Web: Add Cypress end-to-end tests for the critical budgeting workflows.
- [x] Web: Add other contribution types (see specs.md > Contributions methods); default is proportional.
- [x] Web: Add a summary view for the key household totals, reusing domain calculations.
- [x] Web: Add selectable color schemes and light/dark modes. Each color scheme will have it's own light and dark modes. Create 3-5 schemes.
- [x] Web: Add English, Finnish and Swedish localization, with browser-based defaults and user-selectable currency (display only, no conversion) and number format.
- [ ] Web: Translate core validation issue messages once they are surfaced in the UI (e.g. import/export).
- [ ] Web/Domain: Add export/import using a versioned data format and shared validation; keep storage and file interactions in platform-specific adapters.

## Phase 4 - Web product review
- [ ] Product: Review the current budget experience and logic for web. Prioritize findings and agree on which product changes are in scope before implementation.

## Phase 5 - Build the mobile app
- [ ] Mobile: Explore 3-4 low-fidelity layout directions, choose one against usability goals, then implement the redesign.
- [ ] Mobile: Implement the Android app with NativeScript Core and reuse the shared domain package.
- [ ] Mobile: Add Android persistence and test the core mobile workflows on Android.

## Phase 6 - Cross-platform review
- [ ] Review the current state of the web and mobile apps: behavior and UX consistency, shared-core gaps, test coverage, performance and accessibility.
- [ ] Prioritize findings and agree on which fixes are in scope.
- [ ] Implement the agreed fixes.

## Phase 7 - Deployment and production
- [ ] Set up build and release pipelines (CI) for web and Android.
- [ ] Choose and configure web hosting.
- [ ] Prepare Android distribution (signing, store listing or direct install).
- [ ] Add environment configuration, error reporting and monitoring as needed.
- [ ] Review privacy and data handling (local-only data, export/import).
- [ ] Add a CHANGELOG.md and release documentation.

## Phase 8 - Maintenance and future plans
- [ ] Set up routine dependency updates and security checks.
- [ ] Triage bugs and user feedback.
- [ ] Revisit the future / undecided list below and promote chosen items into a phase.

## Future / undecided
Ideas we are not sure about and will come back to.

- [ ] Web: Custom themes. Let the user set the app theme by importing a text file (token-level styling only). Builds on color schemes.
  - [ ] Core: Add a pure, unit-tested theme parser/validator (`packages/core`) for a versioned JSON format (`version`, `name`, `colors`, `style`). Whitelist keys, validate values (e.g. `CSS.supports()`), and reject `url(`, `;` and `{`.
  - [ ] Web: Replace remaining hardcoded colors (e.g. in `shared-styles.ts` and `budget-planner-app.ts`) with tokens, including per-section accents.
  - [ ] Web: Apply the theme via custom properties on `:root`, persist it via the storage adapter separately from budget data, and apply it before first render.
  - [ ] Web: Add file import UI with error messages and an always-reachable "Reset to default"; consider a contrast warning.
  - [ ] Web: Add a Cypress test for importing and resetting a theme.
  - [ ] Mobile: Reuse the core parser; applying themes in the Android app is out of scope until the web version is done.
- [ ] Future: Reassess iOS support after the Android app is established.
