// Run: node --test src/lib/engine.test.ts   (Node 24 strips types natively)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, join, act, resolveExpired, view, type Rules } from './engine.ts';

const rules = (over: Partial<Rules> = {}): Rules => ({
	pool: 'Test',
	spots: null,
	timer: 'inf',
	mode: 'live',
	tie: 'toss',
	budget: 20,
	...over
});

function start(over: Partial<Rules> = {}, items = ['A', 'B', 'C', 'D']) {
	let s = createGame('g1', rules(over), { id: 'p1', name: 'P1' }, [...items]);
	s = join(s, { id: 'p2', name: 'P2' }, 0);
	return s;
}

test('live: raise then opponent passes → leader wins and pays', () => {
	const s = start(); // item A, p1 acts first
	act(s, 'p1', { type: 'raise', amount: 5 }, 0);
	act(s, 'p2', { type: 'pass' }, 0); // p2 concedes
	assert.equal(s.lastResult?.winnerId, 'p1');
	assert.equal(s.lastResult?.price, 5);
	assert.equal(s.players[0].budget, 15);
	assert.deepEqual(s.players[0].squad, ['A']);
});

test('live: cannot bid below standing bid or over budget', () => {
	const s = start();
	act(s, 'p1', { type: 'raise', amount: 5 }, 0);
	act(s, 'p2', { type: 'raise', amount: 5 }, 0); // not higher → ignored
	assert.equal(s.round?.currentBid, 5);
	assert.equal(s.round?.leaderId, 'p1');
	act(s, 'p2', { type: 'raise', amount: 999 }, 0); // over budget → ignored
	assert.equal(s.round?.currentBid, 5);
});

test('live: not your turn is ignored', () => {
	const s = start(); // p1's turn
	act(s, 'p2', { type: 'raise', amount: 3 }, 0);
	assert.equal(s.round?.currentBid, 0);
});

test('silent: higher sealed bid wins and pays own bid', () => {
	const s = start({ mode: 'silent' });
	act(s, 'p1', { type: 'seal', amount: 7 }, 0);
	act(s, 'p2', { type: 'seal', amount: 4 }, 0);
	assert.equal(s.lastResult?.winnerId, 'p1');
	assert.equal(s.lastResult?.price, 7);
	assert.equal(s.players[0].budget, 13);
});

test('silent tie → toss (no winner, next item)', () => {
	const s = start({ mode: 'silent', tie: 'toss' });
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	act(s, 'p2', { type: 'seal', amount: 6 }, 0);
	assert.equal(s.lastResult?.winnerId, null);
	assert.equal(s.round?.item, 'B'); // advanced to next
});

test('silent tie → rebid keeps the same item for another sealed round', () => {
	const s = start({ mode: 'silent', tie: 'rebid' });
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	act(s, 'p2', { type: 'seal', amount: 6 }, 0);
	assert.equal(s.round?.item, 'A');
	assert.equal(s.round?.tieCount, 1);
	assert.deepEqual(s.round?.sealed, {});
});

test('silent tie → live converts the round and raises floor to tie amount', () => {
	const s = start({ mode: 'silent', tie: 'live' });
	act(s, 'p1', { type: 'seal', amount: 6 }, 0);
	act(s, 'p2', { type: 'seal', amount: 6 }, 0);
	assert.equal(s.round?.mode, 'live');
	assert.equal(s.round?.currentBid, 6);
});

test('fixed spots: a full-squad player sits out; game ends when both are full', () => {
	const s = start({ spots: 1 }); // each drafts 1
	act(s, 'p1', { type: 'raise', amount: 1 }, 0);
	act(s, 'p2', { type: 'pass' }, 0); // p1 wins A, p1 now full
	assert.equal(s.status, 'active');
	assert.equal(s.players[0].squad.length, 1);
	// round B: p2 acts first, p1 is full → auto-sits, p2 wins uncontested
	act(s, 'p2', { type: 'raise', amount: 1 }, 0);
	assert.equal(s.lastResult?.winnerId, 'p2');
	assert.equal(s.status, 'over');
});

test('live timeout on the actor counts as a pass', () => {
	const s = start({ timer: '10s' });
	act(s, 'p1', { type: 'raise', amount: 4 }, 0); // p1 leads, p2 to act, deadline 10s
	resolveExpired(s, 20_000); // p2 times out → p1 wins
	assert.equal(s.lastResult?.winnerId, 'p1');
	assert.equal(s.lastResult?.price, 4);
});

test('silent: a full-squad player cannot win more items', () => {
	const s = start({ mode: 'silent', spots: 1 });
	act(s, 'p1', { type: 'seal', amount: 5 }, 0);
	act(s, 'p2', { type: 'seal', amount: 1 }, 0); // p1 wins A, now full
	assert.equal(s.players[0].squad.length, 1);
	// round B: even if p1 tries to bid high, being full their bid can't win
	act(s, 'p1', { type: 'seal', amount: 5 }, 0);
	act(s, 'p2', { type: 'seal', amount: 1 }, 0);
	assert.equal(s.players[0].squad.length, 1); // still 1 — not overfilled
	assert.equal(s.lastResult?.winnerId, 'p2'); // the active player wins uncontested
});

test('action from a non-player is ignored (no crash)', () => {
	const s = start({ mode: 'silent' });
	act(s, 'intruder', { type: 'seal', amount: 99 }, 0); // must not throw
	assert.equal(s.round?.item, 'A'); // round untouched
});

test('view never leaks the opponent sealed amount pre-reveal', () => {
	const s = start({ mode: 'silent' });
	act(s, 'p1', { type: 'seal', amount: 7 }, 0);
	const v = view(s, 'p2', 0);
	assert.equal(v.round?.oppSealed, true);
	assert.ok(!JSON.stringify(v).includes('"7"') && !JSON.stringify(v.round).includes(':7'));
});
