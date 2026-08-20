import { pgTable, text, integer, bigint, smallint, index, primaryKey } from 'drizzle-orm/pg-core';

// One row per game; state is a JSON blob. Small state, no joins → no relations.
// `version` is bumped on every save so a concurrent write can be detected.
export const games = pgTable('games', {
	id: text('id').primaryKey(),
	state: text('state').notNull(),
	updated: bigint('updated', { mode: 'number' }).notNull(),
	version: integer('version').notNull().default(0)
});

export const drafts = pgTable(
	'drafts',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		category: text('category').notNull(),
		items: text('items').notNull(),
		author: text('author').notNull(),
		owner: text('owner'),
		plays: integer('plays').notNull().default(0),
		created: bigint('created', { mode: 'number' }).notNull()
	},
	(t) => [index('drafts_cat').on(t.category)]
);

export const draftVotes = pgTable(
	'draft_votes',
	{
		draftId: text('draft_id').notNull(),
		pid: text('pid').notNull(),
		v: smallint('v').notNull()
	},
	(t) => [primaryKey({ columns: [t.draftId, t.pid] })]
);
