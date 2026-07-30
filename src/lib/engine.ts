// Bid War game engine. Pure logic — no I/O, no Date.now (callers pass `now`), so it's
// unit-testable and deterministic except the `random` tie rule.

export type Mode = 'live' | 'silent';
export type TieRule = 'rebid' | 'live' | 'random' | 'toss';
export type TimerKey = '10s' | '1m' | '5m' | '1h' | '12h' | '24h' | 'inf';

export const TIMER_MS: Record<TimerKey, number | null> = {
	'10s': 10_000,
	'1m': 60_000,
	'5m': 300_000,
	'1h': 3_600_000,
	'12h': 43_200_000,
	'24h': 86_400_000,
	inf: null
};

const MIN_BID = 1;

export interface Rules {
	pool: string;
	spots: number | null; // null = unlimited (buy until broke)
	timer: TimerKey;
	mode: Mode;
	tie: TieRule;
	budget: number;
}

export interface Player {
	id: string;
	name: string;
	budget: number;
	squad: string[];
}

export interface Round {
	item: string;
	mode: Mode; // may diverge from rules.mode if a silent tie converts to live
	deadline: number | null;
	// live
	currentBid: number;
	leaderId: string | null;
	turnId: string | null;
	declined: string[];
	// silent
	sealed: Record<string, number>;
	tieCount: number;
}

export interface Result {
	item: string;
	winnerId: string | null;
	price: number;
	note: string;
}

export interface GameState {
	id: string;
	rules: Rules;
	players: Player[];
	status: 'lobby' | 'active' | 'over';
	pool: string[]; // remaining items (already shuffled by caller)
	roundsPlayed: number;
	round: Round | null;
	log: string[];
	lastResult: Result | null;
}

export type Action =
	| { type: 'raise'; amount: number }
	| { type: 'pass' }
	| { type: 'seal'; amount: number };

// ---- helpers -------------------------------------------------------------
const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;
const other = (s: GameState, id: string) => s.players.find((p) => p.id !== id)!;

function isDone(p: Player, r: Rules): boolean {
	if (r.spots != null && p.squad.length >= r.spots) return true;
	return p.budget < MIN_BID;
}
const bothDone = (s: GameState) => s.players.every((p) => isDone(p, s.rules));

function deadlineFrom(s: GameState, now: number): number | null {
	const ms = TIMER_MS[s.rules.timer];
	return ms == null ? null : now + ms;
}

// ---- lifecycle -----------------------------------------------------------
export function createGame(
	id: string,
	rules: Rules,
	host: { id: string; name: string },
	items: string[]
): GameState {
	return {
		id,
		rules,
		players: [{ id: host.id, name: host.name, budget: rules.budget, squad: [] }],
		status: 'lobby',
		pool: items,
		roundsPlayed: 0,
		round: null,
		log: [`${host.name} set up the game`],
		lastResult: null
	};
}

export function join(s: GameState, p: { id: string; name: string }, now: number): GameState {
	if (s.status !== 'lobby') return s;
	if (s.players.some((x) => x.id === p.id)) return s; // host reloading their own link
	s.players.push({ id: p.id, name: p.name, budget: s.rules.budget, squad: [] });
	s.status = 'active';
	s.log.push(`${p.name} joined`);
	startRound(s, now);
	return s;
}

function startRound(s: GameState, now: number) {
	if (bothDone(s) || s.pool.length === 0) {
		s.status = 'over';
		s.round = null;
		return;
	}
	const item = s.pool.shift()!;
	const firstId = s.players[s.roundsPlayed % 2].id;
	s.round = {
		item,
		mode: s.rules.mode,
		deadline: deadlineFrom(s, now),
		currentBid: 0,
		leaderId: null,
		turnId: s.rules.mode === 'live' ? firstId : null,
		declined: [],
		sealed: {},
		tieCount: 0
	};
	if (s.round.mode === 'live') skipDone(s, now);
}

// A player with a full squad / no money auto-passes when it's their turn (live).
function skipDone(s: GameState, now: number) {
	let guard = 0;
	while (s.round && s.round.mode === 'live' && s.round.turnId) {
		const p = player(s, s.round.turnId);
		if (!isDone(p, s.rules)) break;
		passLive(s, p.id, now, true);
		if (++guard > 4) break;
	}
}

// ---- actions -------------------------------------------------------------
export function act(s: GameState, playerId: string, a: Action, now: number): GameState {
	resolveExpired(s, now);
	if (s.status !== 'active' || !s.round) return s;
	if (!s.players.some((p) => p.id === playerId)) return s; // not a player in this game — ignore
	if (s.round.mode === 'live') {
		if (a.type === 'raise') raiseLive(s, playerId, a.amount, now);
		else if (a.type === 'pass') passLive(s, playerId, now, false);
	} else if (a.type === 'seal') {
		sealSilent(s, playerId, a.amount, now);
	}
	return s;
}

function raiseLive(s: GameState, playerId: string, amount: number, now: number) {
	const r = s.round!;
	if (r.turnId !== playerId) return; // not your turn
	const p = player(s, playerId);
	amount = Math.floor(amount);
	if (!Number.isFinite(amount) || amount <= r.currentBid || amount > p.budget) return;
	r.currentBid = amount;
	r.leaderId = playerId;
	r.turnId = other(s, playerId).id;
	r.deadline = deadlineFrom(s, now);
	s.log.push(`${p.name} bid $${amount} on ${r.item}`);
	skipDone(s, now); // opponent may be done → auto-pass → you win
}

function passLive(s: GameState, playerId: string, now: number, auto: boolean) {
	const r = s.round!;
	if (r.turnId !== playerId) return;
	const p = player(s, playerId);
	if (r.leaderId && r.leaderId !== playerId) {
		const w = player(s, r.leaderId);
		award(s, w.id, r.item, r.currentBid, `${w.name} won ${r.item} for $${r.currentBid}`, now);
		return;
	}
	// no standing bid → this player declines the item
	if (!r.declined.includes(playerId)) r.declined.push(playerId);
	if (r.declined.length >= 2) {
		toss(s, r.item, `${r.item} — nobody bid`, now);
		return;
	}
	r.turnId = other(s, playerId).id;
	r.deadline = deadlineFrom(s, now);
	s.log.push(auto ? `${p.name} sat out (squad full)` : `${p.name} passed`);
	skipDone(s, now);
}

function sealSilent(s: GameState, playerId: string, amount: number, now: number) {
	const r = s.round!;
	const p = player(s, playerId);
	if (isDone(p, s.rules)) return; // full squad / broke → sitting out, can't bid
	amount = Math.floor(amount);
	if (!Number.isFinite(amount)) return;
	r.sealed[playerId] = Math.min(Math.max(0, amount), p.budget); // clamp to [0, budget]
	s.log.push(`${p.name} locked in a sealed bid`);
	const ready = s.players.every((x) => x.id in r.sealed || isDone(x, s.rules));
	if (ready) resolveSilent(s, now);
}

function resolveSilent(s: GameState, now: number) {
	const r = s.round!;
	const [a, b] = s.players;
	// a player who's already full/broke sits out — their bid can't win, even if one was sealed
	const ba = isDone(a, s.rules) ? 0 : (r.sealed[a.id] ?? 0);
	const bb = isDone(b, s.rules) ? 0 : (r.sealed[b.id] ?? 0);
	const hi = Math.max(ba, bb);
	if (hi <= 0) return toss(s, r.item, `${r.item} — no bids`, now);
	if (ba === bb) return applyTie(s, hi, now);
	const w = ba > bb ? a : b;
	award(s, w.id, r.item, hi, `${w.name} sealed $${hi} — wins ${r.item}`, now);
}

function applyTie(s: GameState, amount: number, now: number) {
	const r = s.round!;
	s.log.push(`Tie at $${amount} on ${r.item}`);
	let rule = s.rules.tie;
	if (rule === 'rebid' && r.tieCount >= 3) rule = 'random'; // ponytail: cap rebids so a stubborn tie can't loop forever

	if (rule === 'rebid') {
		r.tieCount++;
		r.sealed = {};
		r.deadline = deadlineFrom(s, now);
		s.log.push(`Rebid #${r.tieCount} on ${r.item}`);
	} else if (rule === 'live') {
		r.mode = 'live';
		r.currentBid = amount; // next bid must beat the tie
		r.leaderId = null;
		r.turnId = s.players[s.roundsPlayed % 2].id;
		r.declined = [];
		r.deadline = deadlineFrom(s, now);
		s.log.push(`Tie → live bidding from $${amount}`);
		skipDone(s, now);
	} else if (rule === 'random') {
		const w = s.players[Math.random() < 0.5 ? 0 : 1];
		award(s, w.id, r.item, amount, `Coin flip → ${w.name} takes ${r.item} for $${amount}`, now);
	} else {
		toss(s, r.item, `Tie → ${r.item} thrown out`, now);
	}
}

// Resolve any rounds whose deadline has passed. One expiry step per call in the
// common case (each resolution sets a fresh future deadline); repeated polls catch up.
export function resolveExpired(s: GameState, now: number) {
	let guard = 0;
	while (s.status === 'active' && s.round && s.round.deadline != null && now > s.round.deadline) {
		const r = s.round;
		if (r.mode === 'live') {
			if (r.turnId) passLive(s, r.turnId, now, false);
			else break;
		} else {
			resolveSilent(s, now); // missing sealed bids count as 0
		}
		if (++guard > 50) break;
	}
}

// ---- resolution ----------------------------------------------------------
function award(
	s: GameState,
	winnerId: string,
	item: string,
	price: number,
	note: string,
	now: number
) {
	const p = player(s, winnerId);
	p.budget -= price;
	p.squad.push(item);
	finishRound(s, { item, winnerId, price, note }, now);
}
function toss(s: GameState, item: string, note: string, now: number) {
	finishRound(s, { item, winnerId: null, price: 0, note }, now);
}
function finishRound(s: GameState, result: Result, now: number) {
	s.lastResult = result;
	s.log.push(result.note);
	s.roundsPlayed++;
	s.round = null;
	startRound(s, now);
}

// ---- client projection ---------------------------------------------------
// Never leaks the opponent's sealed number before reveal.
export function view(s: GameState, playerId: string, now: number) {
	const me = s.players.find((p) => p.id === playerId) ?? null;
	const opp = s.players.find((p) => p.id !== playerId) ?? null;
	const r = s.round;
	const proj = (p: Player | null) =>
		p && { name: p.name, budget: p.budget, squad: p.squad, done: isDone(p, s.rules) };
	return {
		id: s.id,
		status: s.status,
		rules: s.rules,
		joined: !!me,
		isHost: s.players[0]?.id === playerId,
		playerCount: s.players.length,
		me: proj(me),
		opp: proj(opp),
		round: r && {
			item: r.item,
			mode: r.mode,
			msLeft: r.deadline == null ? null : Math.max(0, r.deadline - now),
			currentBid: r.currentBid,
			leaderIsMe: r.leaderId === playerId,
			leaderName: r.leaderId ? player(s, r.leaderId).name : null,
			yourTurn: r.turnId === playerId,
			youSealed: !!me && me.id in r.sealed,
			oppSealed: !!opp && opp.id in r.sealed,
			tieCount: r.tieCount
		},
		lastResult: s.lastResult && {
			...s.lastResult,
			winnerIsMe: s.lastResult.winnerId === playerId,
			winnerName: s.lastResult.winnerId
				? (s.players.find((p) => p.id === s.lastResult!.winnerId)?.name ?? null)
				: null
		},
		log: s.log.slice(-8)
	};
}

export type GameView = ReturnType<typeof view>;
