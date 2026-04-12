import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma.js';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = ipHits.get(ip);
	if (!entry || now > entry.resetAt) {
		ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return false;
	}
	entry.count++;
	return entry.count > RATE_MAX;
}

/** Anonymous invitee: record "can't make it" on the invite row (no user account required). */
export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const clientIp = getClientAddress();
	if (rateLimit(clientIp)) {
		throw error(429, 'Too many requests. Please try again later.');
	}

	const tripId = params.tripId;
	let body: { token?: string; response?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const token = typeof body.token === 'string' ? body.token.trim() : '';
	const response = typeof body.response === 'string' ? body.response.trim().toLowerCase() : '';

	if (!token || response !== 'no') {
		throw error(400, 'Invalid request');
	}

	const invite = await prisma.invite.findUnique({
		where: { token },
		select: { id: true, tripId: true, expiresAt: true, status: true }
	});

	if (!invite || invite.tripId !== tripId) {
		throw error(404, 'Invite not found');
	}

	if (invite.status === 'declined') {
		return json({ ok: true, already: true });
	}

	if (invite.status === 'accepted') {
		throw error(409, 'This invite was already accepted');
	}

	if (invite.status === 'expired' || (invite.expiresAt && invite.expiresAt < new Date())) {
		throw error(410, 'This invite has expired');
	}

	if (invite.status !== 'sent' && invite.status !== 'opened') {
		throw error(400, 'Invite cannot be declined in its current state');
	}

	await prisma.invite.update({
		where: { id: invite.id },
		data: { status: 'declined' }
	});

	return json({ ok: true });
};
