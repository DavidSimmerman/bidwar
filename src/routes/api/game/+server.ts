import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createGame } from '$lib/engine';
import { POOLS } from '$lib/pools';
import { saveGame } from '$lib/server/db';
import { playerId, parseRules, cleanName, shuffle, newGameId } from '$lib/server/games';

// POST /api/game — create a game from rules, return its id. Body: rules… + { name }.
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const rules = parseRules(body);
	if (!rules) throw error(400, 'invalid rules');

	const id = newGameId();
	const host = { id: playerId(cookies), name: cleanName((body as Record<string, unknown>)?.name) };
	const game = createGame(id, rules, host, shuffle(POOLS[rules.pool]));
	saveGame(game, Date.now());
	return json({ id });
};
