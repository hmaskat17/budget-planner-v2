import { defineConfig } from 'cypress';

export default defineConfig({
  screenshotOnRunFailure: false,
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false
  }
});
