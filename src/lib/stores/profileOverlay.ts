/**
 * Global profile overlay state: Profile Card and Edit Profile modal.
 * No /profile page; all profile viewing/editing is overlay-based.
 */
import { writable } from 'svelte/store';

export const profileCardUserId = writable<string | null>(null);
export const editProfileModalOpen = writable(false);
/** When true, ProfileCard (if open for self) should refetch and then set this back to false. */
export const profileCardRefreshRequested = writable(false);

export function openProfileCard(userId: string) {
	profileCardUserId.set(userId);
}
export function closeProfileCard() {
	profileCardUserId.set(null);
}
export function openEditProfileModal() {
	editProfileModalOpen.set(true);
}
export function closeEditProfileModal() {
	editProfileModalOpen.set(false);
}
export function requestProfileCardRefresh() {
	profileCardRefreshRequested.set(true);
}
