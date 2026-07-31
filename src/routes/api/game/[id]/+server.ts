import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { act, join, startNow, resolveExpired, view, type Action } from '$lib/engine';
import { loadGame, saveGame } from '$lib/server/db';
import { playerId, cleanName } from '$lib/server/games';

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

// POST /api/game/[id] — { op: 'join'|'start'|'raise'|'pass'|'seal'|'take', name?, amount? }
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const game = loadGame(params.id);
	if (!game) throw error(404, 'game not found');
	const pid = playerId(cookies);
	const now = Date.now();
	const body = (await request.json().catch(() => ({}))) as { op?: string; amount?: unknown; name?: unknown };

	switch (body.op) {
		case 'join':
			join(game, { id: pid, name: cleanName(body.name) }, now);
			break;
		case 'start':
			startNow(game, pid, now);
			break;
		case 'pass':
		case 'take':
			act(game, pid, { type: body.op }, now);
			break;
		case 'raise':
		case 'seal': {
			const amount = Number(body.amount);
			if (!Number.isFinite(amount) || amount < 0) throw error(400, 'invalid amount');
			act(game, pid, { type: body.op, amount } as Action, now);
			break;
		}
		default:
			throw error(400, 'unknown op');
	}

	saveGame(game, now);
	return json(view(game, pid, now));
};
