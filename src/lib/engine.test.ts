// Run: node --test src/lib/engine.test.ts   (Node 24 strips types natively)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, join, act, resolveExpired, view, type Rules } from './engine.ts';

function mk(over: Partial<Rules> = {}, n = 2, items = ['A', 'B', 'C', 'D', 'E', 'F']) {
	const rules: Rules = {
		pool: 'T', players: n, spots: null, rounds: 100, timerMs: null,
		budget: 20, mode: 'live', tie: 'toss', ...over
	};
	let s = createGame('g', rules, { id: 'p0', name: 'P0' }, [...items]);
	for (let i = 1; i < n; i++) s = join(s, { id: `p${i}`, name: `P${i}` }, 0);
	return s;
}
const R = (s: ReturnType<typeof mk>) => s.round!;

test('lobby fills then auto-starts at target player count', () => {
	const s = mk({}, 3);
	assert.equal(s.status, 'active');
	assert.equal(s.players.length, 3);
	assert.ok(s.round);
});

test('live 2p: opener bids, other passes → opener wins and pays', () => {
	const s = mk();
	act(s, 'p0', { type: 'raise', amount: 5 }, 0);
	act(s, 'p1', { type: 'pass' }, 0);
	assert.equal(s.lastResult?.winnerId, 'p0');
	assert.equal(s.lastResult?.price, 5);
	assert.equal(s.players[0].budget, 15);
	assert.deepEqual(s.players[0].squad, [{ item: 'A', price: 5 }]);
});

test('live: the opener cannot pass to open (must bid ≥ $1)', () => {
	const s = mk();
	act(s, 'p0', { type: 'pass' }, 0);
	assert.equal(R(s).currentBid, 0);
	assert.equal(R(s).turnId, 'p0');
	assert.equal(s.status, 'active');
});

test('live 3p: re-raising resolves to the last bidder standing', () => {
	const s = mk({}, 3);
	act(s, 'p0', { type: 'raise', amount: 2 }, 0);
	act(s, 'p1', { type: 'raise', amount: 4 }, 0);
	act(s, 'p2', { type: 'raise', amount: 6 }, 0);
	act(s, 'p0', { type: 'pass' }, 0);
	act(s, 'p1', { type: 'pass' }, 0);
	assert.equal(s.lastResult?.winnerId, 'p2');
	assert.equal(s.lastResult?.price, 6);
	assert.equal(s.players[2].budget, 14);
});

test('live: cannot bid below the standing bid or over budget', () => {
	const s = mk();
	act(s, 'p0', { type: 'raise', amount: 5 }, 0);
	act(s, 'p1', { type: 'raise', amount: 5 }, 0); // not higher → ignored
	assert.equal(R(s).currentBid, 5);
	act(s, 'p1', { type: 'raise', amount: 999 }, 0); // over budget → ignored
	assert.equal(R(s).currentBid, 5);
});

test('silent 3p: highest sealed bid wins, pays own bid', () => {
	const s = mk({ mode: 'silent' }, 3);
	act(s, 'p0', { type: 'seal', amount: 5 }, 0);
	act(s, 'p1', { type: 'seal', amount: 8 }, 0);
	act(s, 'p2', { type: 'seal', amount: 3 }, 0);
	assert.equal(s.lastResult?.winnerId, 'p1');
	assert.equal(s.lastResult?.price, 8);
});

test('silent tie → toss moves to next item', () => {
	const s = mk({ mode: 'silent', tie: 'toss' });
	act(s, 'p0', { type: 'seal', amount: 6 }, 0);
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	assert.equal(s.lastResult?.winnerId, null);
	assert.equal(R(s).item, 'B');
});

test('silent tie → rebid keeps item, restricts to the tied players', () => {
	const s = mk({ mode: 'silent', tie: 'rebid' });
	act(s, 'p0', { type: 'seal', amount: 6 }, 0);
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	assert.equal(R(s).item, 'A');
	assert.equal(R(s).tieCount, 1);
	assert.deepEqual(R(s).only, ['p0', 'p1']);
	assert.deepEqual(R(s).sealed, {});
});

test('silent tie → live converts the round and raises the floor', () => {
	const s = mk({ mode: 'silent', tie: 'live' });
	act(s, 'p0', { type: 'seal', amount: 6 }, 0);
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	assert.equal(R(s).mode, 'live');
	assert.equal(R(s).currentBid, 6);
	assert.equal(R(s).turnId, 'p0');
});

test('tie → live never deadlocks when the floor equals a budget (item is dealt on)', () => {
	const s = mk({ mode: 'silent', tie: 'live', budget: 5 });
	act(s, 'p0', { type: 'seal', amount: 5 }, 0); // both all-in, tie at 5
	act(s, 'p1', { type: 'seal', amount: 5 }, 0);
	assert.equal(R(s).mode, 'live');
	assert.equal(R(s).currentBid, 5); // neither can bid ABOVE 5 (both have exactly $5)
	act(s, 'p0', { type: 'pass' }, 0); // p0 can't top; p1 can't either → resolves, no deadlock
	assert.ok(['p0', 'p1'].includes(s.lastResult?.winnerId ?? '')); // dealt to a needer, never "no sale"
	assert.equal(s.lastResult?.price, 0);
	assert.equal(R(s).item, 'B');
});

test('tie → random picks one of the tied players at the tie price', () => {
	const s = mk({ mode: 'silent', tie: 'random' });
	act(s, 'p0', { type: 'seal', amount: 6 }, 0);
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	assert.ok(['p0', 'p1'].includes(s.lastResult?.winnerId ?? ''));
	assert.equal(s.lastResult?.price, 6);
});

test('solo: when one bidder is left they can Take for $1', () => {
	const s = mk({ budget: 5 });
	act(s, 'p0', { type: 'raise', amount: 1 }, 0);
	act(s, 'p1', { type: 'raise', amount: 5 }, 0); // p1 all-in → wins A immediately, now broke
	assert.equal(s.players[1].budget, 0);
	assert.equal(R(s).solo, true); // round B: only p0 can bid
	act(s, 'p0', { type: 'take' }, 0);
	assert.equal(s.lastResult?.item, 'B');
	assert.equal(s.lastResult?.price, 1);
	assert.deepEqual(s.players[0].squad.find((x) => x.item === 'B'), { item: 'B', price: 1 });
});

test('solo: Pass hands the item to a player who still needs spots', () => {
	const s = mk({ budget: 5 });
	act(s, 'p0', { type: 'raise', amount: 1 }, 0);
	act(s, 'p1', { type: 'raise', amount: 5 }, 0);
	act(s, 'p0', { type: 'pass' }, 0); // p1 broke
	act(s, 'p0', { type: 'pass' }, 0); // solo p0 passes B → dealt to p1 free
	assert.deepEqual(s.players[1].squad.find((x) => x.item === 'B'), { item: 'B', price: 0 }); // dealt free
	assert.equal(s.lastResult?.winnerId, 'p1');
	assert.equal(s.lastResult?.price, 0);
});

test('an all-in bid nobody can top wins immediately (no dead pass-back)', () => {
	const s = mk(); // budget 20
	act(s, 'p0', { type: 'raise', amount: 20 }, 0); // all-in; p1 cannot exceed 20
	assert.equal(s.lastResult?.winnerId, 'p0');
	assert.equal(s.lastResult?.price, 20); // p1 never got a dead turn
});

test('opener timeout auto-opens at $1 — a fresh item never goes unsold', () => {
	const s = mk({ timerMs: 10_000 });
	resolveExpired(s, 20_000); // p0 (opener) times out before bidding
	assert.equal(R(s).currentBid, 1);
	assert.equal(R(s).leaderId, 'p0');
	assert.equal(R(s).turnId, 'p1');
	assert.equal(s.status, 'active');
});

test('silent round with no bids is dealt to a needer, not tossed', () => {
	const s = mk({ mode: 'silent' });
	act(s, 'p0', { type: 'seal', amount: 0 }, 0);
	act(s, 'p1', { type: 'seal', amount: 0 }, 0);
	assert.notEqual(s.lastResult?.winnerId, null); // someone gets it free — never "no sale"
	assert.equal(s.lastResult?.price, 0);
});

test('dealing: everyone broke with open spots → items handed out round-robin, game ends', () => {
	const s = mk({ budget: 1, spots: 3 }, 2, ['A', 'B', 'C', 'D', 'E', 'F']);
	act(s, 'p0', { type: 'raise', amount: 1 }, 0); // p0 all-in wins A (p1 can't top $1)
	assert.equal(R(s).solo, true); // round B: only p1 still has money
	act(s, 'p1', { type: 'take' }, 0); // p1 takes B → both broke, 2 open spots each → auto-deal
	assert.equal(s.status, 'over');
	assert.equal(s.players[0].squad.length, 3);
	assert.equal(s.players[1].squad.length, 3);
	assert.equal(s.players[0].squad[0].item, 'A');
});

test('rounds cap ends the game even with pool/spots left', () => {
	const s = mk({ rounds: 1 });
	act(s, 'p0', { type: 'raise', amount: 1 }, 0);
	act(s, 'p1', { type: 'pass' }, 0);
	assert.equal(s.status, 'over');
});

test('live timeout auto-passes the player on the clock', () => {
	const s = mk({ timerMs: 10_000 });
	act(s, 'p0', { type: 'raise', amount: 4 }, 0); // p0 leads, p1 to act
	resolveExpired(s, 20_000); // p1 times out → p0 wins
	assert.equal(s.lastResult?.winnerId, 'p0');
	assert.equal(s.lastResult?.price, 4);
});

test('actions from a non-player are ignored (no crash)', () => {
	const s = mk({ mode: 'silent' });
	act(s, 'ghost', { type: 'seal', amount: 99 }, 0);
	assert.equal(R(s).item, 'A');
});

test('view exposes every squad (draft board) and never leaks sealed amounts', () => {
	const s = mk({ mode: 'silent' }, 3);
	act(s, 'p0', { type: 'seal', amount: 7 }, 0);
	const v = view(s, 'p1', 0);
	assert.equal(v.players.length, 3);
	assert.equal(v.round?.sealedCount, 1);
	assert.equal(JSON.stringify(v).includes('"sealed"'), false);
});
