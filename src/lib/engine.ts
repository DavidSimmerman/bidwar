// Bid War engine v2 — 2-4 players. Pure logic, no I/O, `now` passed in (testable).
//
// Round model (per confirmed design):
//  • Eligible to bid = budget ≥ $1 AND an open squad spot.
//  • ≥2 eligible → auction (live or silent). Opener (rotates) must bid ≥$1; others may pass.
//  • Exactly 1 eligible → SOLO: they Take-for-$1 or Pass → item dealt round-robin to a needer.
//  • 0 eligible but open spots remain → remaining items dealt one-by-one round-robin to needers.
//  • Ends when every squad is full, the pool empties, or the rounds cap is hit.

export type Mode = 'live' | 'silent';
export type TieRule = 'rebid' | 'live' | 'random' | 'toss';

export interface Rules {
	pool: string;
	players: number; // target count, 2-4
	spots: number | null; // fixed squad size, or null = unlimited
	rounds: number; // hard cap on total rounds
	timerMs: number | null; // per-pick timer, null = unlimited
	budget: number;
	mode: Mode;
	tie: TieRule;
}

export interface Player {
	id: string;
	name: string;
	color: string;
	budget: number;
	squad: string[];
}

export interface Round {
	item: string;
	mode: Mode; // silent can convert to live on a tie
	deadline: number | null;
	solo: boolean; // single eligible bidder deciding take/pass
	only: string[] | null; // participant restriction (tie-break among tied players)
	// live
	currentBid: number;
	leaderId: string | null;
	turnId: string | null;
	passed: string[];
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
	hostId: string;
	status: 'lobby' | 'active' | 'over';
	pool: string[];
	roundsPlayed: number;
	dealPointer: number;
	round: Round | null;
	log: string[];
	lastResult: Result | null;
}

export type Action =
	| { type: 'raise'; amount: number }
	| { type: 'pass' }
	| { type: 'seal'; amount: number }
	| { type: 'take' };

export const COLORS = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'];

// ---- helpers -------------------------------------------------------------
const byId = (s: GameState, id: string) => s.players.find((p) => p.id === id);
const hasSpot = (s: GameState, p: Player) => s.rules.spots == null || p.squad.length < s.rules.spots;
const eligible = (s: GameState, p: Player) => p.budget >= 1 && hasSpot(s, p);
const needers = (s: GameState) => s.players.filter((p) => hasSpot(s, p));
// players who may act this round (restricted during tie-breaks)
const participants = (s: GameState) =>
	s.players.filter((p) => eligible(s, p) && (!s.round?.only || s.round.only.includes(p.id)));

const deadlineFrom = (s: GameState, now: number): number | null =>
	s.rules.timerMs == null ? null : now + s.rules.timerMs;

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
		players: [{ id: host.id, name: host.name, color: COLORS[0], budget: rules.budget, squad: [] }],
		hostId: host.id,
		status: 'lobby',
		pool: items,
		roundsPlayed: 0,
		dealPointer: 0,
		round: null,
		log: [`${host.name} opened the lobby`],
		lastResult: null
	};
}

export function join(s: GameState, p: { id: string; name: string }, now: number): GameState {
	if (s.status !== 'lobby') return s;
	if (s.players.some((x) => x.id === p.id)) return s;
	if (s.players.length >= s.rules.players) return s;
	s.players.push({
		id: p.id,
		name: p.name,
		color: COLORS[s.players.length] ?? '#ffffff',
		budget: s.rules.budget,
		squad: []
	});
	s.log.push(`${p.name} joined (${s.players.length}/${s.rules.players})`);
	if (s.players.length === s.rules.players) {
		s.status = 'active';
		s.log.push('Game on!');
		startRound(s, now);
	}
	return s;
}

// Host may kick off early once ≥2 have joined.
export function startNow(s: GameState, playerId: string, now: number): GameState {
	if (s.status === 'lobby' && playerId === s.hostId && s.players.length >= 2) {
		s.status = 'active';
		s.log.push('Host started the game');
		startRound(s, now);
	}
	return s;
}

function firstEligibleFrom(s: GameState, seat: number): Player | null {
	for (let i = 0; i < s.players.length; i++) {
		const p = s.players[(seat + i) % s.players.length];
		if (eligible(s, p)) return p;
	}
	return null;
}

function startRound(s: GameState, now: number) {
	// auto-deal loop: when nobody can bid, remaining items are dealt round-robin (no interaction)
	while (true) {
		if (s.roundsPlayed >= s.rules.rounds || s.pool.length === 0) return end(s);
		if (needers(s).length === 0) return end(s);

		const elig = s.players.filter((p) => eligible(s, p));

		if (elig.length === 0) {
			const ns = needers(s);
			const who = ns[s.dealPointer % ns.length];
			s.dealPointer++;
			const item = s.pool.shift()!;
			who.squad.push(item);
			record(s, { item, winnerId: who.id, price: 0, note: `${who.name} is dealt ${item}` });
			continue;
		}

		const item = s.pool.shift()!;
		s.round = blankRound(item, s.rules.mode, deadlineFrom(s, now));
		if (elig.length === 1) {
			s.round.solo = true;
			s.round.turnId = elig[0].id;
			s.log.push(`${elig[0].name}: take ${item} for $1 or pass`);
		} else {
			if (s.rules.mode === 'live') {
				s.round.turnId = firstEligibleFrom(s, s.roundsPlayed % s.players.length)!.id;
			}
			s.log.push(`${item} is on the block`);
		}
		return;
	}
}

function blankRound(item: string, mode: Mode, deadline: number | null): Round {
	return {
		item, mode, deadline, solo: false, only: null,
		currentBid: 0, leaderId: null, turnId: null, passed: [], sealed: {}, tieCount: 0
	};
}

function end(s: GameState) {
	s.status = 'over';
	s.round = null;
}

// ---- actions -------------------------------------------------------------
export function act(s: GameState, playerId: string, a: Action, now: number): GameState {
	resolveExpired(s, now);
	if (s.status !== 'active' || !s.round) return s;
	if (!byId(s, playerId)) return s;
	const r = s.round;
	if (r.solo) {
		if (a.type === 'take') soloTake(s, playerId, now);
		else if (a.type === 'pass') soloPass(s, playerId, now);
	} else if (r.mode === 'live') {
		if (a.type === 'raise') raise(s, playerId, a.amount, now);
		else if (a.type === 'pass') passLive(s, playerId, now, false);
	} else if (a.type === 'seal') {
		seal(s, playerId, a.amount, now);
	}
	return s;
}

function raise(s: GameState, pid: string, amount: number, now: number) {
	const r = s.round!;
	if (r.turnId !== pid) return;
	const p = byId(s, pid)!;
	amount = Math.floor(amount);
	if (!Number.isFinite(amount) || amount <= r.currentBid || amount > p.budget) return;
	r.currentBid = amount;
	r.leaderId = pid;
	r.deadline = deadlineFrom(s, now);
	s.log.push(`${p.name} bid $${amount}`);
	advanceLive(s, pid, now);
}

function passLive(s: GameState, pid: string, now: number, auto: boolean) {
	const r = s.round!;
	if (r.turnId !== pid) return;
	if (r.leaderId == null && !auto) return; // opener must bid; only a timeout auto-passes them
	const p = byId(s, pid)!;
	if (!r.passed.includes(pid)) r.passed.push(pid);
	if (!auto) s.log.push(`${p.name} passed`);
	r.deadline = deadlineFrom(s, now);
	advanceLive(s, pid, now);
}

// Next contender after `fromId`; if only the leader remains, they win.
function advanceLive(s: GameState, fromId: string, now: number) {
	const r = s.round!;
	const seats = s.players.map((p) => p.id);
	const start = seats.indexOf(fromId);
	let next: string | null = null;
	for (let i = 1; i <= seats.length; i++) {
		const id = seats[(start + i) % seats.length];
		if (id !== r.leaderId && !r.passed.includes(id) && participants(s).some((x) => x.id === id)) {
			next = id;
			break;
		}
	}
	if (next == null) {
		if (r.leaderId) {
			const w = byId(s, r.leaderId)!;
			award(s, w.id, r.item, r.currentBid, `${w.name} won ${r.item} for $${r.currentBid}`, now);
		} else {
			toss(s, r.item, `${r.item} — no bids`, now);
		}
		return;
	}
	r.turnId = next;
}

function seal(s: GameState, pid: string, amount: number, now: number) {
	const r = s.round!;
	if (!participants(s).some((x) => x.id === pid)) return;
	const p = byId(s, pid)!;
	amount = Math.floor(amount);
	if (!Number.isFinite(amount)) return;
	r.sealed[pid] = Math.min(Math.max(0, amount), p.budget);
	s.log.push(`${p.name} sealed a bid`);
	if (participants(s).every((x) => x.id in r.sealed)) resolveSilent(s, now);
}

function resolveSilent(s: GameState, now: number) {
	const r = s.round!;
	const bids = participants(s).map((p) => ({ id: p.id, bid: r.sealed[p.id] ?? 0 }));
	const max = Math.max(0, ...bids.map((b) => b.bid));
	if (max <= 0) return toss(s, r.item, `${r.item} — no bids`, now);
	const top = bids.filter((b) => b.bid === max).map((b) => b.id);
	if (top.length === 1) {
		const w = byId(s, top[0])!;
		return award(s, w.id, r.item, max, `${w.name} sealed $${max} — wins ${r.item}`, now);
	}
	applyTie(s, top, max, now);
}

function applyTie(s: GameState, tied: string[], amount: number, now: number) {
	const r = s.round!;
	s.log.push(`Tie at $${amount} (${tied.map((id) => byId(s, id)!.name).join(', ')})`);
	let rule = s.rules.tie;
	if (rule === 'rebid' && r.tieCount >= 3) rule = 'random'; // cap so a stubborn tie can't loop forever

	if (rule === 'rebid') {
		r.tieCount++;
		r.only = tied;
		r.sealed = {};
		r.deadline = deadlineFrom(s, now);
		s.log.push(`Rebid #${r.tieCount} among the tie`);
	} else if (rule === 'live') {
		r.mode = 'live';
		r.only = tied;
		r.currentBid = amount;
		r.leaderId = null;
		r.passed = [];
		r.turnId = tied[s.roundsPlayed % tied.length];
		r.deadline = deadlineFrom(s, now);
		s.log.push(`Tie → live from $${amount}`);
	} else if (rule === 'random') {
		const w = byId(s, tied[s.roundsPlayed % tied.length])!; // deterministic (seat-stable) pick
		award(s, w.id, r.item, amount, `Coin flip → ${w.name} takes ${r.item}`, now);
	} else {
		toss(s, r.item, `Tie → ${r.item} tossed`, now);
	}
}

function soloTake(s: GameState, pid: string, now: number) {
	const r = s.round!;
	if (r.turnId !== pid) return;
	const p = byId(s, pid)!;
	if (p.budget < 1) return;
	award(s, pid, r.item, 1, `${p.name} took ${r.item} for $1`, now);
}

function soloPass(s: GameState, pid: string, now: number) {
	const r = s.round!;
	if (r.turnId !== pid) return;
	const others = needers(s).filter((p) => p.id !== pid);
	if (others.length === 0) return toss(s, r.item, `${r.item} — passed, no takers`, now);
	const who = others[s.dealPointer % others.length];
	s.dealPointer++;
	award(s, who.id, r.item, 0, `${byId(s, pid)!.name} passed ${r.item} to ${who.name}`, now);
}

// ---- timers --------------------------------------------------------------
export function resolveExpired(s: GameState, now: number) {
	let guard = 0;
	while (s.status === 'active' && s.round && s.round.deadline != null && now > s.round.deadline) {
		const r = s.round;
		if (r.solo) soloPass(s, r.turnId!, now);
		else if (r.mode === 'live') passLive(s, r.turnId!, now, true);
		else resolveSilent(s, now);
		if (++guard > 100) break;
	}
}

// ---- resolution ----------------------------------------------------------
function award(s: GameState, winnerId: string, item: string, price: number, note: string, now: number) {
	const p = byId(s, winnerId)!;
	p.budget -= price;
	p.squad.push(item);
	record(s, { item, winnerId, price, note });
	s.round = null;
	startRound(s, now);
}
function toss(s: GameState, item: string, note: string, now: number) {
	record(s, { item, winnerId: null, price: 0, note });
	s.round = null;
	startRound(s, now);
}
function record(s: GameState, result: Result) {
	s.lastResult = result;
	s.log.push(result.note);
	s.roundsPlayed++;
}

// ---- view ----------------------------------------------------------------
export function view(s: GameState, playerId: string, now: number) {
	const me = byId(s, playerId) ?? null;
	const r = s.round;
	const pub = (p: Player) => ({
		id: p.id, name: p.name, color: p.color, budget: p.budget, squad: p.squad,
		done: !eligible(s, p), full: !hasSpot(s, p)
	});
	return {
		id: s.id,
		status: s.status,
		rules: s.rules,
		joined: !!me,
		isHost: s.hostId === playerId,
		youId: playerId,
		players: s.players.map(pub),
		roundsPlayed: s.roundsPlayed,
		round: r && {
			item: r.item,
			mode: r.mode,
			solo: r.solo,
			msLeft: r.deadline == null ? null : Math.max(0, r.deadline - now),
			currentBid: r.currentBid,
			leaderId: r.leaderId,
			leaderName: r.leaderId ? byId(s, r.leaderId)!.name : null,
			turnId: r.turnId,
			yourTurn: r.turnId === playerId,
			canBid: !!me && participants(s).some((p) => p.id === playerId),
			youSealed: !!me && playerId in r.sealed,
			sealedCount: Object.keys(r.sealed).length,
			participantCount: participants(s).length
		},
		lastResult: s.lastResult && {
			...s.lastResult,
			winnerName: s.lastResult.winnerId ? (byId(s, s.lastResult.winnerId)?.name ?? null) : null
		},
		log: s.log.slice(-10)
	};
}

export type GameView = ReturnType<typeof view>;
