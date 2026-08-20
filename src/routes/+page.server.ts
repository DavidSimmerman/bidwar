import type { PageServerLoad } from './$types';
import { listDrafts } from '$lib/server/db';
import { playerId } from '$lib/server/games';
import { isCategory } from '$lib/drafts';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const cat = url.searchParams.get('category');
	const category = isCategory(cat) ? cat : null;
	const sort = url.searchParams.get('sort') ?? 'popular';
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 40);

	return {
		drafts: await listDrafts({ pid: playerId(cookies), sort, category: category ?? undefined, q: q || undefined }),
		sort,
		category,
		q
	};
};
