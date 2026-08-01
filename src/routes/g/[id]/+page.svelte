<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import { page } from '$app/state';
	import SplitBackground from '$lib/SplitBackground.svelte';
	import type { GameView } from '$lib/engine';

	const id = page.params.id;
	let v = $state<GameView | null>(null);
	let notFound = $state(false);
	let joinName = $state('');
	let custom = $state('');
	let copied = $state(false);
	let showBoard = $state(false);
	let introDone = $state(false);
	let popup = $state<{ name: string; item: string; price: number; color: string } | null>(null);
	let lastRounds = -1;
	let introStarted = false;
	let popTimer: ReturnType<typeof setTimeout>;

	let deadlineAt = $state<number | null>(null);
	let nowMs = $state(Date.now());
	const msLeft = $derived(deadlineAt == null ? null : Math.max(0, deadlineAt - nowMs));

	// convenience derives
	const me = $derived(v?.players.find((p) => p.id === v!.youId) ?? null);
	const colors = $derived((v?.players ?? []).map((p) => p.color));

	function apply(view: GameView) {
		// pop a toast whenever a new round resolves with a winner
		const lr = view.lastResult;
		if (lastRounds >= 0 && view.roundsPlayed > lastRounds && lr?.winnerId) {
			const w = view.players.find((p) => p.id === lr.winnerId);
			popup = { name: lr.winnerName ?? 'Someone', item: lr.item, price: lr.price, color: w?.color ?? '#5b8cff' };
			clearTimeout(popTimer);
			popTimer = setTimeout(() => (popup = null), 2600);
		}
		lastRounds = view.roundsPlayed;
		v = view;
		deadlineAt = view.round?.msLeft != null ? Date.now() + view.round.msLeft : null;
	}

	// reveal the game UI only once the split intro has played (skip the wait for reduced-motion)
	$effect(() => {
		if (v?.status === 'active' && !introStarted) {
			introStarted = true;
			const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
			if (reduce) introDone = true;
			else setTimeout(() => (introDone = true), 1450);
		}
	});
	async function refresh() {
		try {
			const res = await fetch(`/api/game/${id}`);
			if (res.status === 404) return (notFound = true);
			if (res.ok) apply(await res.json());
		} catch {
			/* transient — next tick retries */
		}
	}
	async function send(body: Record<string, unknown>) {
		const res = await fetch(`/api/game/${id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (res.ok) apply(await res.json());
	}

	const join = () => send({ op: 'join', name: joinName.trim() || 'Player' });
	const startNow = () => send({ op: 'start' });
	const raise = (amount: number) => send({ op: 'raise', amount });
	const pass = () => send({ op: 'pass' });
	const take = () => send({ op: 'take' });
	const seal = (amount: number) => send({ op: 'seal', amount });

	function bidCustom() {
		const n = Math.floor(Number(custom));
		if (Number.isFinite(n) && n > 0) raise(n);
		custom = '';
	}
	function sealCustom() {
		const n = Math.floor(Number(custom));
		if (Number.isFinite(n) && n >= 0) seal(n);
		custom = '';
	}
	async function copyLink() {
		await navigator.clipboard.writeText(location.href);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
	function fmt(ms: number | null) {
		if (ms == null) return '∞';
		const s = Math.ceil(ms / 1000);
		if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	let pollId: ReturnType<typeof setInterval>;
	let tickId: ReturnType<typeof setInterval>;
	onMount(() => {
		joinName = localStorage.getItem('bw_name') ?? ''; // prefill from the name you set on the home page
		refresh();
		pollId = setInterval(refresh, 1000);
		tickId = setInterval(() => (nowMs = Date.now()), 400);
	});
	onDestroy(() => {
		clearInterval(pollId);
		clearInterval(tickId);
		clearTimeout(popTimer);
	});
</script>

<div class="relative min-h-screen text-white" style="background:#0a0a0c; font-family:'Archivo',sans-serif">
	{#if v && v.status === 'active' && v.players.length >= 2}
		<SplitBackground count={v.players.length} {colors} />
		<div class="absolute inset-0" style="background:rgba(10,10,12,.45)"></div>
	{/if}

	<div class="relative mx-auto w-full max-w-[440px] min-h-screen flex flex-col px-4">
		{#if notFound}
			<div class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
				<div style="font-style:italic;font-weight:900;font-size:26px">Game not found</div>
				<a href="/" style="color:#5b8cff" class="text-sm tracking-widest">START A NEW ONE →</a>
			</div>
		{:else if !v}
			<div class="flex-1 flex items-center justify-center text-white/40">loading…</div>

		{:else if !v.joined && v.status === 'lobby' && v.players.length < v.rules.players}
			<!-- JOIN -->
			<div class="flex-1 flex flex-col justify-center gap-4">
				<div class="text-center">
					<div class="text-[11px] tracking-[0.4em] text-white/50">YOU'RE INVITED TO A</div>
					<div style="font-style:italic;font-weight:900;font-size:40px">BID WAR</div>
				</div>
				<div class="text-center text-sm text-white/50">
					{v.rules.pool} · {v.rules.players} players · ${v.rules.budget} each · {v.rules.mode}
				</div>
				<input bind:value={joinName} maxlength="16" placeholder="your name"
					class="w-full rounded-xl px-4 py-3 text-lg outline-none" style="background:#0e0e18;border:1px solid #23233a;font-style:italic;font-weight:700" />
				<button onclick={join} class="w-full py-4 rounded-xl active:scale-95 transition" style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic;font-size:18px">JOIN THE WAR</button>
			</div>

		{:else if !v.joined}
			<div class="flex-1 flex flex-col items-center justify-center gap-2 text-center">
				<div style="font-style:italic;font-weight:900;font-size:24px">This game is full</div>
				<a href="/" style="color:#5b8cff" class="text-sm tracking-widest">START YOUR OWN →</a>
			</div>

		{:else if v.status === 'lobby'}
			<!-- LOBBY -->
			<div class="flex-1 flex flex-col justify-center gap-4 text-center">
				<div class="text-[11px] tracking-[0.4em] text-white/50">WAITING FOR PLAYERS · {v.players.length}/{v.rules.players}</div>
				<div class="space-y-2 stagger">
					{#each v.players as p}
						<div class="rounded-xl px-4 py-3 flex items-center justify-between" style="background:#0e0e18;border:1px solid {p.color}">
							<span style="font-style:italic;font-weight:900;color:{p.color}">{p.name}{p.id === v.youId ? ' (you)' : ''}</span>
							<span class="text-[11px] text-white/40 tracking-widest">IN</span>
						</div>
					{/each}
					{#each Array(v.rules.players - v.players.length) as _}
						<div class="rounded-xl px-4 py-3 text-white/25 text-sm" style="background:rgba(255,255,255,.03);border:1px dashed #23233a">empty seat</div>
					{/each}
				</div>
				<button onclick={copyLink} class="w-full py-4 rounded-xl active:scale-95 transition" style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">{copied ? 'COPIED ✓' : 'COPY INVITE LINK'}</button>
				{#if v.isHost && v.players.length >= 2}
					<button onclick={startNow} class="w-full py-3 rounded-xl text-sm tracking-[0.2em] font-bold" style="background:rgba(255,255,255,.08)">START NOW ({v.players.length})</button>
				{/if}
				<div class="text-[11px] text-white/25 break-all">{page.url.href}</div>
			</div>

		{:else if v.status === 'over'}
			<!-- RESULTS — no auto-winner; the crowd vote decides (that page is next) -->
			<div class="flex-1 flex flex-col py-6 gap-3">
				<div class="text-center">
					<div class="text-[11px] tracking-[0.4em] text-white/50">THE DRAFT IS DONE</div>
					<div style="font-style:italic;font-weight:900;font-size:30px">FINAL SQUADS</div>
					<div class="text-[12px] text-white/40">crowd voting to crown a winner — coming next</div>
				</div>
				<div class="flex-1 space-y-2 overflow-auto stagger">
					{#each v.players as p}
						<div class="rounded-2xl px-4 py-3" style="background:#0e0e18;border:1px solid {p.color}44">
							<div class="flex items-center justify-between">
								<span style="font-style:italic;font-weight:900;color:{p.color}">{p.name}{p.id === v.youId ? ' (you)' : ''}</span>
								<span class="text-[11px] text-white/40">${p.budget} left · {p.squad.length} drafted</span>
							</div>
							<div class="flex flex-wrap gap-1 mt-1.5">
								{#each p.squad as s}<span class="text-[11px] px-2 py-0.5 rounded" style="background:{p.color}22;color:{p.color}">{s}</span>{/each}
							</div>
						</div>
					{/each}
				</div>
				<a href="/" class="w-full py-4 rounded-xl text-center active:scale-95 transition" style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">NEW GAME</a>
			</div>

		{:else if v.round}
			{#if introDone}
			<div class="flex-1 flex flex-col" in:fly={{ y: 16, duration: 400 }}>
			<!-- ACTIVE ROUND -->
			<div class="pt-4 pb-3 text-center text-[11px] tracking-[0.3em] text-white/60">
				{v.rules.pool.toUpperCase()} · ROUND {v.roundsPlayed + 1}/{v.rules.rounds} · {v.round.mode.toUpperCase()}{v.round.solo ? ' · SOLO' : ''}
			</div>

			<!-- players -->
			<div class="grid grid-cols-2 gap-2 stagger">
				{#each v.players as p}
					{@const isLead = v.round.leaderId === p.id}
					{@const isTurn = v.round.turnId === p.id}
					<div class="rounded-xl px-3 py-2" style="background:rgba(14,14,24,.85);border:1px solid {isLead || isTurn ? p.color : '#23233a'}">
						<div class="flex items-center justify-between">
							<span class="truncate" style="font-style:italic;font-weight:900;color:{p.color}">{p.name}{p.id === v.youId ? '*' : ''}</span>
							<span class="text-sm font-bold">${p.budget}</span>
						</div>
						<div class="text-[10px] text-white/40 tracking-widest">
							{p.squad.length}{v.rules.spots != null ? `/${v.rules.spots}` : ''}
							{#if isLead}· <span style="color:{p.color}">LEADS</span>{:else if isTurn}· <span style="color:{p.color}">BIDDING</span>{:else if p.full}· FULL{:else if p.done}· OUT{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- item + bid -->
			<div class="flex-1 flex flex-col items-center justify-center">
				<div class="text-[10px] tracking-[0.3em] text-white/50 mb-1">ON THE BLOCK</div>
				{#key v.round.item}<div style="font-style:italic;font-weight:900;font-size:28px;text-align:center" class="mb-4 smash-in">{v.round.item}</div>{/key}
				{#if !v.round.solo}
					{@const leaderId = v.round.leaderId}
					{@const leadColor = v.players.find((p) => p.id === leaderId)?.color ?? '#3a3a4a'}
					<div class="w-32 h-32 rounded-full flex flex-col items-center justify-center ring-pulse" style="background:rgba(11,11,18,.85);border:3px solid {leadColor};--glow:{leadColor}">
						{#if v.round.mode === 'live'}
							{#key v.round.currentBid}<div class="punch" style="font-weight:900;font-style:italic;font-size:44px;line-height:1">${v.round.currentBid}</div>{/key}
							<div class="text-[9px] tracking-[0.2em] text-white/60">{v.round.leaderName ? `${v.round.leaderName} LEADS` : 'OPEN'}</div>
						{:else}
							<div style="font-weight:900;font-style:italic;font-size:20px">SEALED</div>
							<div class="text-[9px] tracking-[0.2em] text-white/60">{v.round.sealedCount}/{v.round.participantCount} IN</div>
						{/if}
					</div>
				{/if}
				<div class="mt-3 text-[11px] tracking-widest {v.round.yourTurn ? 'text-white' : 'text-white/40'}">
					{#if v.round.solo && v.round.yourTurn}TAKE IT OR PASS{:else if v.round.yourTurn}YOUR MOVE{:else}{v.round.mode === 'silent' ? 'SEAL YOUR BID' : 'WAITING…'}{/if} — {fmt(msLeft)}
				</div>
			</div>

			<!-- controls -->
			<div class="pb-4 space-y-2">
				{#if v.round.solo}
					{#if v.round.yourTurn}
						<div class="grid grid-cols-2 gap-2">
							<button onclick={take} class="press py-4 rounded-lg font-bold" style="background:{me?.color ?? '#5b8cff'};color:#0b0b12;font-style:italic;font-weight:900" disabled={(me?.budget ?? 0) < 1}>TAKE · $1</button>
							<button onclick={pass} class="py-4 rounded-lg font-bold text-white/70" style="background:rgba(255,255,255,.08)">PASS IT ON</button>
						</div>
					{:else}
						<div class="text-center py-4 text-white/40 text-sm tracking-widest">{v.round.leaderName ?? 'A player'} is deciding…</div>
					{/if}
				{:else if v.round.mode === 'live'}
					{#if v.round.yourTurn}
						<div class="grid grid-cols-3 gap-2">
							{#each [1, 2] as inc}
								<button onclick={() => raise(v!.round!.currentBid + inc)} disabled={v.round.currentBid + inc > (me?.budget ?? 0)}
									class="press py-4 rounded-lg font-bold text-lg disabled:opacity-30" style="background:{me?.color ?? '#5b8cff'};color:#0b0b12;font-style:italic;font-weight:900">+${inc}</button>
							{/each}
							<div class="rounded-lg flex items-center overflow-hidden" style="border:2px solid {me?.color ?? '#5b8cff'}">
								<input type="number" inputmode="numeric" bind:value={custom} placeholder="$" onkeydown={(e) => e.key === 'Enter' && bidCustom()}
									class="w-full bg-transparent text-center outline-none py-4 text-lg" style="font-style:italic;font-weight:900;color:{me?.color ?? '#5b8cff'}" />
							</div>
						</div>
						{#if v.round.currentBid > 0}
							<button onclick={pass} class="w-full py-3 rounded-lg text-sm tracking-[0.3em] font-bold text-white/60" style="background:rgba(255,255,255,.06)">PASS</button>
						{:else}
							<div class="text-center text-[11px] text-white/40 tracking-widest">you open — bid at least $1</div>
						{/if}
					{:else}
						<div class="text-center py-4 text-white/40 text-sm tracking-widest">waiting for {v.round.leaderName ?? 'others'}…</div>
					{/if}
				{:else}
					<!-- silent -->
					{#if !v.round.canBid}
						<div class="w-full py-4 rounded-xl text-center text-white/40 text-sm tracking-widest" style="background:rgba(255,255,255,.04)">SITTING OUT — {me?.full ? 'squad full' : 'broke'}</div>
					{:else if v.round.youSealed}
						<div class="w-full py-4 rounded-xl text-center text-white/50 text-sm tracking-widest" style="background:rgba(255,255,255,.04)">LOCKED IN ✓ — {v.round.sealedCount}/{v.round.participantCount} sealed</div>
					{:else}
						<div class="flex items-center rounded-xl px-4" style="background:#0e0e18;border:1px solid #23233a">
							<span class="text-white/30 text-2xl" style="font-style:italic;font-weight:900">$</span>
							<input type="number" inputmode="numeric" bind:value={custom} placeholder="0" min="0" max={me?.budget} onkeydown={(e) => e.key === 'Enter' && sealCustom()}
								class="w-full bg-transparent outline-none py-4 pl-2 text-2xl" style="font-style:italic;font-weight:900" />
							<span class="text-[11px] text-white/30 whitespace-nowrap">of ${me?.budget}</span>
						</div>
						<button onclick={sealCustom} class="press w-full py-4 rounded-xl" style="background:{me?.color ?? '#5b8cff'};color:#0b0b12;font-weight:900;font-style:italic">LOCK IT IN</button>
					{/if}
				{/if}

				<button onclick={() => (showBoard = !showBoard)} class="w-full py-2 rounded-lg text-[11px] tracking-[0.25em] text-white/40" style="background:rgba(255,255,255,.04)">▤ DRAFT BOARD</button>
			</div>
			</div>
			{/if}
		{/if}
	</div>

	<!-- win popup -->
	{#if popup}
		<div class="fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 pointer-events-none">
			<div class="relative" in:scale={{ start: 0.4, duration: 550, easing: elasticOut }} out:fly={{ y: 20, duration: 200 }}>
				<div class="burst absolute inset-0 rounded-[2rem] -z-10" style="background:{popup.color};opacity:.55"></div>
				<div class="rounded-2xl px-6 py-3 text-center shadow-2xl" style="background:#0b0b12;border:2px solid {popup.color}">
					<div class="text-[10px] tracking-[0.3em]" style="color:{popup.color}">DRAFTED</div>
					<div style="font-style:italic;font-weight:900;font-size:22px">{popup.item}</div>
					<div class="text-[12px] text-white/60">{popup.name} · {popup.price ? `$${popup.price}` : 'free'}</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- draft board sheet -->
	{#if showBoard}{#if v}
		<button class="fixed inset-0 z-40" style="background:rgba(0,0,0,.55)" aria-label="close" onclick={() => (showBoard = false)}></button>
		<div class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl p-4 space-y-2" style="background:#0b0b12;border-top:1px solid #23233a">
			<div class="text-[11px] tracking-[0.3em] text-white/40 pb-1">DRAFT BOARD</div>
			{#each v.players as p}
				<div class="rounded-xl px-3 py-2" style="background:#0e0e18;border:1px solid #23233a">
					<div class="flex justify-between"><span style="font-style:italic;font-weight:900;color:{p.color}">{p.name}</span><span class="text-[11px] text-white/40">${p.budget} · {p.squad.length}{v.rules.spots != null ? `/${v.rules.spots}` : ''}</span></div>
					<div class="flex flex-wrap gap-1 mt-1">
						{#each p.squad as s}<span class="text-[11px] px-2 py-0.5 rounded" style="background:{p.color}22;color:{p.color}">{s}</span>{/each}
						{#if p.squad.length === 0}<span class="text-[11px] text-white/25">—</span>{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}{/if}
</div>
