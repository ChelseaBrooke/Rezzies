/**
 * Dashboard view mode per trip. Used by the header pill (AppShell) and dashboard pages
 * so the mode stays in sync and the pill doesn't cause content to shift.
 */
export type DashboardMode = 'planning' | 'vacation' | 'recap';

import { writable } from 'svelte/store';

export const dashboardModeByTripId = writable<Record<string, DashboardMode>>({});
