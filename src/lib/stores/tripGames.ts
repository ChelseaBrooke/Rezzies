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
const REMOVED_KEY = (tripId: string) => `trip-games-removed-${tripId}`;

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

export function removeTripGame(tripId: string, tripGameId: string): void {
	const games = getTripGames(tripId).filter((g) => g.id !== tripGameId);
	saveToStorage(STORAGE_KEY(tripId), games);
	const removed = getRemovedTripGameIds(tripId);
	if (!removed.includes(tripGameId)) {
		saveToStorage(REMOVED_KEY(tripId), [...removed, tripGameId]);
	}
}

export function getRemovedTripGameIds(tripId: string): string[] {
	return loadFromStorage<string[]>(REMOVED_KEY(tripId), []);
}

/** Call when trip has ended: purge all sessionStorage data for games that were removed from this trip. */
export function purgeRemovedGamesDataIfTripEnded(tripId: string, checkOutDate: Date | string | null): void {
	if (typeof window === 'undefined' || !checkOutDate) return;
	const end = new Date(checkOutDate);
	end.setHours(23, 59, 59, 999);
	if (new Date() <= end) return; // trip not ended yet
	const removed = getRemovedTripGameIds(tripId);
	if (removed.length === 0) return;
	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (!key) continue;
			for (const tripGameId of removed) {
				if (key.includes(tripId) && key.includes(tripGameId)) {
					keysToRemove.push(key);
					break;
				}
			}
		}
		keysToRemove.forEach((k) => sessionStorage.removeItem(k));
		saveToStorage(REMOVED_KEY(tripId), []);
	} catch {
		// ignore
	}
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

// --- Daily Trivia: questions (host adds) and answers (guests submit) ---

export interface TriviaOption {
	text: string;
	correct: boolean;
}

export interface TriviaQuestion {
	id: string;
	question: string;
	options: TriviaOption[];
}

const TRIVIA_QUESTIONS_KEY = (tripId: string, tripGameId: string) =>
	`trip-games-trivia-${tripId}-${tripGameId}`;
const TRIVIA_ANSWER_KEY = (tripId: string, tripGameId: string, userId: string) =>
	`trip-games-trivia-answer-${tripId}-${tripGameId}-${userId}`;
const TRIVIA_HAS_SUBMISSIONS_KEY = (tripId: string, tripGameId: string) =>
	`trip-games-trivia-has-submissions-${tripId}-${tripGameId}`;
const TRIVIA_PUBLISHED_KEY = (tripId: string, tripGameId: string) =>
	`trip-games-trivia-published-${tripId}-${tripGameId}`;

export function getTriviaQuestions(tripId: string, tripGameId: string): TriviaQuestion[] {
	return loadFromStorage<TriviaQuestion[]>(TRIVIA_QUESTIONS_KEY(tripId, tripGameId), []);
}

export function addTriviaQuestion(
	tripId: string,
	tripGameId: string,
	payload: { question: string; options: TriviaOption[] }
): TriviaQuestion | null {
	if (getTriviaGameHasSubmissions(tripId, tripGameId)) return null;
	const questions = getTriviaQuestions(tripId, tripGameId);
	const hasCorrect = payload.options.some((o) => o.correct);
	const options = hasCorrect
		? payload.options
		: payload.options.map((o, i) => ({ ...o, correct: i === 0 }));
	const newQ: TriviaQuestion = {
		id: crypto.randomUUID(),
		question: payload.question.trim(),
		options: options.filter((o) => o.text.trim() !== '')
	};
	if (newQ.options.length < 2) return newQ;
	questions.push(newQ);
	saveToStorage(TRIVIA_QUESTIONS_KEY(tripId, tripGameId), questions);
	return newQ;
}

export function reorderTriviaQuestions(
	tripId: string,
	tripGameId: string,
	orderedIds: string[]
): void {
	if (getTriviaGameHasSubmissions(tripId, tripGameId)) return;
	const questions = getTriviaQuestions(tripId, tripGameId);
	const byId = new Map(questions.map((q) => [q.id, q]));
	const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as TriviaQuestion[];
	if (reordered.length !== questions.length) return;
	saveToStorage(TRIVIA_QUESTIONS_KEY(tripId, tripGameId), reordered);
}

export function getTriviaGameHasSubmissions(tripId: string, tripGameId: string): boolean {
	return loadFromStorage<boolean>(TRIVIA_HAS_SUBMISSIONS_KEY(tripId, tripGameId), false);
}

export function getTriviaGamePublished(tripId: string, tripGameId: string): boolean {
	return loadFromStorage<boolean>(TRIVIA_PUBLISHED_KEY(tripId, tripGameId), false);
}

export function setTriviaGamePublished(tripId: string, tripGameId: string): void {
	saveToStorage(TRIVIA_PUBLISHED_KEY(tripId, tripGameId), true);
}

function setTriviaGameHasSubmissions(tripId: string, tripGameId: string): void {
	saveToStorage(TRIVIA_HAS_SUBMISSIONS_KEY(tripId, tripGameId), true);
}

/** Submit all answers at once; locks the game for editing. */
export function submitAllTriviaAnswers(
	tripId: string,
	tripGameId: string,
	userId: string,
	answers: Record<string, number>
): void {
	const questions = getTriviaQuestions(tripId, tripGameId);
	const key = TRIVIA_ANSWER_KEY(tripId, tripGameId, userId);
	const result: Record<string, { answerIndex: number; correct: boolean }> = {};
	for (const [questionId, answerIndex] of Object.entries(answers)) {
		const q = questions.find((qu) => qu.id === questionId);
		result[questionId] = {
			answerIndex,
			correct: !!q && q.options[answerIndex]?.correct === true
		};
	}
	saveToStorage(key, result);
	setTriviaGameHasSubmissions(tripId, tripGameId);
}

export function submitTriviaAnswer(
	tripId: string,
	tripGameId: string,
	userId: string,
	questionId: string,
	answerIndex: number
): { correct: boolean } {
	const questions = getTriviaQuestions(tripId, tripGameId);
	const q = questions.find((qu) => qu.id === questionId);
	const correct = !!q && q.options[answerIndex]?.correct === true;
	const key = TRIVIA_ANSWER_KEY(tripId, tripGameId, userId);
	const answers = loadFromStorage<Record<string, { answerIndex: number; correct: boolean }>>(key, {});
	answers[questionId] = { answerIndex, correct };
	saveToStorage(key, answers);
	return { correct };
}

export function updateTriviaQuestion(
	tripId: string,
	tripGameId: string,
	questionId: string,
	payload: { question: string; options: TriviaOption[] }
): boolean {
	if (getTriviaGameHasSubmissions(tripId, tripGameId)) return false;
	const questions = getTriviaQuestions(tripId, tripGameId);
	const idx = questions.findIndex((q) => q.id === questionId);
	if (idx < 0) return false;
	const hasCorrect = payload.options.some((o) => o.correct);
	const options = hasCorrect
		? payload.options
		: payload.options.map((o, i) => ({ ...o, correct: i === 0 }));
	questions[idx] = {
		id: questionId,
		question: payload.question.trim(),
		options: options.filter((o) => o.text.trim() !== '')
	};
	if (questions[idx].options.length < 2) return false;
	saveToStorage(TRIVIA_QUESTIONS_KEY(tripId, tripGameId), questions);
	return true;
}

export function getTriviaAnswer(
	tripId: string,
	tripGameId: string,
	userId: string,
	questionId: string
): { answerIndex: number; correct: boolean } | null {
	const answers = loadFromStorage<Record<string, { answerIndex: number; correct: boolean }>>(
		TRIVIA_ANSWER_KEY(tripId, tripGameId, userId),
		{}
	);
	return answers[questionId] ?? null;
}

/** All answers for a user (for score: how many correct). */
export function getTriviaAnswersForUser(
	tripId: string,
	tripGameId: string,
	userId: string
): Record<string, { answerIndex: number; correct: boolean }> {
	return loadFromStorage<Record<string, { answerIndex: number; correct: boolean }>>(
		TRIVIA_ANSWER_KEY(tripId, tripGameId, userId),
		{}
	);
}
