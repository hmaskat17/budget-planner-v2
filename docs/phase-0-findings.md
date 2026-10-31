# Phase 0 findings

Outcome of validating the technical direction. See [plan.md](../plan.md) for the resulting architecture.

- Spike: `../budget-planner-v2-android` (separate folder, kept outside this repo for now) builds, installs and renders on a physical Android 16 device with `npm run android`. Requirements: JDK 21 (Gradle 8.14.3 fails on JDK 25) and `@nativescript/android` as a devDependency; the blank template did not include it, and the CLI reported the runtime version as `null` without it.
- Shared-core boundary (extracted in Phase 1):
  - Into `packages/core`: types in `models.js`; person rules (1-2 persons, at least one, ids, names) from `person-store.js`; income, expense and asset totals with settlement-free base totals (`baseTotal` logic in `total-aggregator.js`); remaining balance per person (income - personal expenses - shared expenses paid, from `budget-savings.js`); savings percentage allocation and shared-savings pooling (`budget-savings.js`); proportional contribution, share, paid and balance-to-settle plus settlement application (`budget-proportional-contributions.js`); scenario and entry handling and `formatAmount`/`uid` from `scenario-budget.js`.
  - Stays in each app: custom elements, shadow DOM styles and rendering; DOM events (`income-changed` etc.) and `document.querySelector` lookups, which currently act as the data layer; `localStorage` access in `person-store.js` and `budget-savings.js`, to become a storage adapter.
  - Main refactor risk: components read each other's state through the DOM (e.g. savings and proportional contributions query `budget-income` elements). The core must own this state and expose pure functions that take data in and return results.
