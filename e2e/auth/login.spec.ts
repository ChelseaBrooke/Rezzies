import { test, expect } from '@playwright/test';
import { HOST_USER } from '../fixtures/test-data.js';

test.describe('Login page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
	});

	test('shows login form', async ({ page }) => {
		await expect(page.locator('h1')).toHaveText('Log in');
		await expect(page.locator('input[name="email"]')).toBeVisible();
		await expect(page.locator('input[name="password"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toHaveText('Log in');
	});

	test('successful login redirects to /trips', async ({ page }) => {
		await page.fill('input[name="email"]', HOST_USER.email);
		await page.fill('input[name="password"]', HOST_USER.password);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/trips');
		await expect(page).toHaveURL(/\/trips$/);
	});

	test('invalid password shows error', async ({ page }) => {
		await page.fill('input[name="email"]', HOST_USER.email);
		await page.fill('input[name="password"]', 'wrongpassword123');
		await page.click('button[type="submit"]');
		await expect(page.locator('.auth-error')).toBeVisible();
		await expect(page.locator('.auth-error')).toContainText('Invalid email or password');
	});

	test('invalid email format shows error', async ({ page }) => {
		await page.fill('input[name="email"]', 'not-an-email');
		await page.fill('input[name="password"]', 'somepassword');
		await page.click('button[type="submit"]');
		// HTML5 validation will prevent submission, or server returns error
		const url = page.url();
		expect(url).toContain('/login');
	});

	test('login with redirect param redirects correctly', async ({ page }) => {
		await page.goto('/login?redirect=/settings');
		await page.fill('input[name="email"]', HOST_USER.email);
		await page.fill('input[name="password"]', HOST_USER.password);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/settings');
		await expect(page).toHaveURL(/\/settings$/);
	});

	test('has link to signup page', async ({ page }) => {
		const signupLink = page.locator('a[href="/signup"]').first();
		await expect(signupLink).toBeVisible();
	});
});
