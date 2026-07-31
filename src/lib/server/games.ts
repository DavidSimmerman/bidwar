import type { Cookies } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import type { Rules, Mode, TieRule } from '$lib/engine';
import { POOLS } from '$lib/pools';

const MODES: Mode[] = ['live', 'silent'];
const TIES: TieRule[] = ['rebid', 'live', 'random', 'toss'];
const DAY_MS = 86_400_000;

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

// Trim + bound a display name. Always returns something usable.
export const cleanName = (v: unknown): string =>
	(typeof v === 'string' ? v : '').trim().slice(0, 16) || 'Player';

const int = (v: unknown) => (Number.isInteger(Number(v)) ? Number(v) : NaN);

// Validate untrusted rules at the trust boundary. Returns null if invalid.
export function parseRules(body: unknown): Rules | null {
	if (!body || typeof body !== 'object') return null;
	const b = body as Record<string, unknown>;

	if (typeof b.pool !== 'string' || !(b.pool in POOLS)) return null;
	if (!MODES.includes(b.mode as Mode)) return null;
	if (!TIES.includes(b.tie as TieRule)) return null;

	const players = int(b.players);
	if (!(players >= 2 && players <= 4)) return null;

	const budget = int(b.budget);
	if (!(budget >= 5 && budget <= 500)) return null;

	const rounds = int(b.rounds);
	if (!(rounds >= players && rounds <= 500)) return null;

	let spots: number | null;
	if (b.spots === null) spots = null;
	else {
		const n = int(b.spots);
		if (!(n >= 1 && n <= 20)) return null;
		spots = n;
	}

	let timerMs: number | null;
	if (b.timerMs === null) timerMs = null;
	else {
		const n = int(b.timerMs);
		if (!(n >= 1000 && n <= DAY_MS)) return null; // 1s … 24h
		timerMs = n;
	}

	return {
		pool: b.pool,
		players,
		spots,
		rounds,
		timerMs,
		budget,
		mode: b.mode as Mode,
		tie: b.tie as TieRule
	};
}
