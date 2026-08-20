import Database from 'better-sqlite3';
import type { GameState } from '$lib/engine';
import { SEED, type Category, type Draft, type Item } from '$lib/drafts';

// One row per game; state is a JSON blob. Small state, no joins → no ORM, no migrations.
// Path is relative to the working directory by default, which is fine locally. In a
// container that lands inside the image and every redeploy wipes it — point BW_DB at a
// mounted volume (e.g. /data/bidwar.db) so drafts and games survive.
const db = new Database(process.env.BW_DB ?? 'bidwar.db');
db.pragma('journal_mode = WAL');
db.exec(`
	CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL);
	CREATE TABLE IF NOT EXISTS drafts (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		items TEXT NOT NULL,
		author TEXT NOT NULL,
		owner TEXT,
		plays INTEGER NOT NULL DEFAULT 0,
		created INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS draft_votes (
		draft_id TEXT NOT NULL,
		pid TEXT NOT NULL,
		v INTEGER NOT NULL,
		PRIMARY KEY (draft_id, pid)
	);
	CREATE INDEX IF NOT EXISTS drafts_cat ON drafts(category);
`);

const getStmt = db.prepare<[string], { state: string }>('SELECT state FROM games WHERE id = ?');
const putStmt = db.prepare(
	`INSERT INTO games (id, state, updated) VALUES (?, ?, ?)
	 ON CONFLICT(id) DO UPDATE SET state = excluded.state, updated = excluded.updated`
);

export function loadGame(id: string): GameState | null {
	const row = getStmt.get(id);
	if (!row) return null;
	const s = JSON.parse(row.state) as GameState;
	// Games saved before squads carried a price stored bare item names. Upgrade them on
	// read so a game in flight across a deploy doesn't render undefined everywhere.
	for (const p of s.players)
		p.squad = p.squad.map((x) => (typeof x === 'string' ? { item: x, price: 0 } : x));
	return s;
}

// ponytail: better-sqlite3 is synchronous and Node is single-threaded, so a caller's
// load→mutate→save (no await between) is atomic. Safe for a single-process 2-player game.
export function saveGame(s: GameState, now: number) {
	putStmt.run(s.id, JSON.stringify(s), now);
}

// ── drafts ────────────────────────────────────────────────────────────────────

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const insertDraft = db.prepare(
	`INSERT OR IGNORE INTO drafts (id, title, category, items, author, owner, plays, created)
	 VALUES (@id, @title, @category, @items, @author, @owner, 0, @created)`
);

// Built-ins load once, in curated order (rowid doubles as the tiebreak for "Popular").
db.transaction(() => {
	SEED.forEach((s, i) =>
		insertDraft.run({
			id: slug(s.title),
			title: s.title,
			category: s.category,
			items: JSON.stringify(s.items.map((n) => ({ n }))),
			author: 'Bid War',
			owner: null,
			created: 1_700_000_000_000 + i // fixed, so re-seeding never reshuffles "New"
		})
	);
})();

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
// up/down onto the row if the market ever outgrows that.
const SELECT = `
	SELECT d.*,
		(SELECT COUNT(*) FROM draft_votes WHERE draft_id = d.id AND v = 1) AS up,
		(SELECT COUNT(*) FROM draft_votes WHERE draft_id = d.id AND v = -1) AS down,
		(SELECT v FROM draft_votes WHERE draft_id = d.id AND pid = @pid) AS myVote
	FROM drafts d`;

// Whitelisted, never interpolated from user input.
const ORDER: Record<string, string> = {
	popular: 'd.plays DESC, d.rowid ASC',
	top: '(up - down) DESC, d.plays DESC',
	new: 'd.created DESC',
	mine: 'd.created DESC'
};

const sortOk = (s: string) => Object.prototype.hasOwnProperty.call(ORDER, s);

export function listDrafts(opts: {
	pid: string;
	sort?: string;
	category?: string;
	q?: string;
}): Draft[] {
	const sort = opts.sort && sortOk(opts.sort) ? opts.sort : 'popular';
	const where: string[] = [];
	if (opts.category) where.push('d.category = @category');
	if (opts.q) where.push('d.title LIKE @like');
	if (sort === 'mine') where.push('d.owner = @pid');

	const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${ORDER[sort]} LIMIT 200`;
	const rows = db.prepare(sql).all({
		pid: opts.pid,
		category: opts.category ?? null,
		like: opts.q ? `%${opts.q}%` : null
	}) as Row[];
	return rows.map((r) => hydrate(r, opts.pid));
}

export function getDraft(id: string, pid = ''): Draft | null {
	const row = db.prepare(`${SELECT} WHERE d.id = @id`).get({ id, pid }) as Row | undefined;
	return row ? hydrate(row, pid) : null;
}

export function createDraft(d: {
	title: string;
	category: Category;
	items: Item[];
	author: string;
	owner: string;
	now: number;
}): string {
	const base = slug(d.title) || 'draft';
	const row = {
		id: base,
		title: d.title,
		category: d.category,
		items: JSON.stringify(d.items),
		author: d.author,
		owner: d.owner,
		created: d.now
	};
	// Take the first id that actually inserts. Checking `changes` (rather than a
	// prior SELECT) is what makes this safe: INSERT OR IGNORE no-ops on a taken id,
	// and returning that id would hand the user someone else's draft.
	for (let n = 0; n < 100; n++) {
		row.id = n === 0 ? base : `${base}-${n}`;
		if (insertDraft.run(row).changes === 1) return row.id;
	}
	throw new Error(`too many drafts named “${d.title}”`);
}

/** Publishes per owner in the last hour — cheap spam brake on an unauthenticated endpoint. */
export const recentDraftCount = (owner: string, since: number): number =>
	(db.prepare('SELECT COUNT(*) AS n FROM drafts WHERE owner = ? AND created > ?').get(owner, since) as { n: number }).n;

export const bumpPlays = (id: string) => db.prepare('UPDATE drafts SET plays = plays + 1 WHERE id = ?').run(id);

export function voteDraft(id: string, pid: string, v: 1 | -1 | 0) {
	if (v === 0) db.prepare('DELETE FROM draft_votes WHERE draft_id = ? AND pid = ?').run(id, pid);
	else
		db.prepare(
			`INSERT INTO draft_votes (draft_id, pid, v) VALUES (?, ?, ?)
			 ON CONFLICT(draft_id, pid) DO UPDATE SET v = excluded.v`
		).run(id, pid, v);
}

// Votes go with the draft — otherwise a later draft that reuses the freed id
// would inherit the dead one's tallies.
export const deleteDraft = db.transaction((id: string, owner: string): boolean => {
	const gone = db.prepare('DELETE FROM drafts WHERE id = ? AND owner = ?').run(id, owner).changes > 0;
	if (gone) db.prepare('DELETE FROM draft_votes WHERE draft_id = ?').run(id);
	return gone;
});
