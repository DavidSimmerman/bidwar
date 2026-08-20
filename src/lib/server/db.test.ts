// Run: node --test src/lib/server/db.test.ts
// Needs a throwaway Postgres. Defaults to the local bidwar_test database.
//
// db.ts opens its pool at module scope, and ESM evaluates imports before any
// top-level statement here — so a static import would connect to the DEV database
// before we could point it elsewhere. Hence the dynamic import below.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, join, act, type Rules } from '../engine.ts';

process.env.DATABASE_URL ??= 'postgres://bidwar:bidwar@127.0.0.1:5432/bidwar_test';
const {
	pool,
	initDb,
	withGame,
	loadGame,
	createGameRow,
	createDraft,
	getDraft,
	voteDraft,
	deleteDraft,
	listDrafts
} = await import('./db.ts');

const RULES: Rules = {
	pool: 'T', players: 4, spots: null, rounds: 100,
	timerMs: null, budget: 50, mode: 'live', tie: 'toss'
};
const ITEMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

let n = 0;
const freshId = () => `test-${process.pid}-${n++}`;

before(async () => {
	await initDb();
});

after(async () => {
	await pool.end();
});

test('a game round-trips through the database', async () => {
	const g = createGame(freshId(), RULES, { id: 'p0', name: 'P0' }, [...ITEMS]);
	await createGameRow(g, 1);
	const back = await loadGame(g.id);
	assert.equal(back?.id, g.id);
	assert.equal(back?.players[0].name, 'P0');
});

test('squads saved as bare strings are upgraded on read', async () => {
	const g = createGame(freshId(), RULES, { id: 'p0', name: 'P0' }, [...ITEMS]);
	// simulate a pre-price row
	(g.players[0] as unknown as { squad: string[] }).squad = ['Darth Vader'];
	await createGameRow(g, 1);
	const back = await loadGame(g.id);
	assert.deepEqual(back?.players[0].squad, [{ item: 'Darth Vader', price: 0 }]);
});

// The reason this whole layer moved off SQLite's synchronous driver. With a plain
// load → mutate → save over the network, these interleave and writes get lost.
test('concurrent mutations on one game never lose a write', async () => {
	const g = createGame(freshId(), RULES, { id: 'p0', name: 'P0' }, [...ITEMS]);
	await createGameRow(g, 1);
	const base = g.log.length;

	const N = 25;
	await Promise.all(
		Array.from({ length: N }, (_, i) => withGame(g.id, (s) => s.log.push(`move-${i}`)))
	);

	const after = await loadGame(g.id);
	assert.equal(after!.log.length, base + N, 'every concurrent write must survive');
	const seen = new Set(after!.log.slice(base));
	assert.equal(seen.size, N, 'no write may be duplicated or dropped');
});

test('players joining at the same instant all get a seat', async () => {
	const g = createGame(freshId(), RULES, { id: 'p0', name: 'P0' }, [...ITEMS]);
	await createGameRow(g, 1);

	await Promise.all(
		['p1', 'p2', 'p3'].map((id) => withGame(g.id, (s) => join(s, { id, name: id.toUpperCase() }, 0)))
	);

	const after = await loadGame(g.id);
	assert.deepEqual(
		after!.players.map((p) => p.id).sort(),
		['p0', 'p1', 'p2', 'p3'],
		'a lost update would drop a player from the lobby'
	);
});

test('simultaneous bids are serialised, not clobbered', async () => {
	const g = createGame(freshId(), RULES, { id: 'p0', name: 'P0' }, [...ITEMS]);
	join(g, { id: 'p1', name: 'P1' }, 0);
	join(g, { id: 'p2', name: 'P2' }, 0);
	join(g, { id: 'p3', name: 'P3' }, 0); // 4 players → game starts
	await createGameRow(g, 1);

	// Everyone hammers the same round at once. Only the player on the clock can raise,
	// but every attempt must be applied against fresh state, never a stale copy.
	await Promise.all(
		['p0', 'p1', 'p2', 'p3'].map((pid) =>
			withGame(g.id, (s) => act(s, pid, { type: 'raise', amount: 5 }, 0))
		)
	);

	const after = await loadGame(g.id);
	const spent = after!.players.reduce((t, p) => t + (RULES.budget - p.budget), 0);
	const won = after!.players.reduce((t, p) => t + p.squad.length, 0);
	// Money only leaves a wallet when an item is won, and vice versa.
	assert.equal(spent > 0, won > 0, 'budget and squads must agree after concurrent bids');
	assert.ok(after!.players.every((p) => p.budget >= 0), 'nobody may go negative');
});

test('rolling back a failed mutation leaves the game untouched', async () => {
	const g = createGame(freshId(), RULES, { id: 'p0', name: 'P0' }, [...ITEMS]);
	await createGameRow(g, 1);
	const before = await loadGame(g.id);

	await assert.rejects(
		withGame(g.id, (s) => {
			s.log.push('should not persist');
			throw new Error('boom');
		}),
		/boom/
	);

	const after = await loadGame(g.id);
	assert.deepEqual(after!.log, before!.log);
});

test('withGame on a missing game returns null', async () => {
	assert.equal(await withGame('nope-not-a-game', () => {}), null);
});

// ── drafts ────────────────────────────────────────────────────────────────────

test('publishing twice under one title yields distinct ids', async () => {
	const owner = freshId();
	const title = `Dup ${owner}`;
	const a = await createDraft({ title, category: 'Movies/TV', items: [{ n: 'x' }], author: 'A', owner, now: Date.now() });
	const b = await createDraft({ title, category: 'Movies/TV', items: [{ n: 'x' }], author: 'A', owner, now: Date.now() });
	assert.notEqual(a, b, 'the second publish must not return the first draft');
	assert.ok(await deleteDraft(a, owner));
	assert.ok(await deleteDraft(b, owner));
});

test('votes tally, toggle off, and vanish with the draft', async () => {
	const owner = freshId();
	const id = await createDraft({ title: `Votes ${owner}`, category: 'Sports', items: [{ n: 'x' }], author: 'A', owner, now: Date.now() });

	await voteDraft(id, 'voter-1', 1);
	await voteDraft(id, 'voter-2', -1);
	let d = await getDraft(id, 'voter-1');
	assert.equal(d?.up, 1);
	assert.equal(d?.down, 1);
	assert.equal(d?.myVote, 1);
	assert.equal(d?.mine, false, 'a different browser does not own it');

	await voteDraft(id, 'voter-1', 0);
	d = await getDraft(id, 'voter-1');
	assert.equal(d?.up, 0);
	assert.equal(d?.myVote, 0);

	assert.equal(await deleteDraft(id, 'someone-else'), false, 'only the owner may delete');
	assert.equal(await deleteDraft(id, owner), true);
	assert.equal(await getDraft(id), null);
});

test('listDrafts filters by category and search, and only shows your own under "mine"', async () => {
	const owner = freshId();
	const id = await createDraft({ title: `Zzz Unique ${owner}`, category: 'Food', items: [{ n: 'x' }], author: 'A', owner, now: Date.now() });

	const byQuery = await listDrafts({ pid: owner, q: `Zzz Unique ${owner}` });
	assert.equal(byQuery.length, 1);
	assert.equal(byQuery[0].id, id);

	const wrongCat = await listDrafts({ pid: owner, category: 'Sports', q: `Zzz Unique ${owner}` });
	assert.equal(wrongCat.length, 0);

	const mine = await listDrafts({ pid: owner, sort: 'mine' });
	assert.ok(mine.every((d) => d.mine), 'mine must only return drafts you own');
	assert.ok(mine.some((d) => d.id === id));

	const seeded = await listDrafts({ pid: 'nobody', sort: 'mine' });
	assert.equal(seeded.length, 0, 'built-ins have no owner');

	await deleteDraft(id, owner);
});

// Every sort must actually execute. `top` ordered by `(up - down)` — an expression over
// output aliases, which SQLite accepts and Postgres rejects — and only running it catches that.
test('every whitelisted sort runs against the real database', async () => {
	for (const sort of ['popular', 'top', 'new', 'mine']) {
		const rows = await listDrafts({ pid: 'nobody', sort });
		assert.ok(Array.isArray(rows), `sort=${sort} must return rows`);
		if (sort !== 'mine') assert.ok(rows.length > 0, `sort=${sort} should list the built-ins`);
	}
});

test('top sort ranks by net votes', async () => {
	const owner = freshId();
	const id = await createDraft({ title: `Top ${owner}`, category: 'Music', items: [{ n: 'x' }], author: 'A', owner, now: Date.now() });
	for (let i = 0; i < 5; i++) await voteDraft(id, `${owner}-voter-${i}`, 1);

	const rows = await listDrafts({ pid: owner, sort: 'top' });
	const mine = rows.find((r) => r.id === id);
	assert.equal(mine?.up, 5);
	const ahead = rows.slice(0, rows.findIndex((r) => r.id === id));
	assert.ok(ahead.every((r) => r.up - r.down >= 5), 'nothing with a lower net score may rank above it');
	await deleteDraft(id, owner);
});

test('an unknown sort falls back to popular instead of injecting SQL', async () => {
	const rows = await listDrafts({ pid: 'x', sort: 'popular; DROP TABLE drafts' });
	assert.ok(rows.length > 0, 'still returns the built-ins');
});
