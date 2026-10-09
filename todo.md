Backlog 

Environment
- Convert codebase to TypeScript
- Convert the codebase to use Vite
- Add and use the lit library for building components
- Add styled-components library for styling components
- Add unit tests with Vitest and end-to-end tests with Cypress, then keep tests up to date

UI and functionality
- Add a component (or add to the household component) to list most common totals from each component, so that you can easily get a budget overview
- Redesign the UI and layout. Keep UI clean and minimilistic. Consider drafting 3-4 different designs before implementing.
- Add light/dark modes.
- Review current state of budget logic. Does the app provide a good budget planner experience? Are there potential missing features?
- Add english and finnish localization/translation

Bugs and improvements
- When adding what is owed to income or expenses, the household totals update when they should not, since the total household pot is still the same - the settlements are just moved around and should affect personal incomes/expenses only.
- The proportional contributions "add to" actions should probably be combined into one "add to" and "remove from" action for both persons. Also the amounts added into the other components should not be editable.