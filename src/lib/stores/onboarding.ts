import { writable, derived } from 'svelte/store';
import { HOST_TOOLTIPS, GUEST_TOOLTIPS } from '$lib/config/onboardingTooltips.js';

const LS_KEY = 'divvi-dismissed-tooltips';

function readLocalStorage(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(LS_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function writeLocalStorage(keys: string[]) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(LS_KEY, JSON.stringify(keys));
	} catch { /* quota errors */ }
}

const dismissed = writable<string[]>([]);
const role = writable<'host' | 'guest'>('host');
const enabled = writable(false);
let initialized = false;

async function init(isHost: boolean) {
	role.set(isHost ? 'host' : 'guest');
	enabled.set(true);

	if (initialized) return;
	initialized = true;

	const cached = readLocalStorage();
	dismissed.set(cached);

	try {
		const res = await fetch('/api/user/tooltips');
		if (res.ok) {
			const data = await res.json();
			const server: string[] = Array.isArray(data.dismissed) ? data.dismissed : [];
			dismissed.update((local) => {
				const merged = Array.from(new Set([...local, ...server]));
				writeLocalStorage(merged);
				return merged;
			});
		}
	} catch { /* offline, localStorage cache is fine */ }
}

function dismiss(key: string) {
	dismissed.update((prev) => {
		if (prev.includes(key)) return prev;
		const next = [...prev, key];
		writeLocalStorage(next);
		return next;
	});
	fetch('/api/user/tooltips', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ dismiss: key })
	}).catch(() => {});
}

function resetAll() {
	dismissed.set([]);
	enabled.set(false);
	writeLocalStorage([]);
	initialized = false;
}

/**
 * The single tooltip key that should be visible right now.
 * Walks the ordered sequence for the current role, returns the first undismissed key.
 */
const activeKey = derived([dismissed, role, enabled], ([$dismissed, $role, $enabled]) => {
	if (!$enabled) return null;
	const sequence = $role === 'host' ? HOST_TOOLTIPS : GUEST_TOOLTIPS;
	for (const tip of sequence) {
		if (!$dismissed.includes(tip.key)) return tip.key;
	}
	return null;
});

export const onboardingStore = {
	subscribe: dismissed.subscribe,
	activeKey,
	init,
	dismiss,
	resetAll
};
