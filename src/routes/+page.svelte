<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import NameGate from '$lib/NameGate.svelte';
	import { CATEGORIES, CAT_HUE, type Draft } from '$lib/drafts';

	let { data } = $props();

	// Votes applied locally on top of the server list, so a tap is instant and
	// still ends up showing the server's tally.
	type Tally = { up: number; down: number; myVote: 1 | -1 | 0 };
	let voted = $state<Record<string, Tally>>({});
	const drafts = $derived<Draft[]>(data.drafts.map((d) => ({ ...d, ...voted[d.id] })));

	let name = $state('');
	let nameGate = $state(false);

	const SORTS: [string, string][] = [
		['popular', 'Popular'],
		['top', 'Top rated'],
		['new', 'New'],
		['mine', 'Mine']
	];

	// Filters are plain links — SvelteKit reruns the load, so back/forward and
	// shareable URLs work for free and there's no client-side fetching to keep in sync.
	function href(patch: Record<string, string | null>) {
		const p = new URLSearchParams(page.url.searchParams);
		for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
		const s = p.toString();
		return s ? `?${s}` : '/';
	}

	const k = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));

	async function vote(d: Draft, v: 1 | -1) {
		const next = d.myVote === v ? 0 : v;
		const res = await fetch(`/api/drafts/${d.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ v: next })
		});
		if (!res.ok) return;
		voted[d.id] = (await res.json()) as Tally; // server is the source of truth for the tallies
	}

	async function remove(d: Draft) {
		if (!confirm(`Delete “${d.title}”? This can't be undone.`)) return;
		const res = await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}
</script>

<div class="min-h-screen" style="background:#0a0a0c; font-family:'Archivo',sans-serif">
	<div class="w-full max-w-[440px] mx-auto px-4 pb-10">
		<!-- header -->
		<div class="flex items-end justify-between pt-6 pb-3">
			<div>
				<div class="text-[10px] tracking-[0.4em] text-white/40">PICK YOUR</div>
				<div style="font-style:italic;font-weight:900;font-size:34px;line-height:1" class="text-white">DRAFT</div>
			</div>
			<a
				href="/new"
				class="press rounded-xl px-3 py-2 text-[12px]"
				style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">+ NEW</a
			>
		</div>

		<!-- search (native GET form: no JS needed) -->
		<form data-sveltekit-keepfocus class="pb-3">
			{#if data.category}<input type="hidden" name="category" value={data.category} />{/if}
			{#if data.sort !== 'popular'}<input type="hidden" name="sort" value={data.sort} />{/if}
			<input
				name="q"
				value={data.q}
				placeholder="Search drafts…"
				aria-label="Search drafts"
				class="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
				style="background:#0e0e18;border:1px solid #23233a;color:#fff"
			/>
		</form>

		<!-- categories -->
		<div class="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4">
			<a
				href={href({ category: null })}
				class="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap transition active:scale-95"
				style={!data.category
					? 'background:#fff;color:#0b0b12'
					: 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.55)'}>All</a
			>
			{#each CATEGORIES as c}
				<a
					href={href({ category: c })}
					class="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap transition active:scale-95"
					style={data.category === c
						? `background:${CAT_HUE[c]};color:#0b0b12`
						: 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.55)'}>{c}</a
				>
			{/each}
		</div>

		<!-- sort -->
		<div class="flex items-center justify-between pb-3">
			<div class="flex gap-1.5">
				{#each SORTS as [key, label]}
					<a
						href={href({ sort: key })}
						class="rounded-lg px-2 py-1 text-[10px] font-bold transition active:scale-95"
						style={data.sort === key ? 'background:#fff;color:#0b0b12' : 'color:rgba(255,255,255,.4)'}>{label}</a
					>
				{/each}
			</div>
			<div class="text-[10px] text-white/25">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</div>
		</div>

		<!-- grid -->
		<div class="grid grid-cols-2 gap-3">
			{#each drafts as d (d.id)}
				<div class="rounded-xl overflow-hidden" style="background:#0e0e18;border:1px solid #23233a">
					<a href="/setup/{d.id}" class="block">
						<div
							class="h-[76px] p-2.5 flex items-end relative"
							style="background:linear-gradient(140deg,{CAT_HUE[d.category]}dd,{CAT_HUE[d.category]}22)"
						>
							<div
								class="absolute top-2 right-2 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
								style="background:rgba(0,0,0,.45);color:#fff"
							>
								{d.items.length}
							</div>
							<div style="font-style:italic;font-weight:900;font-size:15px;line-height:1.05" class="text-white drop-shadow">
								{d.title}
							</div>
						</div>
					</a>
					<div class="p-2.5">
						<div class="flex items-center gap-1">
							<div class="text-[10px] text-white/35 truncate flex-1">{d.items.length} items · by {d.author}</div>
							{#if d.mine}
								<button
									onclick={() => remove(d)}
									aria-label="Delete {d.title}"
									class="text-[10px] text-white/25 hover:text-white active:scale-90 shrink-0">✕</button
								>
							{/if}
						</div>
						<div class="flex items-center justify-between mt-2">
							<div class="text-[11px] font-bold text-white/60">▶ {k(d.plays)}</div>
							<div class="flex items-center gap-1">
								<button
									onclick={() => vote(d, 1)}
									aria-label="Rate {d.title} good"
									aria-pressed={d.myVote === 1}
									class="rounded px-1.5 py-0.5 text-[10px] transition active:scale-90"
									style={d.myVote === 1
										? 'background:#35d07f;color:#0b0b12'
										: 'background:#16162a;color:rgba(255,255,255,.45)'}>👍 {k(d.up)}</button
								>
								<button
									onclick={() => vote(d, -1)}
									aria-label="Rate {d.title} bad"
									aria-pressed={d.myVote === -1}
									class="rounded px-1.5 py-0.5 text-[10px] transition active:scale-90"
									style={d.myVote === -1
										? 'background:#ff5f4d;color:#fff'
										: 'background:#16162a;color:rgba(255,255,255,.45)'}>👎</button
								>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if !drafts.length}
			<div class="text-center py-14 text-[13px] text-white/30">
				Nothing here yet —
				<a href="/new" style="color:#5b8cff" class="font-bold">make the first one</a>
			</div>
		{/if}
	</div>
</div>

<NameGate bind:name bind:open={nameGate} />
