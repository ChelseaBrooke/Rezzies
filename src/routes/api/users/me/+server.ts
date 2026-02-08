/**
 * GET current user (for Edit Profile form).
 * PATCH update current user profile.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionUser } from '$lib/server/session.js';
import { prisma } from '$lib/server/prisma.js';
import { TRAVEL_STYLE_OPTIONS, isValidTravelStyle } from '$lib/travel-style.js';
import { z } from 'zod';

const hexColorRe = /^#[0-9A-Fa-f]{6}$/;
const updateSchema = z.object({
	name: z.string().max(200).optional(),
	avatarUrl: z.union([z.string().url(), z.literal('')]).optional(),
	chatBubbleColor: z.union([z.string().regex(hexColorRe), z.literal('')]).optional(),
	travelStyle: z.union([z.enum(TRAVEL_STYLE_OPTIONS), z.literal('')]).optional(),
	homeCity: z.string().max(120).optional(),
	timezone: z.string().max(80).optional()
});

export const GET: RequestHandler = async ({ cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const row = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			id: true,
			name: true,
			avatarUrl: true,
			chatBubbleColor: true,
			travelStyle: true,
			homeCity: true,
			timezone: true
		}
	});
	if (!row) {
		return json({ error: 'User not found' }, { status: 404 });
	}
	return json({
		id: row.id,
		name: row.name,
		avatarUrl: row.avatarUrl,
		chatBubbleColor: row.chatBubbleColor,
		travelStyle: row.travelStyle,
		homeCity: row.homeCity,
		timezone: row.timezone
	});
};

export const PATCH: RequestHandler = async ({ request, cookies }) => {
	const user = await getSessionUser(cookies);
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}
	const parsed = updateSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
	}
	const d = parsed.data;
	const updateData: {
		name?: string | null;
		avatarUrl?: string | null;
		chatBubbleColor?: string | null;
		travelStyle?: string | null;
		homeCity?: string | null;
		timezone?: string | null;
	} = {};
	if (d.name !== undefined) updateData.name = d.name || null;
	if (d.avatarUrl !== undefined) updateData.avatarUrl = d.avatarUrl === '' ? null : d.avatarUrl;
	if (d.chatBubbleColor !== undefined) updateData.chatBubbleColor = d.chatBubbleColor === '' ? null : d.chatBubbleColor;
	if (d.travelStyle !== undefined) updateData.travelStyle = d.travelStyle === '' ? null : d.travelStyle;
	if (d.homeCity !== undefined) updateData.homeCity = d.homeCity || null;
	if (d.timezone !== undefined) updateData.timezone = d.timezone || null;
	await prisma.user.update({
		where: { id: user.id },
		data: updateData
	});
	return json({ success: true });
};
