import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createGame } from '$lib/engine';
import { POOLS } from '$lib/pools';
import { saveGame } from '$lib/server/db';
import { playerId, parseRules, shuffle, newGameId } from '$lib/server/games';

// POST /api/game — create a game from rules, return its id.
export const POST: RequestHandler = async ({ request, cookies }) => {
	const rules = parseRules(await request.json().catch(() => null));
	if (!rules) throw error(400, 'invalid rules');

	const id = newGameId();
	const game = createGame(id, rules, { id: playerId(cookies), name: 'P1' }, shuffle(POOLS[rules.pool]));
	saveGame(game, Date.now());
	return json({ id });
};
