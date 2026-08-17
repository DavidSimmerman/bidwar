<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { CATEGORIES, CAT_HUE, LIMITS, type Category } from '$lib/drafts';

	let title = $state('');
	let category = $state<Category>('Movies/TV');
	let items = $state<string[]>([]);
	let entry = $state('');
	let bulk = $state(false);
	let bulkText = $state('');
	let author = $state('');
	let saving = $state(false);
	let err = $state('');
	let entryEl = $state<HTMLInputElement>();
	let listEl = $state<HTMLDivElement>();

	onMount(() => (author = localStorage.getItem('bw_name') ?? ''));

	const norm = (s: string) => s.trim().slice(0, LIMITS.item);
	const dupe = (s: string) => items.some((i) => i.toLowerCase() === s.toLowerCase());
	const ready = $derived(title.trim().length > 0 && items.length >= LIMITS.minItems);

	async function add() {
		const v = norm(entry);
		if (!v) return;
		if (dupe(v)) {
			err = `“${v}” is already in there`;
			return;
		}
		if (items.length >= LIMITS.maxItems) {
			err = `${LIMITS.maxItems} items max`;
			return;
		}
		items = [...items, v];
		entry = '';
		err = '';
		await tick();
		listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
		entryEl?.focus();
	}

	function addBulk() {
		const added = bulkText.split('\n').map(norm).filter(Boolean);
		const merged = [...items];
		for (const v of added) {
			if (merged.length >= LIMITS.maxItems) break;
			if (!merged.some((i) => i.toLowerCase() === v.toLowerCase())) merged.push(v);
		}
		const skipped = added.length - (merged.length - items.length);
		items = merged;
		bulkText = '';
		bulk = false;
		err = skipped > 0 ? `${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : '';
	}

	const remove = (i: number) => (items = items.filter((_, n) => n !== i));

	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= items.length) return;
		const next = [...items];
		[next[i], next[j]] = [next[j], next[i]];
		items = next;
	}

	async function publish() {
		if (!ready || saving) return;
		saving = true;
		err = '';
		try {
			const res = await fetch('/api/drafts', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: title.trim(), category, items, author })
			});
			if (!res.ok) throw new Error(await res.text());
			const { id } = await res.json();
			goto(`/setup/${id}`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Could not publish';
			saving = false;
		}
	}
</script>

<div class="min-h-screen" style="background:#0a0a0c; font-family:'Archivo',sans-serif">
	<div class="w-full max-w-[440px] lg:max-w-[980px] mx-auto px-4 lg:px-8 pb-10">
		<div class="pt-6 pb-4 lg:pt-10 lg:pb-8 flex items-center justify-between">
			<div>
				<div class="text-[10px] tracking-[0.4em] text-white/40 lg:text-[12px]">CREATE A</div>
				<div style="font-style:italic;font-weight:900;line-height:1" class="text-white text-[30px] lg:text-[56px]">
					DRAFT
				</div>
			</div>
			<a href="/" class="text-[11px] tracking-widest font-bold lg:text-[13px]" style="color:#5b8cff">‹ MARKET</a>
		</div>

		<!-- Desktop: details on the left, the item list gets its own column on the right. -->
		<div class="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
		<div>
		<!-- live preview of the market tile -->
		<div class="flex items-center gap-3 mb-5">
			<div class="w-[120px] rounded-xl overflow-hidden shrink-0" style="background:#0e0e18;border:1px solid #23233a">
				<div
					class="h-[62px] p-2 flex items-end"
					style="background:linear-gradient(140deg,{CAT_HUE[category]}dd,{CAT_HUE[category]}22)"
				>
					<div style="font-style:italic;font-weight:900;font-size:12px;line-height:1.05" class="text-white drop-shadow">
						{title || 'Untitled'}
					</div>
				</div>
				<div class="p-1.5 text-[9px] text-white/35">{items.length} items · by {author || 'you'}</div>
			</div>
			<div class="text-[11px] text-white/30 leading-snug">Live preview —<br />your tile in the market.</div>
		</div>

		<!-- title -->
		<div class="text-[10px] tracking-[0.3em] text-white/40">TITLE</div>
		<input
			bind:value={title}
			maxlength={LIMITS.title}
			placeholder="What are people bidding over?"
			aria-label="Draft title"
			class="w-full rounded-xl px-3 py-2.5 mt-1.5 mb-4 outline-none"
			style="background:#0e0e18;border:1px solid #23233a;color:#fff;font-weight:700;font-size:15px"
		/>

		<!-- category -->
		<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">CATEGORY</div>
		<div class="flex flex-wrap gap-1.5 mb-4">
			{#each CATEGORIES as c}
				<button
					onclick={() => (category = c)}
					aria-pressed={category === c}
					class="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition active:scale-95"
					style={category === c
						? `background:${CAT_HUE[c]};color:#0b0b12`
						: 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.5)'}>{c}</button
				>
			{/each}
		</div>
		</div>

		<!-- items -->
		<div>
		<div class="flex items-baseline justify-between">
			<div class="text-[10px] tracking-[0.3em] text-white/40">ITEMS</div>
			<button onclick={() => (bulk = !bulk)} class="text-[10px] font-bold" style="color:#5b8cff"
				>{bulk ? '‹ one at a time' : 'paste a list ›'}</button
			>
		</div>

		{#if bulk}
			<textarea
				bind:value={bulkText}
				rows="6"
				placeholder="One per line…"
				aria-label="Paste items, one per line"
				class="w-full rounded-xl px-3 py-2.5 mt-1.5 text-[13px] outline-none resize-none"
				style="background:#0e0e18;border:1px solid #23233a;color:#fff"
			></textarea>
			<button
				onclick={addBulk}
				class="w-full mt-2 py-2 rounded-xl text-[12px] font-bold active:scale-95 transition"
				style="background:#16162a;color:#fff">ADD ALL</button
			>
		{:else}
			<div class="flex gap-2 mt-1.5">
				<input
					bind:this={entryEl}
					bind:value={entry}
					onkeydown={(e) => e.key === 'Enter' && add()}
					maxlength={LIMITS.item}
					placeholder="Add an item…"
					aria-label="Add an item"
					class="flex-1 rounded-xl px-3 py-2.5 text-[14px] outline-none"
					style="background:#0e0e18;border:1px solid #23233a;color:#fff"
				/>
				<button
					onclick={add}
					aria-label="Add item"
					class="w-11 shrink-0 rounded-xl text-xl font-black active:scale-90 transition"
					style="background:#5b8cff;color:#0b0b12">+</button
				>
			</div>
		{/if}

		<div bind:this={listEl} class="mt-2 space-y-1.5 max-h-[280px] lg:max-h-[440px] overflow-y-auto pr-1">
			{#each items as it, i (it)}
				<div
					animate:flip={{ duration: 160 }}
					class="flex items-center gap-2 rounded-lg px-2.5 py-2"
					style="background:#0e0e18;border:1px solid #23233a"
				>
					<span class="text-[11px] text-white/25 w-5 text-right">{i + 1}</span>
					<span class="flex-1 truncate text-[13px] text-white">{it}</span>
					<button
						onclick={() => move(i, -1)}
						disabled={i === 0}
						aria-label="Move {it} up"
						class="px-1 text-white/25 hover:text-white disabled:opacity-20 active:scale-90">▲</button
					>
					<button
						onclick={() => move(i, 1)}
						disabled={i === items.length - 1}
						aria-label="Move {it} down"
						class="px-1 text-white/25 hover:text-white disabled:opacity-20 active:scale-90">▼</button
					>
					<button
						onclick={() => remove(i)}
						aria-label="Remove {it}"
						class="px-1 text-white/25 hover:text-white active:scale-90">✕</button
					>
				</div>
			{/each}
		</div>

		<div class="text-[11px] mt-1.5" style="color:{items.length < LIMITS.minItems ? '#ff5f4d' : 'rgba(255,255,255,.25)'}">
			{items.length} / {LIMITS.maxItems} · need at least {LIMITS.minItems}
		</div>

		{#if err}<div class="text-[12px] text-center mt-2" style="color:#ff5f4d">{err}</div>{/if}

		<button
			onclick={publish}
			disabled={!ready || saving}
			class="press w-full mt-4 py-4 rounded-xl text-lg disabled:opacity-40"
			style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic"
			>{saving ? 'PUBLISHING…' : 'PUBLISH'}</button
		>
		<div class="text-center text-[11px] text-white/25 mt-2">
			Published as <b class="text-white/50">{author || 'you'}</b> · anyone can play it
		</div>
		</div>
		</div>
	</div>
</div>
