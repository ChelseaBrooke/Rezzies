import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: 2,
	reporter: [['html'], ['list']],

	use: {
		baseURL: 'http://localhost:5173',
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
	},

	projects: [
		// Setup project: seeds DB and creates auth state files
		{
			name: 'setup',
			testMatch: /global-setup\.ts/,
		},

		// Tests that require no authentication (login, signup, anonymous flows)
		{
			name: 'no-auth',
			use: { ...devices['Desktop Chrome'] },
			testMatch: /\/(auth|anonymous)\/.+\.spec\.ts$/,
			dependencies: ['setup'],
		},

		// Tests that run as the host user
		{
			name: 'host-tests',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'e2e/.auth/host.json',
			},
			testMatch: /\/host\/.+\.spec\.ts$/,
			dependencies: ['setup'],
		},

		// Tests that run as the guest user
		{
			name: 'guest-tests',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'e2e/.auth/guest.json',
			},
			testMatch: /\/guest\/.+\.spec\.ts$/,
			dependencies: ['setup'],
		},

		// Tests that need multiple roles (social features, shared)
		{
			name: 'multi-role',
			use: { ...devices['Desktop Chrome'] },
			testMatch: /\/(social|shared|errors)\/.+\.spec\.ts$/,
			dependencies: ['setup'],
		},

		// Teardown: cleans up test data
		{
			name: 'teardown',
			testMatch: /global-teardown\.ts/,
			dependencies: ['no-auth', 'host-tests', 'guest-tests', 'multi-role'],
		},
	],

	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
