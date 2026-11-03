const app = () => cy.get('budget-planner-app').shadow();
const backup = () => app().find('backup-settings').shadow();
const REGIONAL_PREFERENCE = { language: 'en', currency: 'EUR', numberLocale: 'en-US' };

const scenarioState = { activeScenarioId: 's1', scenarios: [{ id: 's1', name: 'Default', entries: [] }] };

const validBackup = {
  format: 'budget-planner-backup',
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  data: {
    people: [{ id: 'person-1', name: 'Imported' }],
    incomeByPerson: { 'person-1': scenarioState },
    personalExpensesByPerson: { 'person-1': scenarioState },
    sharedExpenses: scenarioState,
    assetsByPerson: { 'person-1': [] },
    personalSavingsByPerson: {},
    sharedSavings: { items: [] },
    contributionSettings: { method: 'proportional', customPercentByPerson: { 'person-1': 100 } }
  }
};

describe('export and import', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(window) {
        window.localStorage.clear();
        window.localStorage.setItem('budget-planner-locale-preference', JSON.stringify(REGIONAL_PREFERENCE));
      }
    });
    app().find('#household-section').should('be.visible');
    backup().find('#backup-toggle').click();
  });

  it('exports the budget data as a versioned file', () => {
    backup().find('#export-data').click();
    cy.readFile('cypress/downloads/budget-planner-backup-' + new Date().toISOString().slice(0, 10) + '.json')
      .then((text) => {
        const file = typeof text === 'string' ? JSON.parse(text) : text;
        expect(file.format).to.equal('budget-planner-backup');
        expect(file.version).to.equal(1);
        expect(file.data.people).to.have.length(1);
      });
  });

  it('downloads the budget report as CSV and PDF', () => {
    const day = new Date().toISOString().slice(0, 10);
    backup().find('#export-report-csv').click();
    cy.readFile(`cypress/downloads/budget-planner-report-${day}.csv`).should('contain', 'Budget report');
    backup().find('#export-report-pdf').click();
    cy.readFile(`cypress/downloads/budget-planner-report-${day}.pdf`, 'latin1').should('match', /^%PDF-1\.4/);
  });

  it('imports immediately without confirmation and keeps data after reload', () => {
    backup().find('#import-file').selectFile(
      { contents: Cypress.Buffer.from(JSON.stringify(validBackup)), fileName: 'backup.json' },
      { force: true }
    );
    backup().find('.success').should('contain.text', 'Backup restored');
    backup().find('#backup-toggle').click();
    backup().find('#backup-toggle').click();
    backup().find('.success').should('not.exist');
    app().find('person-editor').eq(0).shadow().find('input[aria-label="Person name"]')
      .should('have.value', 'Imported');
    cy.reload();
    app().find('person-editor').eq(0).shadow().find('input[aria-label="Person name"]')
      .should('have.value', 'Imported');
  });

  it('shows an error and leaves data unchanged for an invalid file', () => {
    backup().find('#import-file').selectFile(
      { contents: Cypress.Buffer.from('{not json'), fileName: 'bad.json' },
      { force: true }
    );
    backup().find('.import-errors').should('contain.text', 'not valid JSON');
    backup().find('.export-errors').should('not.exist');
    app().find('person-editor').eq(0).shadow().find('input[aria-label="Person name"]')
      .should('not.have.value', 'Imported');
  });
});
