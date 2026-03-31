// Cypress E2E: Role-based dashboard and core workflow smoke test
// This test logs in as each role and checks for dashboard load and basic error-free navigation.

const users = [
  { email: 'admin@alderwell.com', password: 'password123', dashboard: 'Admin Workspace' },
  { email: 'marketing@alderwell.com', password: 'password123', dashboard: 'Marketing & Sales Workspace' },
  { email: 'compliance@alderwell.com', password: 'password123', dashboard: 'Compliance Reviewer Workspace' },
  { email: 'campaign@alderwell.com', password: 'password123', dashboard: 'Campaign Management Workspace' },
  { email: 'liaison@alderwell.com', password: 'password123', dashboard: 'Liaison Officer Workspace' },
];

describe('Role-based dashboard smoke test', () => {
  users.forEach((user) => {
    it(`should log in and load dashboard for ${user.email}`, () => {
      cy.visit('/login');
      cy.get('input[name=email]').type(user.email);
      cy.get('input[name=password]').type(user.password);
      cy.get('button[type=submit]').click();

      // Wait for dashboard to load
      cy.contains(user.dashboard, { timeout: 10000 }).should('exist');

      // Check for no visible error messages
      cy.get('body').should('not.contain.text', 'Error');
      cy.get('body').should('not.contain.text', 'not found');
      cy.get('body').should('not.contain.text', 'permission');

      // Logout
      cy.contains('Logout').click();
      cy.contains('Login').should('exist');
    });
  });
});
