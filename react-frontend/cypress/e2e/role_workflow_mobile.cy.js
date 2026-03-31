// Cypress E2E: Deep workflow and mobile responsiveness tests

const users = [
  { email: 'admin@alderwell.com', password: 'password123', dashboard: 'Admin Workspace' },
  { email: 'marketing@alderwell.com', password: 'password123', dashboard: 'Marketing & Sales Workspace' },
  { email: 'compliance@alderwell.com', password: 'password123', dashboard: 'Compliance Reviewer Workspace' },
  { email: 'campaign@alderwell.com', password: 'password123', dashboard: 'Campaign Management Workspace' },
  { email: 'liaison@alderwell.com', password: 'password123', dashboard: 'Liaison Officer Workspace' },
];

describe('Deep workflow and mobile UI tests', () => {
  users.forEach((user) => {
    it(`should complete a core workflow for ${user.email}`, () => {
      cy.viewport(1280, 800); // Desktop
      cy.visit('/login');
      cy.get('input[name=email]').type(user.email);
      cy.get('input[name=password]').type(user.password);
      cy.get('button[type=submit]').click();
      cy.contains(user.dashboard, { timeout: 10000 }).should('exist');

      // Example: Try to navigate to each main tab/section
      cy.get('nav').within(() => {
        cy.contains('Dashboard').click({ force: true });
        cy.contains('Tasks').click({ force: true });
        cy.contains('Materials').click({ force: true });
      });

      // Check for no visible error messages
      cy.get('body').should('not.contain.text', 'Error');
      cy.get('body').should('not.contain.text', 'not found');
      cy.get('body').should('not.contain.text', 'permission');

      // Mobile responsiveness test
      cy.viewport('iphone-x');
      cy.reload();
      cy.contains(user.dashboard, { timeout: 10000 }).should('exist');

      // Check for horizontal scroll (should not exist)
      cy.window().then((win) => {
        const doc = win.document.documentElement;
        expect(doc.scrollWidth).to.be.lte(doc.clientWidth + 1); // allow 1px fudge
      });

      // Check that main content is visible and not cut off
      cy.get('body').should('be.visible');
      cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

      // Logout
      cy.contains('Logout').click({ force: true });
      cy.contains('Login').should('exist');
    });
  });
});
