import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { act, join, startNow, resolveExpired, view, type Action } from '$lib/engine';
import { withGame } from '$lib/server/db';
import { playerId, cleanName } from '$lib/server/games';

// GET /api/game/[id] — current state for the caller (also lazily resolves expired timers).
// This writes, so it takes the same row lock as a move: an expiring timer and an incoming
// bid must not resolve the same round twice.
export const GET: RequestHandler = async ({ params, cookies }) => {
	const pid = playerId(cookies);
	const now = Date.now();
	const game = await withGame(params.id, (g) => resolveExpired(g, now));
	if (!game) throw error(404, 'game not found');
	return json(view(game, pid, now));
};

// POST /api/game/[id] — { op: 'join'|'start'|'raise'|'pass'|'seal'|'take', name?, amount? }
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const pid = playerId(cookies);
	const now = Date.now();
	const body = (await request.json().catch(() => ({}))) as {
		op?: string;
		amount?: unknown;
		name?: unknown;
	};

	// Validate before opening the transaction so a bad request never holds the row lock.
	let amount = 0;
	if (body.op === 'raise' || body.op === 'seal') {
		amount = Number(body.amount);
		if (!Number.isFinite(amount) || amount < 0) throw error(400, 'invalid amount');
	} else if (!['join', 'start', 'pass', 'take'].includes(body.op ?? '')) {
		throw error(400, 'unknown op');
	}

	// The whole read → apply → write runs under SELECT … FOR UPDATE, so simultaneous
	// moves queue on the row instead of overwriting each other.
	const game = await withGame(params.id, (g) => {
		switch (body.op) {
			case 'join':
				join(g, { id: pid, name: cleanName(body.name) }, now);
				break;
			case 'start':
				startNow(g, pid, now);
				break;
			case 'pass':
			case 'take':
				act(g, pid, { type: body.op }, now);
				break;
			case 'raise':
			case 'seal':
				act(g, pid, { type: body.op, amount } as Action, now);
				break;
		}
	});
	if (!game) throw error(404, 'game not found');
	return json(view(game, pid, now));
};
