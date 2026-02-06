import type { Cookies } from '@sveltejs/kit';
import { prisma } from './prisma.js';
import { getUserById } from './user-auth.js';

const SESSION_COOKIE_NAME = 'user_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSession(cookies: Cookies, userId: string): Promise<string> {
	const sessionToken = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
	
	// Store session in database
	await prisma.session.create({
		data: {
			userId,
			token: sessionToken,
			expiresAt
		}
	});
	
	cookies.set(SESSION_COOKIE_NAME, sessionToken, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_MAX_AGE
	});

	return sessionToken;
}

export async function getSessionUser(cookies: Cookies) {
	const sessionToken = cookies.get(SESSION_COOKIE_NAME);
	
	if (!sessionToken) {
		return null;
	}

	const session = await prisma.session.findUnique({
		where: { token: sessionToken },
		include: {
			user: {
				select: { id: true, email: true, name: true, avatarUrl: true }
			}
		}
	});

	if (!session || session.expiresAt < new Date()) {
		if (session) {
			await prisma.session.delete({ where: { id: session.id } });
		}
		return null;
	}

	return {
		id: session.user.id,
		email: session.user.email,
		name: session.user.name,
		avatarUrl: session.user.avatarUrl
	};
}

export async function requireAuth(cookies: Cookies) {
	const user = await getSessionUser(cookies);
	if (!user) {
		return null;
	}
	return user;
}

export async function destroySession(cookies: Cookies): Promise<void> {
	const sessionToken = cookies.get(SESSION_COOKIE_NAME);
	
	if (sessionToken) {
		// Delete session from database
		await prisma.session.deleteMany({
			where: { token: sessionToken }
		});
	}
	
	cookies.delete(SESSION_COOKIE_NAME, {
		path: '/'
	});
}

// Clean up expired sessions (call periodically)
export async function cleanupExpiredSessions(): Promise<void> {
	await prisma.session.deleteMany({
		where: {
			expiresAt: {
				lt: new Date()
			}
		}
	});
}
