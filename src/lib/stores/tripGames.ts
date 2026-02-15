/**
 * Client-side store for trip games (add-on games for a trip).
 * Persists to sessionStorage per trip. Will be replaced by API/database later.
 */

export type GameId = 'scavenger-bingo' | 'caption-this' | 'alphabet-hunt' | 'daily-trivia';

export interface TripGame {
	id: string;
	gameId: GameId;
	name: string;
	addedByUserId: string;
	addedAt: string;
}

export interface GameDef {
	id: GameId;
	name: string;
	description: string;
	icon: string;
	instructions: string;
	prize: string;
}

export const GAME_DEFS: GameDef[] = [
	{
		id: 'scavenger-bingo',
		name: 'Scavenger Hunt Bingo',
		description: 'Photo bingo with vacation scenarios. Everyone gets a different board.',
		icon: '🎯',
		instructions:
			'Complete a row, column, or diagonal by photographing things that match the squares. Each player gets a different board. Some prompts are funny, some are tricky. When someone gets Bingo, the game ends and they win!',
		prize: 'Bragging rights and a winner badge on your profile.'
	},
	{
		id: 'caption-this',
		name: 'Caption This',
		description: 'Photo caption contest. Vote on the funniest caption.',
		icon: '💬',
		instructions:
			'One person uploads a photo. Everyone anonymously submits a caption. Then players vote on the funniest one. The caption with the most votes wins that round!',
		prize: 'Bragging rights and a winner badge on your profile.'
	},
	{
		id: 'alphabet-hunt',
		name: 'Alphabet Hunt',
		description: 'Photograph things A through Z. Furthest in the alphabet wins.',
		icon: '🔤',
		instructions:
			'Find and photograph something that starts with each letter of the alphabet, in order (A, B, C...). Whoever gets the furthest by the end of the trip wins. Spelling counts!',
		prize: 'Bragging rights and a winner badge on your profile.'
	},
	{
		id: 'daily-trivia',
		name: 'Daily Trivia',
		description: 'A game master posts a trivia question each day. Great for birthdays & weddings!',
		icon: '❓',
		instructions:
			'The "game master" (whoever volunteers) posts one trivia question per day. First correct answer wins that day. Perfect for themed trips like birthdays or weddings—questions can be tailored to the guest of honor!',
		prize: 'Bragging rights and a winner badge on your profile.'
	}
];

const STORAGE_KEY = (tripId: string) => `trip-games-${tripId}`;
const JOINED_KEY = (tripId: string, userId: string) => `trip-games-joined-${tripId}-${userId}`;
const UNDERSTOOD_KEY = (tripId: string, userId: string) => `trip-games-understood-${tripId}-${userId}`;

function loadFromStorage<T>(key: string, defaultValue: T): T {
	if (typeof window === 'undefined') return defaultValue;
	try {
		const raw = sessionStorage.getItem(key);
		return raw ? JSON.parse(raw) : defaultValue;
	} catch {
		return defaultValue;
	}
}

function saveToStorage(key: string, value: unknown): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore
	}
}

export function getTripGames(tripId: string): TripGame[] {
	return loadFromStorage(STORAGE_KEY(tripId), []);
}

export function addTripGame(tripId: string, game: Omit<TripGame, 'id' | 'addedAt'>): TripGame {
	const games = getTripGames(tripId);
	const newGame: TripGame = {
		...game,
		id: crypto.randomUUID(),
		addedAt: new Date().toISOString()
	};
	games.push(newGame);
	saveToStorage(STORAGE_KEY(tripId), games);
	return newGame;
}

export function removeTripGame(tripId: string, gameId: string): void {
	const games = getTripGames(tripId).filter((g) => g.id !== gameId);
	saveToStorage(STORAGE_KEY(tripId), games);
}

export function getJoinedGames(tripId: string, userId: string): Set<string> {
	const arr = loadFromStorage<string[]>(JOINED_KEY(tripId, userId), []);
	return new Set(arr);
}

export function joinGame(tripId: string, userId: string, tripGameId: string): void {
	const joined = [...getJoinedGames(tripId, userId), tripGameId];
	saveToStorage(JOINED_KEY(tripId, userId), joined);
}

export function getUnderstoodGames(tripId: string, userId: string): Set<string> {
	const arr = loadFromStorage<string[]>(UNDERSTOOD_KEY(tripId, userId), []);
	return new Set(arr);
}

export function markUnderstood(tripId: string, userId: string, tripGameId: string): void {
	const understood = [...getUnderstoodGames(tripId, userId), tripGameId];
	saveToStorage(UNDERSTOOD_KEY(tripId, userId), understood);
}
