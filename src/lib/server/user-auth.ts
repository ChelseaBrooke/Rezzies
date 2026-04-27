import { prisma } from './prisma.js';
import { hashPassword, verifyPassword } from './auth.js';

/** Fixed bcrypt hash for the string "x" (cost 10) — used so "unknown user" still runs a compare. */
const DUMMY_PASSWORD_HASH =
	'$2a$10$zC0iQ.Adh1uH2ESH3r.8teNaCH5NF9qAq0ufH7SFrs3jItxNxBMia';

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function createUser(
	email: string,
	password: string,
	opts?: { name?: string; travelStyle?: string | null }
): Promise<{ id: string; email: string; name: string | null }> {
	const emailNorm = normalizeEmail(email);

	const existingUser = await prisma.user.findFirst({
		where: { email: { equals: emailNorm, mode: 'insensitive' } }
	});

	if (existingUser) {
		throw new Error('User with this email already exists');
	}

	const passwordHash = await hashPassword(password);
	const name = opts?.name ?? null;
	const travelStyle = opts?.travelStyle && opts.travelStyle.trim() !== '' ? opts.travelStyle.trim() : null;

	const user = await prisma.user.create({
		data: {
			email: emailNorm,
			passwordHash,
			name,
			travelStyle
		},
		select: {
			id: true,
			email: true,
			name: true
		}
	});

	return user;
}

export async function verifyUser(email: string, password: string): Promise<{ id: string; email: string; name: string | null } | null> {
	const emailNorm = normalizeEmail(email);
	const user = await prisma.user.findFirst({
		where: { email: { equals: emailNorm, mode: 'insensitive' } }
	});

	// Always run bcrypt.compare so timing does not reveal whether the email exists.
	const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
	const isValid = await verifyPassword(password, hash);
	if (!user || !isValid) {
		return null;
	}

	return {
		id: user.id,
		email: user.email,
		name: user.name
	};
}

export async function getUserById(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true
		}
	});
}

export async function getUserByEmail(email: string) {
	const emailNorm = normalizeEmail(email);
	return prisma.user.findFirst({
		where: { email: { equals: emailNorm, mode: 'insensitive' } },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true
		}
	});
}
