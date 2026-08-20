import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql, eq, and } from 'drizzle-orm';
import type { GameState } from '../engine.ts';
import { SEED, type Category, type Draft, type Item } from '../drafts.ts';
import { games, drafts, draftVotes } from './schema.ts';

const DEFAULT_URL = 'postgres://bidwar:bidwar@127.0.0.1:5432/bidwar';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? DEFAULT_URL });
export const db = drizzle(pool, { schema: { games, drafts, draftVotes } });

/** Apply pending migrations, then load the built-in drafts. Idempotent; run once on boot. */
export async function initDb() {
	await migrate(db, { migrationsFolder: process.env.BW_MIGRATIONS ?? 'drizzle' });
	await seed();
}

// Built-ins load once, in curated order. `created` is fixed and monotonic so re-seeding
// never reshuffles "New" — and it doubles as the stable tiebreak for "Popular", which is
// what SQLite's rowid used to do.
async function seed() {
	const rows = SEED.map((s, i) => ({
		id: slug(s.title),
		title: s.title,
		category: s.category,
		items: JSON.stringify(s.items.map((n) => ({ n }))),
		author: 'Bid War',
		owner: null,
		created: 1_700_000_000_000 + i
	}));
	await db.insert(drafts).values(rows).onConflictDoNothing();
}

// ── games ─────────────────────────────────────────────────────────────────────

function parseState(raw: string): GameState {
	const s = JSON.parse(raw) as GameState;
	// Games saved before squads carried a price stored bare item names. Upgrade them on
	// read so a game in flight across a deploy doesn't render undefined everywhere.
	for (const p of s.players)
		p.squad = p.squad.map((x) => (typeof x === 'string' ? { item: x, price: 0 } : x));
	return s;
}

/** Read-only view of a game. Use `withGame` for anything that mutates. */
export async function loadGame(id: string): Promise<GameState | null> {
	const [row] = await db.select({ state: games.state }).from(games).where(eq(games.id, id));
	return row ? parseState(row.state) : null;
}

/**
 * Locked read → mutate → write, in one transaction.
 *
 * The old SQLite driver was synchronous, so a caller's load/mutate/save could not
 * interleave. Over the network every step awaits, so two players bidding in the same
 * tick would both read the same state and the second write would clobber the first —
 * a bid silently vanishing. `SELECT … FOR UPDATE` serialises them on the row instead,
 * and callers can't forget to do it because there's no unlocked save to reach for.
 *
 * Returns null if the game doesn't exist. If `mutate` throws, the transaction rolls back.
 */
export async function withGame(
	id: string,
	mutate: (s: GameState) => void
): Promise<GameState | null> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ state: games.state, version: games.version })
			.from(games)
			.where(eq(games.id, id))
			.for('update');
		if (!row) return null;

		const state = parseState(row.state);
		mutate(state);

		await tx
			.update(games)
			.set({ state: JSON.stringify(state), updated: Date.now(), version: row.version + 1 })
			.where(eq(games.id, id));
		return state;
	});
}

/** Insert a brand new game. */
export async function createGameRow(s: GameState, now: number) {
	await db
		.insert(games)
		.values({ id: s.id, state: JSON.stringify(s), updated: now, version: 0 })
		.onConflictDoUpdate({
			target: games.id,
			set: { state: JSON.stringify(s), updated: now }
		});
}

// ── drafts ────────────────────────────────────────────────────────────────────

const slug = (t: string) =>
	t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

type Row = {
	id: string;
	title: string;
	category: string;
	items: string;
	author: string;
	owner: string | null;
	plays: number;
	up: number;
	down: number;
	myVote: number | null;
};

const hydrate = (r: Row, pid: string): Draft => ({
	id: r.id,
	title: r.title,
	category: r.category as Category,
	items: JSON.parse(r.items) as Item[],
	author: r.author,
	plays: r.plays,
	up: r.up,
	down: r.down,
	mine: r.owner === pid,
	myVote: (r.myVote ?? 0) as 1 | -1 | 0
});

// Vote tallies are counted live. ponytail: fine to a few thousand drafts; denormalise
// up/down onto the row if the market ever outgrows that. COUNT is bigint in Postgres and
// comes back as a string, hence the ::int casts.
const SELECT = (pid: string) => sql`
	SELECT d.*,
		(SELECT COUNT(*) FROM draft_votes WHERE draft_id = d.id AND v = 1)::int AS up,
		(SELECT COUNT(*) FROM draft_votes WHERE draft_id = d.id AND v = -1)::int AS down,
		(SELECT v FROM draft_votes WHERE draft_id = d.id AND pid = ${pid}) AS "myVote"
	FROM drafts d`;

// Whitelisted, never interpolated from user input. Applied by the OUTER query below, so
// these name the projected columns rather than `d.*`: Postgres allows an output alias as a
// bare ORDER BY term but not inside an expression like `(up - down)`, which SQLite did.
// `created ASC` is the curated-order tiebreak that SQLite got from rowid.
const ORDER: Record<string, string> = {
	popular: 'plays DESC, created ASC',
	top: '(up - down) DESC, plays DESC',
	new: 'created DESC',
	mine: 'created DESC'
};

const sortOk = (s: string) => Object.prototype.hasOwnProperty.call(ORDER, s);

export async function listDrafts(opts: {
	pid: string;
	sort?: string;
	category?: string;
	q?: string;
}): Promise<Draft[]> {
	const sort = opts.sort && sortOk(opts.sort) ? opts.sort : 'popular';
	const where = [];
	if (opts.category) where.push(sql`d.category = ${opts.category}`);
	if (opts.q) where.push(sql`d.title ILIKE ${`%${opts.q}%`}`);
	if (sort === 'mine') where.push(sql`d.owner = ${opts.pid}`);

	const q = sql`SELECT * FROM (
			${SELECT(opts.pid)}
			${where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``}
		) t
		ORDER BY ${sql.raw(ORDER[sort])}
		LIMIT 200`;

	const res = await db.execute(q);
	return (res.rows as Row[]).map((r) => hydrate(r, opts.pid));
}

export async function getDraft(id: string, pid = ''): Promise<Draft | null> {
	const res = await db.execute(sql`${SELECT(pid)} WHERE d.id = ${id}`);
	const row = (res.rows as Row[])[0];
	return row ? hydrate(row, pid) : null;
}

export async function createDraft(d: {
	title: string;
	category: Category;
	items: Item[];
	author: string;
	owner: string;
	now: number;
}): Promise<string> {
	const base = slug(d.title) || 'draft';
	// Take the first id that actually inserts. Checking what came back (rather than a
	// prior SELECT) is what makes this safe: DO NOTHING no-ops on a taken id, and
	// returning that id would hand the user someone else's draft.
	for (let n = 0; n < 100; n++) {
		const id = n === 0 ? base : `${base}-${n}`;
		const inserted = await db
			.insert(drafts)
			.values({
				id,
				title: d.title,
				category: d.category,
				items: JSON.stringify(d.items),
				author: d.author,
				owner: d.owner,
				created: d.now
			})
			.onConflictDoNothing()
			.returning({ id: drafts.id });
		if (inserted.length === 1) return id;
	}
	throw new Error(`too many drafts named “${d.title}”`);
}

/** Publishes per owner in the last hour — cheap spam brake on an unauthenticated endpoint. */
export async function recentDraftCount(owner: string, since: number): Promise<number> {
	const res = await db.execute(
		sql`SELECT COUNT(*)::int AS n FROM drafts WHERE owner = ${owner} AND created > ${since}`
	);
	return (res.rows[0] as { n: number }).n;
}

export async function bumpPlays(id: string) {
	await db
		.update(drafts)
		.set({ plays: sql`${drafts.plays} + 1` })
		.where(eq(drafts.id, id));
}

export async function voteDraft(id: string, pid: string, v: 1 | -1 | 0) {
	if (v === 0) {
		await db.delete(draftVotes).where(and(eq(draftVotes.draftId, id), eq(draftVotes.pid, pid)));
		return;
	}
	await db
		.insert(draftVotes)
		.values({ draftId: id, pid, v })
		.onConflictDoUpdate({ target: [draftVotes.draftId, draftVotes.pid], set: { v } });
}

// Votes go with the draft — otherwise a later draft that reuses the freed id
// would inherit the dead one's tallies.
export async function deleteDraft(id: string, owner: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const gone = await tx
			.delete(drafts)
			.where(and(eq(drafts.id, id), eq(drafts.owner, owner)))
			.returning({ id: drafts.id });
		if (!gone.length) return false;
		await tx.delete(draftVotes).where(eq(draftVotes.draftId, id));
		return true;
	});
}
