import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDraft } from '$lib/server/db';
import { playerId } from '$lib/server/games';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const draft = await getDraft(params.id, playerId(cookies));
	if (!draft) throw error(404, 'No such draft');
	return { draft };
};
