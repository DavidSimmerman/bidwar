import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { act, join, resolveExpired, view, type Action } from '$lib/engine';
import { loadGame, saveGame } from '$lib/server/db';
import { playerId } from '$lib/server/games';

// GET /api/game/[id] — current state for the caller (also lazily resolves expired timers).
export const GET: RequestHandler = ({ params, cookies }) => {
	const game = loadGame(params.id);
	if (!game) throw error(404, 'game not found');
	const pid = playerId(cookies);
	const now = Date.now();
	resolveExpired(game, now);
	saveGame(game, now);
	return json(view(game, pid, now));
};

// POST /api/game/[id] — { op: 'join' | 'raise' | 'pass' | 'seal', amount? }
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const game = loadGame(params.id);
	if (!game) throw error(404, 'game not found');
	const pid = playerId(cookies);
	const now = Date.now();
	const body = (await request.json().catch(() => ({}))) as { op?: string; amount?: unknown };

	if (body.op === 'join') {
		join(game, { id: pid, name: 'P2' }, now);
	} else if (body.op === 'raise' || body.op === 'seal') {
		const amount = Number(body.amount);
		if (!Number.isFinite(amount) || amount < 0) throw error(400, 'invalid amount');
		act(game, pid, { type: body.op, amount } as Action, now);
	} else if (body.op === 'pass') {
		act(game, pid, { type: 'pass' }, now);
	} else {
		throw error(400, 'unknown op');
	}

	saveGame(game, now);
	return json(view(game, pid, now));
};
