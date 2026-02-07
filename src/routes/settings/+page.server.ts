import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { hashPassword, verifyPassword } from '$lib/server/auth.js';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	
	if (!user) {
		throw redirect(303, '/login?redirect=/settings');
	}

	// Get full user data including notification preferences
	const userData = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			email: true,
			name: true,
			phone: true,
			emailTripInvites: true,
			emailTripUpdates: true,
			inAppNotifications: true
		}
	});

	return {
		user: userData
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const formData = await request.formData();
		const name = formData.get('name') as string | null;
		const phone = formData.get('phone') as string | null;

		await prisma.user.update({
			where: { id: user.id },
			data: {
				name: name || null,
				phone: phone || null
			}
		});

		return { success: true };
	},

	changePassword: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;

		// Verify current password
		const userData = await prisma.user.findUnique({
			where: { id: user.id }
		});

		if (!userData) {
			return { error: 'User not found' };
		}

		const isValid = await verifyPassword(currentPassword, userData.passwordHash);
		if (!isValid) {
			return { error: 'Current password is incorrect' };
		}

		// Update password
		const newHash = await hashPassword(newPassword);
		await prisma.user.update({
			where: { id: user.id },
			data: { passwordHash: newHash }
		});

		return { success: true };
	},

	updateNotifications: async ({ request, cookies }) => {
		const user = await getSessionUser(cookies);
		if (!user) throw redirect(303, '/login');

		const formData = await request.formData();
		const emailTripInvites = formData.getAll('emailTripInvites').includes('true');
		const emailTripUpdates = formData.getAll('emailTripUpdates').includes('true');
		const inAppNotifications = formData.getAll('inAppNotifications').includes('true');

		await prisma.user.update({
			where: { id: user.id },
			data: {
				emailTripInvites,
				emailTripUpdates,
				inAppNotifications
			}
		});

		return { success: true, from: 'notifications' };
	}
};
