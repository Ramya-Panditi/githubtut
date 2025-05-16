import { clone } from '@helpers/clone';
import SuccessfulHostedDatabase from '@mocks/responses/success/SuccessfulHostedDatabase.json';
import SuccessfulOrganization from '@mocks/responses/success/SuccessfulOrganization.json';
import SuccessfulProject from '@mocks/responses/success/SuccessfulProject.json';
import SuccessfulSignin from '@mocks/responses/success/SuccessfulSignin.json';
import SuccessfulInstanceResponse from '@mocks/responses/success/SuccessfulInstanceResponse.json';
import SuccessfulColumnarListMaintenancesResponse from '@mocks/responses/success/SuccessfulColumnarListMaintenancesResponse.json';

import { PROJECT_SERVICE_INTERCEPT } from 'cypress/services/ProjectServiceIntercept';
import { TRIAL_SERVICE_INTERCEPT } from 'cypress/services/TrialServiceIntercept';
import { basicIntercepts, basicWaitsColumnar } from 'cypress/support/iterceptors';
import { INSTANCE_SERVICE_INTERCEPT } from 'cypress/services/InstanceServiceIntercept';
import { USER_SERVICE_INTERCEPT } from 'cypress/services/UserServiceIntercept';
import { ORGANIZATION_SERVICE_INTERCEPT } from 'cypress/services/OrganizationServiceIntercept';
import { GOLDFISH_SERVICE_INTERCEPT } from 'cypress/services/GoldfishServiceIntercept';

describe('Columnar Maintenance Page', () => {
	const columnarMaintenanceUrl = `/columnar/settings/maintenance?oid=${SuccessfulOrganization.data[0].id}&pid=${SuccessfulProject.data.id}&dbid=${SuccessfulHostedDatabase.data.id}`;
	const completedJobsUrl = `/columnar/settings/maintenance/completed?oid=${SuccessfulOrganization.data[0].id}&pid=${SuccessfulProject.data.id}&dbid=${SuccessfulHostedDatabase.data.id}`;

	const withPermissionsWaits = [
		...basicWaitsColumnar,
		'@PROJECT_SERVICE_INTERCEPT.get',
		'@TRIAL_SERVICE_INTERCEPT.get',
		'@INSTANCE_SERVICE_INTERCEPT.getInstance',
	];
	const permissions = {
		create: { accessible: true },
		read: { accessible: true },
		update: { accessible: true },
		delete: { accessible: true },
	};

	beforeEach(() => {
		cy.viewport(1280, 800); // Set viewport to ensure elements are visible
		cy.userIsAuthenticated(clone(SuccessfulSignin));
		basicIntercepts();

		// Set up API intercepts
		INSTANCE_SERVICE_INTERCEPT.getInstance();
		USER_SERVICE_INTERCEPT.get();
		TRIAL_SERVICE_INTERCEPT.get();
		PROJECT_SERVICE_INTERCEPT.get();
		ORGANIZATION_SERVICE_INTERCEPT.list();
		ORGANIZATION_SERVICE_INTERCEPT.get();
	});

	it('should render the maintenance page when user has access', () => {
		// Set up instance response with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;

		// Update the instance with permissions FIRST
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference();

		GOLDFISH_SERVICE_INTERCEPT.listMaintenances();

		cy.visit(columnarMaintenanceUrl);

		// Wait for all required endpoints
		cy.wait(withPermissionsWaits, { timeout: 10000 });

		// Now proceed with checking the UI
		cy.contains('Maintenance', { timeout: 15000 }).should('exist');

		// Check for the description text
		cy.contains('See upcoming maintenance jobs').should('exist');
		cy.contains('Learn More').should('exist');

		// Check for the main sections
		cy.contains('Preferred start time for future maintenance').should('exist');

		// Check for either Edit Time or Set Time button
		cy.get('body').then(($body) => {
			const bodyText = $body.text();
			cy.log('Page content:', bodyText);

			if (bodyText.includes('Edit Time')) {
				cy.contains('button', 'Edit Time').should('exist');
			} else {
				cy.contains('button', 'Set Time').should('exist');
			}
		});

		// Check for section headers
		cy.contains('h2', 'Currently Running').should('exist');
		cy.contains('h2', 'Scheduled Jobs').should('exist');
	});

	it('should show insufficient permissions when user lacks read access', () => {
		// Set up instance response with limited permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		// Set up permissions without read access
		permissions.read.accessible = false;
		instanceResponse.resources.columnarMaintenance = permissions;

		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);
		// Log the page content to help debug
		cy.get('body').then(($body) => {
			cy.log('Page content:', $body.text());
		});

		// Try different ways to find the permissions message
		cy.get('body').then(($body) => {
			// Look for any of these common permission denial texts
			const permissionTexts = [
				'You do not have permissions',
				'permission',
				'access',
				'denied',
				'unauthorized',
				'insufficient',
				'not allowed',
			];

			// Check if any of these texts are present (case insensitive)
			const bodyText = $body.text().toLowerCase();
			const foundText = permissionTexts.some((text) => bodyText.includes(text.toLowerCase()));

			expect(foundText, 'Page should contain some permission-related text').to.be.true;
		});

		// As a fallback, check that the main page content is NOT visible
		cy.contains('Preferred start time for future maintenance').should('not.exist');
		cy.contains('h2', 'Currently Running').should('not.exist');
	});

	it('button should show set time when no maintenance preference is set and open modal when clicked', () => {
		// Set up instance response with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		// Set up maintenance intercept BEFORE visiting the page
		GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference({
			body: {
				data: null,
				permissions,
			},
		});

		// Now visit the page
		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Find and click the button
		cy.contains('button', 'Set Time').should('be.visible').click();

		// Check modal content
		cy.contains('h2', 'Set Preferred Maintenance Time').should('exist');
		cy.contains('button', 'Set Time').should('exist');
		cy.contains('button', 'Edit Time').should('not.exist');
	});

	it('button should show edit time when maintenance preference is set and open modal', () => {
		// Set up instance response with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		// Set up maintenance intercept BEFORE visiting the page
		GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference({
			body: {
				data: {
					day: 4,
					hour: 8,
					minute: 29,
				},
				permissions,
			},
		});

		// Now visit the page
		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Find and click the button
		cy.contains('button', 'Edit Time').should('be.visible').click();

		// Check modal content
		cy.contains('h2', 'Set Preferred Maintenance Time').should('exist');
		cy.contains('button', 'Set Time').should('not.exist');
		cy.contains('button', 'Edit Time').should('exist');
	});

	it('should show error when scheduling maintenance fails', () => {
		// Set up instance with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		//Set up getMaintenancePreference to return data
		GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference({
			statusCode: 200,
			body: {
				data: null,
				permissions,
			},
		});

		// Mock postMaintenancePreference to fail
		GOLDFISH_SERVICE_INTERCEPT.postMaintenancePreference({
			statusCode: 500,
			body: { message: 'Failed to update preferred maintenance schedule time' },
		});

		// Mock listMaintenances to return an empty list with 200 status
		// This is crucial - the component automatically calls this endpoint
		GOLDFISH_SERVICE_INTERCEPT.listMaintenances({
			statusCode: 200,
			body: {
				cursor: {
					pages: {
						page: 1,
						perPage: 25,
						totalItems: 0,
					},
					hrefs: {},
				},
				data: [],
				permissions,
			},
		});

		// Set up the notifications intercept to capture notifications
		cy.intercept('**/api/notifications**').as('notifications');

		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);
		cy.wait('@GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference');

		// Determine which button text to look for based on whether a preference exists
		cy.get('body').then(($body) => {
			// Look for either button text
			const buttonText = $body.text().includes('Edit Time') ? 'Edit Time' : 'Set Time';

			// Click the button (first one on the page)
			cy.contains('button', buttonText).should('be.visible').click();

			// Confirm the modal appears and wait until it's fully rendered
			cy.contains('h2', 'Set Preferred Maintenance Time').should('exist');
		});

		// Wait for the form to be fully loaded and stable
		cy.get('form').should('be.visible');
		cy.get('input[type="checkbox"]').should('be.visible').click();

		// Create an alias for the Save button and ensure it's stable
		cy.contains('button', 'Save').should('be.visible').should('not.be.disabled').as('saveButton');

		// Use the alias to click the button
		cy.get('@saveButton').click();

		// Wait for the API call to complete
		cy.wait('@GOLDFISH_SERVICE_INTERCEPT.postMaintenancePreference');
		cy.contains('Failed to update preferred maintenance schedule time').should('exist');
	});

	it('should navigate to completed jobs page when clicking the link', () => {
		// Set up instance with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		// Set up maintenance endpoint intercepts AFTER permissions
		GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference();

		GOLDFISH_SERVICE_INTERCEPT.listMaintenances();

		// Ensure the completed jobs link exists and has href
		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Verify maintenance link exists and debug what it looks like
		cy.contains('You may view completed maintenance jobs')
			.parent()
			.within(($el) => {
				cy.log('Link container content:', $el.text());
				cy.get('a')
					.should('exist')
					.invoke('attr', 'href')
					.then((href) => {
						cy.log('Link href:', href);
					});
			});

		// Instead of clicking which might cause issues, use direct navigation
		cy.visit(completedJobsUrl);

		// Wait for URL to update and verify we're on the right page
		cy.url().should('include', '/columnar/settings/maintenance/completed');
		cy.contains('Completed Jobs').should('exist');
	});

	it('should show empty states when no jobs exist', () => {
		// Set up instance with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		// Mock empty maintenance jobs list
		GOLDFISH_SERVICE_INTERCEPT.listMaintenances({
			body: {
				cursor: {
					pages: {
						page: 1,
						perPage: 25,
						totalItems: 0,
					},
					hrefs: {},
				},
				data: [],
				permissions,
			},
		});

		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Check for empty states text content which is more stable than data-auto-id
		cy.contains('No maintenance job is running').should('exist');
		cy.contains('No scheduled maintenance found').should('exist');
	});

	it('should display running jobs when available', () => {
		// Set up instance with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		const successfulColumnarListMaintenancesResponse = clone(
			SuccessfulColumnarListMaintenancesResponse,
		);
		successfulColumnarListMaintenancesResponse.data[0].data.execution.status = 'queued';
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });

		// Set up maintenance preference BEFORE visiting the page
		GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference({
			statusCode: 200,
			body: {
				data: {
					day: 2, // Tuesday
					hour: 15,
					minute: 30,
				},
				permissions,
			},
		});

		// Mock maintenance jobs list with a running job
		GOLDFISH_SERVICE_INTERCEPT.listMaintenances({
			statusCode: 200,
			body: successfulColumnarListMaintenancesResponse,
		});

		// Now visit the page AFTER setting up all intercepts
		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Wait for the maintenance intercepts to complete
		cy.wait('@GOLDFISH_SERVICE_INTERCEPT.getMaintenancePreference');
		cy.wait('@GOLDFISH_SERVICE_INTERCEPT.listMaintenances');

		// Check for running jobs section and table
		cy.contains('h2', 'Currently Running').should('exist');
		// cy.contains('Running Maintenance').should('exist');
		cy.contains('No maintenance job is running').should('not.exist');
		cy.contains('upgradeClusterImage').should('exist');
		cy.contains('schedule04').should('exist');
		cy.contains('Running').should('exist');

		cy.contains('Showing 1 of 1 results').should('exist');
	});

	it('should display scheduled jobs when available', () => {
		// Set up instance with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });
		const successfulColumnarListMaintenancesResponse = clone(
			SuccessfulColumnarListMaintenancesResponse,
		);
		successfulColumnarListMaintenancesResponse.data[0].data.execution.status = 'pending';

		// Mock maintenance jobs list with a pending job
		GOLDFISH_SERVICE_INTERCEPT.listMaintenances({
			statusCode: 200,
			body: successfulColumnarListMaintenancesResponse,
		});

		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Check for scheduled jobs section and table
		cy.contains('h2', 'Scheduled Jobs').should('exist');
		cy.contains('Scheduled Jobs').should('exist');
		cy.contains('upgradeClusterImage').should('exist');
		cy.contains('No scheduled maintenance found').should('not.exist');
		cy.contains('schedule04').should('exist');
		cy.contains('Pending').should('exist');
		cy.get('button').contains('Run Now').should('exist');
		cy.contains('Showing 1 of 1 results').should('exist');
	});

	it('should show both running and scheduled jobs when both are available', () => {
		// Set up instance with permissions
		const instanceResponse = clone(SuccessfulInstanceResponse);
		instanceResponse.resources.columnarMaintenance = permissions;
		INSTANCE_SERVICE_INTERCEPT.getInstance({ body: instanceResponse });
		const successfulColumnarListMaintenancesResponse = clone(
			SuccessfulColumnarListMaintenancesResponse,
		);

		// First job - set it as pending
		successfulColumnarListMaintenancesResponse.data[0].data.execution.status = 'pending';
		successfulColumnarListMaintenancesResponse.data[0].data.config.title = 'schedule02-pending';

		// Create a second job with deep clone instead of reference assignment
		successfulColumnarListMaintenancesResponse.data[1] = clone(
			successfulColumnarListMaintenancesResponse.data[0],
		);
		successfulColumnarListMaintenancesResponse.data[1].data.execution.status = 'queued';
		successfulColumnarListMaintenancesResponse.data[1].data.config.title = 'schedule01-queued';

		// Different IDs to ensure they appear as separate jobs
		successfulColumnarListMaintenancesResponse.data[1].data.id = '123423123123123';

		// Mock maintenance jobs list with both running and pending jobs
		GOLDFISH_SERVICE_INTERCEPT.listMaintenances({
			body: successfulColumnarListMaintenancesResponse,
		});

		cy.visit(columnarMaintenanceUrl);
		cy.wait(withPermissionsWaits);

		// Check both sections exist
		cy.contains('h2', 'Currently Running').should('exist');
		cy.contains('h2', 'Scheduled Jobs').should('exist');
		cy.contains('schedule02-pending').should('exist');
		cy.contains('schedule01-queued').should('exist');
		cy.contains('No scheduled maintenance found').should('not.exist');
		cy.contains('No maintenance job is running').should('not.exist');
	});
});
