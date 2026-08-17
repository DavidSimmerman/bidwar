import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDraft, voteDraft, deleteDraft } from '$lib/server/db';
import { playerId } from '$lib/server/games';

// POST /api/drafts/:id — rate it. Body: { v: 1 | -1 | 0 } (0 clears your vote).
// One vote per browser: keyed on the httpOnly bw_pid cookie, so it can't be spoofed from JS.
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const body = (await request.json().catch(() => null)) as { v?: unknown } | null;
	const v = Number(body?.v);
	if (![1, -1, 0].includes(v)) throw error(400, 'invalid vote');

	const pid = playerId(cookies);
	if (!getDraft(params.id, pid)) throw error(404, 'no such draft');

	voteDraft(params.id, pid, v as 1 | -1 | 0);
	const after = getDraft(params.id, pid)!;
	return json({ up: after.up, down: after.down, myVote: after.myVote });
};

// DELETE /api/drafts/:id — creator only (same browser that published it).
export const DELETE: RequestHandler = ({ params, cookies }) => {
	if (!deleteDraft(params.id, playerId(cookies))) throw error(403, 'not yours to delete');
	return json({ ok: true });
};
