// Run: node --test src/lib/drafts.test.ts   (Node 24 strips types natively)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanItems, isCategory, LIMITS, SEED, CATEGORIES } from './drafts.ts';

test('cleanItems drops blanks and case-insensitive dupes', () => {
	const out = cleanItems(['Pizza', '  pizza ', '', '   ', 'Tacos', 'Fries', 'Wings']);
	assert.deepEqual(
		out?.map((i) => i.n),
		['Pizza', 'Tacos', 'Fries', 'Wings']
	);
});

test('cleanItems rejects anything under the minimum', () => {
	assert.equal(cleanItems(['a', 'b', 'c']), null);
	assert.equal(cleanItems([]), null);
	assert.equal(cleanItems('not an array'), null);
	assert.equal(cleanItems(null), null);
	// dupes collapsing below the minimum is still a rejection
	assert.equal(cleanItems(['a', 'A', 'b', 'B', 'c']), null);
});

test('cleanItems caps length and count', () => {
	const long = 'x'.repeat(200);
	assert.equal(cleanItems([long, 'b', 'c', 'd'])![0].n.length, LIMITS.item);

	const many = Array.from({ length: LIMITS.maxItems + 50 }, (_, i) => `item ${i}`);
	assert.equal(cleanItems(many)!.length, LIMITS.maxItems);
});

test('cleanItems accepts the {n} object form it stores', () => {
	const out = cleanItems([{ n: 'Pizza' }, { n: 'Tacos' }, { n: 'Fries' }, { n: 'Wings' }]);
	assert.equal(out?.length, 4);
});

test('isCategory refuses anything off the list', () => {
	assert.ok(isCategory('Sports'));
	assert.ok(!isCategory('sports'));
	assert.ok(!isCategory('Anime'));
	assert.ok(!isCategory(null));
});

test('every seeded draft is playable and categorised', () => {
	for (const s of SEED) {
		assert.ok(isCategory(s.category), `${s.title} has category ${s.category}`);
		assert.ok(s.title.length <= LIMITS.title, `${s.title} title too long`);
		assert.ok(cleanItems(s.items), `${s.title} has too few usable items`);
		assert.equal(cleanItems(s.items)!.length, s.items.length, `${s.title} has dupes or blanks`);
	}
	// no duplicate titles → no id collisions on seed
	assert.equal(new Set(SEED.map((s) => s.title)).size, SEED.length);
	// every category has something in it
	for (const c of CATEGORIES) assert.ok(SEED.some((s) => s.category === c), `${c} is empty`);
});
