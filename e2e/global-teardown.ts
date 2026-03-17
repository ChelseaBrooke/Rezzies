import { test as teardown } from '@playwright/test';
import { cleanupTestData } from './fixtures/seed.js';

teardown('clean up test data', async () => {
	await cleanupTestData();
});
