import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createGame } from '$lib/engine';
import { createGameRow, getDraft, bumpPlays } from '$lib/server/db';
import { playerId, parseRules, cleanName, shuffle, newGameId } from '$lib/server/games';

// POST /api/game — create a game from rules, return its id. Body: rules… + { name, draft }.
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const b = (body ?? {}) as Record<string, unknown>;

	const draft = typeof b.draft === 'string' ? await getDraft(b.draft) : null;
	if (!draft) throw error(400, 'unknown draft');

	const rules = parseRules(body, draft.title);
	if (!rules) throw error(400, 'invalid rules');

	const id = newGameId();
	const host = { id: playerId(cookies), name: cleanName(b.name) };
	const game = createGame(id, rules, host, shuffle(draft.items.map((i) => i.n)));
	await createGameRow(game, Date.now());
	await bumpPlays(draft.id);
	return json({ id });
};
