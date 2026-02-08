import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { hashPassword, verifyPassword } from './auth.js';

export async function createUser(
	email: string,
	password: string,
	opts?: { name?: string; travelStyle?: string | null }
): Promise<{ id: string; email: string; name: string | null }> {
	const existingUser = await prisma.user.findUnique({
		where: { email }
	});

	if (existingUser) {
		throw new Error('User with this email already exists');
	}

	const passwordHash = await hashPassword(password);
	const name = opts?.name ?? null;
	const travelStyle = opts?.travelStyle && opts.travelStyle.trim() !== '' ? opts.travelStyle.trim() : null;

	const user = await prisma.user.create({
		data: {
			email,
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
	const user = await prisma.user.findUnique({
		where: { email }
	});

	if (!user) {
		return null;
	}

	const isValid = await verifyPassword(password, user.passwordHash);
	if (!isValid) {
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
	return prisma.user.findUnique({
		where: { email },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true
		}
	});
}
