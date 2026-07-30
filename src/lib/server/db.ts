import Database from 'better-sqlite3';
import type { GameState } from '$lib/engine';

// One row per game; state is a JSON blob. Small state, no joins → no ORM, no migrations.
const db = new Database('bidwar.db');
db.pragma('journal_mode = WAL');
db.exec(
	`CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL)`
);

const getStmt = db.prepare<[string], { state: string }>('SELECT state FROM games WHERE id = ?');
const putStmt = db.prepare(
	`INSERT INTO games (id, state, updated) VALUES (?, ?, ?)
	 ON CONFLICT(id) DO UPDATE SET state = excluded.state, updated = excluded.updated`
);

export function loadGame(id: string): GameState | null {
	const row = getStmt.get(id);
	return row ? (JSON.parse(row.state) as GameState) : null;
}

// ponytail: better-sqlite3 is synchronous and Node is single-threaded, so a caller's
// load→mutate→save (no await between) is atomic. Safe for a single-process 2-player game.
export function saveGame(s: GameState, now: number) {
	putStmt.run(s.id, JSON.stringify(s), now);
}
