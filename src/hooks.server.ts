import type { ServerInit } from '@sveltejs/kit';
import { initDb } from '$lib/server/db';

// Runs once before the first request: applies pending migrations, then seeds the
// built-in drafts. Both are idempotent, so a restart or a second replica is harmless.
export const init: ServerInit = async () => {
	await initDb();
};
