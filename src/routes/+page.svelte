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

	const motionOK = () =>
		typeof matchMedia === 'undefined' || !matchMedia('(prefers-reduced-motion: reduce)').matches;

	async function vote(d: Draft, v: 1 | -1, btn: HTMLButtonElement) {
		const next = d.myVote === v ? 0 : v;
		const res = await fetch(`/api/drafts/${d.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ v: next })
		});
		if (!res.ok) return;
		voted[d.id] = (await res.json()) as Tally; // server is the source of truth for the tallies

		// Punch the button itself rather than re-keying it: a {#key} would remount the
		// button and drop keyboard focus mid-vote.
		if (next !== 0 && motionOK())
			btn.animate([{ transform: 'scale(0.7)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], {
				duration: 350,
				easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)'
			});
	}

	async function remove(d: Draft) {
		if (!confirm(`Delete “${d.title}”? This can't be undone.`)) return;
		const res = await fetch(`/api/drafts/${d.id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}
</script>

<div class="min-h-screen" style="background:#0a0a0c; font-family:'Archivo',sans-serif">
	<!-- max-w must grow with the column count, or md's 3 columns get squeezed into the phone width -->
	<div class="w-full max-w-[440px] md:max-w-[720px] lg:max-w-[1180px] 2xl:max-w-[1500px] mx-auto px-4 lg:px-8 pb-10">
		<!-- header -->
		<div class="flex items-end justify-between pt-6 pb-3 lg:pt-10 lg:pb-6">
			<div>
				<div class="text-[10px] tracking-[0.4em] text-white/40 lg:text-[12px] smash-in">PICK YOUR</div>
				<div
					style="font-style:italic;font-weight:900;line-height:1;animation-delay:.06s"
					class="text-white text-[34px] lg:text-[64px] smash-in"
				>
					DRAFT
				</div>
			</div>
			<a
				href="/new"
				style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic;animation-delay:.14s"
				class="press smash-in rounded-xl px-3 py-2 text-[12px] lg:px-5 lg:py-3 lg:text-[15px]">+ NEW</a
			>
		</div>

		<!-- Desktop splits into sidebar + grid; mobile keeps everything stacked. -->
		<div class="lg:grid lg:grid-cols-[190px_1fr] lg:gap-8 lg:items-start">
			<!-- filters: scrolling chip rows on mobile, a sticky rail on desktop -->
			<div class="lg:sticky lg:top-6">
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
				<div class="hidden lg:block text-[10px] tracking-[0.3em] text-white/30 pb-2 pt-2">CATEGORY</div>
				<div class="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-col lg:overflow-visible">
					<a
						href={href({ category: null })}
						class="chip smash-left shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap lg:text-[13px] lg:py-2"
						style={!data.category
							? 'background:#fff;color:#0b0b12'
							: 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.55)'}>All</a
					>
					{#each CATEGORIES as c, i}
						<a
							href={href({ category: c })}
							class="chip smash-left shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap lg:text-[13px] lg:py-2"
							style="{data.category === c
								? `background:${CAT_HUE[c]};color:#0b0b12`
								: 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.55)'};animation-delay:{0.04 +
								i * 0.04}s">{c}</a
						>
					{/each}
				</div>

				<!-- sort -->
				<div class="hidden lg:block text-[10px] tracking-[0.3em] text-white/30 pb-2 pt-5">SORT</div>
				<div class="flex items-center justify-between pb-3 lg:flex-col lg:items-stretch lg:gap-1">
					<div class="flex gap-1.5 lg:flex-col">
						{#each SORTS as [key, label], i}
							<a
								href={href({ sort: key })}
								class="chip smash-left rounded-lg px-2 py-1 text-[10px] font-bold lg:text-[13px] lg:px-2.5 lg:py-2"
								style="{data.sort === key
									? 'background:#fff;color:#0b0b12'
									: 'color:rgba(255,255,255,.4)'};animation-delay:{0.28 + i * 0.04}s">{label}</a
							>
						{/each}
					</div>
					<div class="text-[10px] text-white/25 lg:pt-4">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</div>
				</div>
			</div>

			<!-- grid — re-keyed on the filter so the whole roster slams back in on every change -->
			{#key `${data.category}|${data.sort}|${data.q}`}
			<div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-5">
			{#each drafts as d, i (d.id)}
				<div
					class="tile smash-in rounded-xl overflow-hidden"
					style="background:#0e0e18;border:1px solid #23233a;--glow:{CAT_HUE[d.category]};animation-delay:{Math.min(
						i * 0.035,
						0.5
					)}s"
				>
					<a href="/setup/{d.id}" class="block">
						<div
							class="h-[76px] lg:h-[112px] p-2.5 lg:p-3.5 flex items-end relative"
							style="background:linear-gradient(140deg,{CAT_HUE[d.category]}dd,{CAT_HUE[d.category]}22)"
						>
							<div
								class="absolute top-2 right-2 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
								style="background:rgba(0,0,0,.45);color:#fff"
							>
								{d.items.length}
							</div>
							<div
								style="font-style:italic;font-weight:900;line-height:1.05"
								class="text-white drop-shadow text-[15px] lg:text-[19px]"
							>
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
									onclick={(e) => vote(d, 1, e.currentTarget)}
									aria-label="Rate {d.title} good"
									aria-pressed={d.myVote === 1}
									class="press rounded px-1.5 py-0.5 text-[10px]"
									style={d.myVote === 1
										? 'background:#35d07f;color:#0b0b12'
										: 'background:#16162a;color:rgba(255,255,255,.45)'}>👍 {k(d.up)}</button
								>
								<button
									onclick={(e) => vote(d, -1, e.currentTarget)}
									aria-label="Rate {d.title} bad"
									aria-pressed={d.myVote === -1}
									class="press rounded px-1.5 py-0.5 text-[10px]"
									style={d.myVote === -1
										? 'background:#ff5f4d;color:#fff'
										: 'background:#16162a;color:rgba(255,255,255,.45)'}>👎</button
								>
							</div>
						</div>
					</div>
				</div>
				{/each}

					{#if !drafts.length}
						<div class="col-span-full text-center py-14 text-[13px] text-white/30 smash-in">
							Nothing here yet —
							<a href="/new" style="color:#5b8cff" class="font-bold">make the first one</a>
						</div>
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>

<NameGate bind:name bind:open={nameGate} />
