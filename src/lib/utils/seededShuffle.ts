/** Mulberry32-based seeded PRNG from a string seed. */
function seededRandom(seed: string): () => number {
	let h = 0x12345678;
	for (let i = 0; i < seed.length; i++) {
		h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b1);
		h += (h << 6) + (h >>> 2);
	}
	let state = h >>> 0;
	return function () {
		state += 0x6d2b79f5;
		let z = state;
		z = Math.imul(z ^ (z >>> 15), z | 1);
		z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
		return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Returns a new array with the elements of `array` shuffled
 * deterministically based on `seed`. Same seed always produces the same order.
 */
export function seededShuffle<T>(array: T[], seed: string): T[] {
	const rand = seededRandom(seed);
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
