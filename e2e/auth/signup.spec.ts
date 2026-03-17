import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SIGNUP_USER, E2E_EMAIL_DOMAIN } from '../fixtures/test-data.js';

const prisma = new PrismaClient();

test.describe('Signup page', () => {
	test.beforeEach(async ({ page }) => {
		// Clean up the signup test user if it exists
		await prisma.user.deleteMany({
			where: { email: SIGNUP_USER.email },
		});
		await page.goto('/signup');
	});

	test.afterAll(async () => {
		// Final cleanup
		await prisma.user.deleteMany({
			where: { email: SIGNUP_USER.email },
		});
		await prisma.$disconnect();
	});

	test('shows signup form', async ({ page }) => {
		await expect(page.locator('h1')).toHaveText('Sign up');
		await expect(page.locator('input[name="email"]')).toBeVisible();
		await expect(page.locator('input[name="password"]')).toBeVisible();
		await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toHaveText('Sign up');
	});

	test('successful signup redirects to /trips', async ({ page }) => {
		await page.fill('input[name="email"]', SIGNUP_USER.email);
		await page.fill('input[name="password"]', SIGNUP_USER.password);
		await page.fill('input[name="confirmPassword"]', SIGNUP_USER.password);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/trips');
		await expect(page).toHaveURL(/\/trips$/);
	});

	test('password mismatch shows error', async ({ page }) => {
		await page.fill('input[name="email"]', SIGNUP_USER.email);
		await page.fill('input[name="password"]', SIGNUP_USER.password);
		await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
		await page.click('button[type="submit"]');
		await expect(page.locator('.auth-error')).toBeVisible();
		await expect(page.locator('.auth-error')).toContainText('Passwords do not match');
	});

	test('short password shows error', async ({ page }) => {
		await page.fill('input[name="email"]', SIGNUP_USER.email);
		await page.fill('input[name="password"]', 'short');
		await page.fill('input[name="confirmPassword"]', 'short');
		await page.click('button[type="submit"]');
		// HTML5 minlength="8" or server validation
		const url = page.url();
		expect(url).toContain('/signup');
	});

	test('duplicate email shows error', async ({ page }) => {
		// First, create the user
		await page.fill('input[name="email"]', SIGNUP_USER.email);
		await page.fill('input[name="password"]', SIGNUP_USER.password);
		await page.fill('input[name="confirmPassword"]', SIGNUP_USER.password);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/trips');

		// Now try to sign up again with the same email (new context to clear session)
		const newContext = await page.context().browser()!.newContext();
		const newPage = await newContext.newPage();
		await newPage.goto('/signup');
		await newPage.fill('input[name="email"]', SIGNUP_USER.email);
		await newPage.fill('input[name="password"]', SIGNUP_USER.password);
		await newPage.fill('input[name="confirmPassword"]', SIGNUP_USER.password);
		await newPage.click('button[type="submit"]');
		await expect(newPage.locator('.auth-error')).toBeVisible();
		await newContext.close();
	});

	test('has link to login page', async ({ page }) => {
		const loginLink = page.locator('a[href="/login"]').first();
		await expect(loginLink).toBeVisible();
	});
});
