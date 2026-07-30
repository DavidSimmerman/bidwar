import type { Cookies } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { TIMER_MS, type Rules, type Mode, type TieRule, type TimerKey } from '$lib/engine';
import { POOLS } from '$lib/pools';

const MODES: Mode[] = ['live', 'silent'];
const TIES: TieRule[] = ['rebid', 'live', 'random', 'toss'];

// Stable per-browser id. httpOnly so client JS can't spoof it.
export function playerId(cookies: Cookies): string {
	let id = cookies.get('bw_pid');
	if (!id) {
		id = randomUUID();
		cookies.set('bw_pid', id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 });
	}
	return id;
}

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export const newGameId = () => randomUUID().slice(0, 8);

// Validate untrusted request body at the trust boundary. Returns null if invalid.
export function parseRules(body: unknown): Rules | null {
	if (!body || typeof body !== 'object') return null;
	const b = body as Record<string, unknown>;

	if (typeof b.pool !== 'string' || !(b.pool in POOLS)) return null;
	if (!MODES.includes(b.mode as Mode)) return null;
	if (!TIES.includes(b.tie as TieRule)) return null;
	if (!(typeof b.timer === 'string' && b.timer in TIMER_MS)) return null;

	const budget = Number(b.budget);
	if (!Number.isInteger(budget) || budget < 5 || budget > 500) return null;

	let spots: number | null;
	if (b.spots === null) spots = null;
	else {
		const n = Number(b.spots);
		if (!Number.isInteger(n) || n < 1 || n > 20) return null;
		spots = n;
	}

	return { pool: b.pool, mode: b.mode as Mode, tie: b.tie as TieRule, timer: b.timer as TimerKey, budget, spots };
}
