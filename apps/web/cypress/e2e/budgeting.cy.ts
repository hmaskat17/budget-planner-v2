const app = () => cy.get('budget-planner-app').shadow();

const component = (selector: string, index = 0) => app().find(selector).eq(index).shadow();

describe('critical budgeting workflows', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(window) {
        window.localStorage.clear();
      }
    });
    app().find('#household-section').should('be.visible');
  });

  it('calculates balances and applies/removes proportional settlements', () => {
    app().find('#add-person').click();
    app().find('person-editor').eq(0).shadow().find('input[aria-label="Person name"]')
      .clear().type('Alex');
    app().find('person-editor').eq(1).shadow().find('input[aria-label="Person name"]')
      .clear().type('Sam');

    component('budget-income', 0).find('input[placeholder="Income source"]').clear().type('Salary');
    component('budget-income', 0).find('input[placeholder="Amount"]').clear().type('3000');
    component('budget-income', 1).find('input[placeholder="Income source"]').clear().type('Salary');
    component('budget-income', 1).find('input[placeholder="Amount"]').clear().type('1500');

    component('budget-personal-expense', 0)
      .find('input[placeholder="Expense source"]').clear().type('Phone');
    component('budget-personal-expense', 0).find('input[placeholder="Amount"]').clear().type('500');
    component('budget-personal-expense', 1)
      .find('input[placeholder="Expense source"]').clear().type('Transit');
    component('budget-personal-expense', 1).find('input[placeholder="Amount"]').clear().type('200');

    component('budget-shared-expense').find('.add-entry-button').click();
    component('budget-shared-expense').find('input[placeholder="Expense source"]').type('Rent');
    component('budget-shared-expense').find('input[placeholder="Amount"]').clear().type('900');

    app().find('#household-total-amount').should('have.text', '4500.00 €');
    app().find('#household-expense-total-amount').should('have.text', '700.00 €');
    component('budget-shared-expense').find('.household-total .total-amount')
      .should('have.text', '900.00 €');

    component('budget-remaining-balance').should('contain.text', '1600.00 €')
      .and('contain.text', '1300.00 €')
      .and('contain.text', '2900.00 €');

    const summary = () => app().find('budget-summary').shadow();
    summary().find('#summary-income-total').should('have.text', '4500.00 €');
    summary().find('#summary-networth-total').should('have.text', '4500.00 €');
    summary().find('#summary-expenses-total').should('have.text', '1600.00 €');
    summary().find('#summary-savings-total').should('have.text', '0.00 €');
    summary().find('#summary-contribution-method').should('have.text', 'Proportional');
    summary().find('#summary-remaining-before').should('have.text', '2900.00 €');
    summary().find('#summary-remaining-after').should('have.text', '2900.00 €');
    summary().find('#summary-savings h3 a').click();
    app().find('#savings-section').should('be.visible');

    component('budget-contributions').find('.person-card').eq(0)
      .should('contain.text', '66.67 %')
      .and('contain.text', '600.00 €')
      .and('contain.text', 'Owed 300.00 €');
    component('budget-contributions').find('.person-card').eq(1)
      .should('contain.text', '33.33 %')
      .and('contain.text', '300.00 €')
      .and('contain.text', 'Owes 300.00 €');

    component('budget-contributions').find('.toggle-settlement').click();
    component('budget-contributions').find('.toggle-settlement')
      .should('contain.text', 'Remove settlement from income and personal expenses');
    component('budget-income', 0).find('.entry-row.settlement').should('exist');
    component('budget-personal-expense', 1).find('.entry-row.settlement').should('exist');
    app().find('#household-total-amount').should('have.text', '4500.00 €');
    app().find('budget-summary').shadow().find('#summary-income-total').should('have.text', '4500.00 €');

    component('budget-contributions').find('.toggle-settlement').click();
    component('budget-contributions').find('.person-card').eq(0)
      .should('contain.text', 'Owed 300.00 €');
    component('budget-income', 0).find('.entry-row.settlement').should('not.exist');
    component('budget-personal-expense', 1).find('.entry-row.settlement').should('not.exist');
  });

  it('switches between income scenarios and restores saved data after reload', () => {
    component('budget-income').find('input[placeholder="Income source"]').type('Salary');
    component('budget-income').find('input[placeholder="Amount"]').clear().type('3000');

    component('budget-income').find('button[aria-label="New scenario"]').click();
    component('budget-income').find('.scenario-chip-rename').clear().type('Raise{enter}');
    component('budget-income').find('input[placeholder="Amount"]').clear().type('4000');
    app().find('#household-total-amount').should('have.text', '4000.00 €');

    component('budget-income').find('.scenario-chip-label').contains('Default').click();
    component('budget-income').find('input[placeholder="Amount"]').should('have.value', '3000');
    app().find('#household-total-amount').should('have.text', '3000.00 €');

    cy.reload();
    app().find('#household-section').should('be.visible');
    component('budget-income').find('.scenario-chip-label').should('contain.text', 'Default');
    component('budget-income').find('.scenario-chip-label').should('contain.text', 'Raise');
    component('budget-income').find('input[placeholder="Amount"]').should('have.value', '3000');
    app().find('#household-total-amount').should('have.text', '3000.00 €');
  });

  it('switches contribution methods, edits a custom split, and persists the selection', () => {
    app().find('#add-person').click();
    component('budget-income', 0).find('input[placeholder="Income source"]').type('Salary');
    component('budget-income', 0).find('input[placeholder="Amount"]').clear().type('3000');
    component('budget-income', 1).find('input[placeholder="Income source"]').type('Salary');
    component('budget-income', 1).find('input[placeholder="Amount"]').clear().type('1500');
    component('budget-shared-expense').find('.add-entry-button').click();
    component('budget-shared-expense').find('input[placeholder="Expense source"]').type('Rent');
    component('budget-shared-expense').find('input[placeholder="Amount"]').clear().type('900');

    component('budget-contributions').find('#contribution-method').should('have.value', 'proportional');
    component('budget-contributions').find('.toggle-settlement').click();
    component('budget-income', 0).find('.entry-row.settlement').should('exist');
    component('budget-personal-expense', 1).find('.entry-row.settlement').should('exist');
    component('budget-contributions').find('#contribution-method').select('equal');
    component('budget-income', 0).find('.entry-row.settlement').should('not.exist');
    component('budget-personal-expense', 1).find('.entry-row.settlement').should('not.exist');
    component('budget-contributions').find('.person-card').eq(0).should('contain.text', '450.00 €');
    component('budget-contributions').find('#contribution-method').select('equal-leftover');
    component('budget-contributions').find('.person-card').eq(0).should('contain.text', '1200.00 €');
    component('budget-contributions').find('#contribution-method').select('custom');
    component('budget-contributions').find('.person-card').eq(0).should('contain.text', 'Custom contribution')
      .and('not.contain.text', 'Custom split');
    component('budget-contributions').find('.person-card').eq(0).find('input[aria-label="Person 1 custom contribution percentage"]')
      .should('have.length', 1);
    component('budget-contributions').find('input[aria-label="Person 1 custom contribution percentage"]')
      .clear().type('70.01').blur();
    component('budget-contributions').find('.person-card').eq(0).should('contain.text', '630.09 €');
    component('budget-contributions').find('.person-card').eq(1).should('contain.text', '269.91 €');

    component('budget-contributions').find('#contribution-method').select('fully-pooled');
    component('budget-contributions').find('.pooled-note').should('be.visible');
    component('budget-contributions').find('.toggle-settlement').should('not.exist');
    cy.reload();
    component('budget-contributions').find('#contribution-method').should('have.value', 'fully-pooled');
  });

  it('switches color schemes and light/dark mode and persists the preference', () => {
    app().find('#color-scheme').select('forest');
    app().find('#color-mode').click();
    cy.document().its('documentElement')
      .should('have.attr', 'data-color-scheme', 'forest')
      .and('have.attr', 'data-color-mode', 'dark');
    cy.window().its('localStorage')
      .invoke('getItem', 'budget-planner-theme-preference')
      .should('equal', JSON.stringify({ colorScheme: 'forest', colorMode: 'dark' }));

    cy.reload();
    cy.window().its('localStorage')
      .invoke('getItem', 'budget-planner-theme-preference')
      .should('equal', JSON.stringify({ colorScheme: 'forest', colorMode: 'dark' }));
    cy.document().its('documentElement')
      .should('have.attr', 'data-color-scheme', 'forest')
      .and('have.attr', 'data-color-mode', 'dark');
    app().find('#color-scheme').should('have.value', 'forest');
    app().find('#color-mode').should('have.attr', 'aria-checked', 'true');
  });

  it('fills random test data from the temporary header button', () => {
    app().find('#dev-fill-data').click();
    app().find('budget-summary').shadow().find('#summary-income-total')
      .invoke('text').should('not.equal', '0.00 €');
    app().find('person-editor').its('length').should('be.within', 1, 2);
  });
});
