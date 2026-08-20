import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cleanItems, isCategory, LIMITS } from '$lib/drafts';
import { listDrafts, createDraft, recentDraftCount } from '$lib/server/db';
import { playerId, cleanName } from '$lib/server/games';

const HOUR_MS = 3_600_000;
const MAX_PER_HOUR = 10;

// GET /api/drafts?sort=popular&category=Sports&q=nba
export const GET: RequestHandler = async ({ url, cookies }) => {
	const category = url.searchParams.get('category');
	return json({
		drafts: await listDrafts({
			pid: playerId(cookies),
			sort: url.searchParams.get('sort') ?? undefined,
			category: isCategory(category) ? category : undefined,
			q: (url.searchParams.get('q') ?? '').trim().slice(0, 40) || undefined
		})
	});
};

// POST /api/drafts — publish a draft. Body: { title, category, items[], author }
export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) throw error(400, 'invalid body');

	const title = (typeof body.title === 'string' ? body.title : '').trim().slice(0, LIMITS.title);
	if (!title) throw error(400, 'title required');
	if (!isCategory(body.category)) throw error(400, 'pick a category');

	const items = cleanItems(body.items);
	if (!items) throw error(400, `need at least ${LIMITS.minItems} items`);

	const owner = playerId(cookies);
	const now = Date.now();
	if ((await recentDraftCount(owner, now - HOUR_MS)) >= MAX_PER_HOUR) throw error(429, 'slow down — try again later');

	const id = await createDraft({ title, category: body.category, items, author: cleanName(body.author), owner, now });
	return json({ id }, { status: 201 });
};
