<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import type { GameView } from '$lib/engine';

	const blue = '#5b8cff';
	const red = '#ff5f4d';
	const id = page.params.id;

	let v = $state<GameView | null>(null);
	let notFound = $state(false);
	let custom = $state('');
	let copied = $state(false);

	// smooth local countdown between polls
	let deadlineAt = $state<number | null>(null);
	let nowMs = $state(Date.now());
	const msLeft = $derived(deadlineAt == null ? null : Math.max(0, deadlineAt - nowMs));

	function applyView(view: GameView) {
		v = view;
		deadlineAt = view.round?.msLeft != null ? Date.now() + view.round.msLeft : null;
	}

	async function refresh() {
		try {
			const res = await fetch(`/api/game/${id}`);
			if (res.status === 404) return (notFound = true);
			if (res.ok) applyView(await res.json());
		} catch {
			/* transient network blip — next tick retries */
		}
	}

	async function send(body: Record<string, unknown>) {
		const res = await fetch(`/api/game/${id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (res.ok) applyView(await res.json());
	}

	const join = () => send({ op: 'join' });
	const pass = () => send({ op: 'pass' });
	const raise = (amount: number) => send({ op: 'raise', amount });
	const seal = (amount: number) => send({ op: 'seal', amount });

	function raiseCustom() {
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

	function fmtTime(ms: number | null) {
		if (ms == null) return '∞';
		const s = Math.ceil(ms / 1000);
		if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	let pollId: ReturnType<typeof setInterval>;
	let tickId: ReturnType<typeof setInterval>;
	onMount(() => {
		refresh();
		pollId = setInterval(refresh, 1000);
		tickId = setInterval(() => (nowMs = Date.now()), 400);
	});
	onDestroy(() => {
		clearInterval(pollId);
		clearInterval(tickId);
	});

	// game-over winner: most spots filled, tiebreak most budget left
	const winner = $derived.by(() => {
		if (!v || v.status !== 'over' || !v.me || !v.opp) return null;
		if (v.me.squad.length !== v.opp.squad.length)
			return v.me.squad.length > v.opp.squad.length ? 'me' : 'opp';
		if (v.me.budget !== v.opp.budget) return v.me.budget > v.opp.budget ? 'me' : 'opp';
		return 'draw';
	});
</script>

<div class="flex min-h-screen justify-center px-4 py-6" style="background:#0a0a0c">
	<div
		class="relative w-full max-w-[400px] rounded-[2rem] overflow-hidden flex flex-col ring-1 ring-white/10"
		style="background:#0b0b12; color:#fff; font-family:'Archivo',sans-serif; min-height:min(90vh,760px)"
	>
		{#if notFound}
			<div class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
				<div style="font-style:italic;font-weight:900;font-size:28px">Game not found</div>
				<a href="/" class="text-sm tracking-widest" style="color:{blue}">START A NEW ONE →</a>
			</div>
		{:else if !v}
			<div class="flex-1 flex items-center justify-center text-white/40">loading…</div>

		{:else if !v.joined && v.status !== 'lobby'}
			<!-- link visitor arriving after game is full/started -->
			<div class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
				<div style="font-style:italic;font-weight:900;font-size:26px">This game is full</div>
				<div class="text-white/40 text-sm">Two players are already in it.</div>
				<a href="/" class="text-sm tracking-widest mt-2" style="color:{blue}">START YOUR OWN →</a>
			</div>

		{:else if !v.joined}
			<!-- JOIN screen -->
			<div class="flex-1 flex flex-col p-6">
				<div class="text-center pt-6">
					<div class="text-[11px] tracking-[0.35em] text-white/40">YOU'VE BEEN CHALLENGED</div>
					<div style="font-style:italic;font-weight:900;font-size:30px" class="mt-1">BID WAR</div>
				</div>
				<div class="mt-8 space-y-3 text-sm">
					{#each [['Pool', v.rules.pool], ['Mode', v.rules.mode === 'live' ? 'Live 1-up' : 'Silent sealed'], ['Spots', v.rules.spots == null ? 'Unlimited' : `${v.rules.spots} each`], ['Budget', `$${v.rules.budget} each`], ['Timer', fmtTime(v.round?.msLeft ?? null) === '∞' ? 'No limit' : 'per pick']] as [k, val]}
						<div class="flex justify-between border-b border-white/5 pb-2">
							<span class="text-white/40 tracking-widest text-[11px] uppercase">{k}</span>
							<span style="font-weight:700">{val}</span>
						</div>
					{/each}
				</div>
				<div class="flex-1"></div>
				<button onclick={join} class="w-full py-4 rounded-xl" style="background:{blue};color:#0b0b12;font-weight:900;font-style:italic;font-size:18px">
					JOIN THE WAR
				</button>
			</div>

		{:else if v.status === 'lobby'}
			<!-- SHARE / WAITING (host) -->
			<div class="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
				<div class="text-[11px] tracking-[0.35em] text-white/40">WAITING FOR OPPONENT</div>
				<div class="w-14 h-14 rounded-full border-2 animate-pulse" style="border-color:{blue}"></div>
				<div style="font-style:italic;font-weight:900;font-size:24px">Send the link</div>
				<div class="text-white/40 text-sm -mt-3">Whoever opens it becomes Player 2.</div>
				<button onclick={copyLink} class="w-full py-4 rounded-xl" style="background:{blue};color:#0b0b12;font-weight:900;font-style:italic;font-size:16px">
					{copied ? 'COPIED ✓' : 'COPY INVITE LINK'}
				</button>
				<div class="text-[11px] text-white/30 break-all">{page.url.href}</div>
			</div>

		{:else if v.status === 'over'}
			<!-- GAME OVER -->
			<div class="flex-1 flex flex-col p-6">
				<div class="text-center pt-4">
					<div class="text-[11px] tracking-[0.35em] text-white/40">FINAL</div>
					<div style="font-style:italic;font-weight:900;font-size:30px">
						{winner === 'draw' ? "IT'S A DRAW" : winner === 'me' ? 'YOU WIN 🏆' : 'YOU LOST'}
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 mt-6 flex-1">
					{#each [{ who: 'me', label: 'YOU', color: blue, p: v.me }, { who: 'opp', label: (v.opp?.name ?? 'THEM'), color: red, p: v.opp }] as col}
						<div class="rounded-2xl p-3 flex flex-col" style="background:#0e0e18;border:1px solid {winner === col.who ? col.color : '#23233a'}">
							<div class="flex items-center justify-between">
								<span style="font-style:italic;font-weight:900;color:{col.color}">{col.label}</span>
								{#if winner === col.who}<span>🏆</span>{/if}
							</div>
							<div class="text-[11px] text-white/40">${col.p?.budget} left · {col.p?.squad.length} spots</div>
							<div class="mt-2 space-y-1 overflow-auto">
								{#each col.p?.squad ?? [] as item}
									<div class="text-[12px] rounded px-2 py-1 bg-white/5">{item}</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<a href="/" class="mt-4 w-full py-4 rounded-xl text-center" style="background:{blue};color:#0b0b12;font-weight:900;font-style:italic;font-size:18px">
					REMATCH — NEW GAME
				</a>
			</div>

		{:else if v.round}
			<!-- ACTIVE ROUND (live or silent), shares the Versus chrome -->
			<div class="absolute inset-0" style="background:linear-gradient(115deg,#101a3a 0%,#101a3a 49.7%,#3a1210 50.3%,#3a1210 100%)"></div>
			<div class="relative flex flex-col h-full flex-1">
				<div class="text-center pt-5 text-[11px] tracking-[0.3em] text-white/50">
					{v.rules.pool.toUpperCase()} · {v.rules.mode === 'silent' ? 'SEALED BID' : 'LIVE'}
				</div>

				<!-- players -->
				<div class="flex justify-between px-5 pt-3">
					<div>
						<div style="font-style:italic;font-weight:900;font-size:24px;color:{blue}">YOU</div>
						<div class="text-2xl font-bold">${v.me?.budget}</div>
						<div class="text-[10px] text-white/50 tracking-widest">
							{v.me?.squad.length}{v.rules.spots != null ? `/${v.rules.spots}` : ''} SQUAD
						</div>
					</div>
					<div class="text-right">
						<div style="font-style:italic;font-weight:900;font-size:24px;color:{red}">{v.opp?.name ?? '…'}</div>
						<div class="text-2xl font-bold">${v.opp?.budget ?? '—'}</div>
						<div class="text-[10px] text-white/50 tracking-widest">
							{v.opp?.squad.length ?? 0}{v.rules.spots != null ? `/${v.rules.spots}` : ''} SQUAD
						</div>
					</div>
				</div>

				<!-- last result banner -->
				{#if v.lastResult}
					<div class="mx-5 mt-3 rounded-lg px-3 py-1.5 text-center text-[12px]"
						style="background:{v.lastResult.winnerIsMe ? 'rgba(91,140,255,.15)' : 'rgba(255,255,255,.06)'}">
						{v.lastResult.winnerId
							? `${v.lastResult.winnerIsMe ? 'You' : v.lastResult.winnerName} took ${v.lastResult.item} for $${v.lastResult.price}`
							: `${v.lastResult.item} — no sale`}
					</div>
				{/if}

				<!-- item -->
				<div class="mt-3 mx-auto w-[85%] rounded-xl p-[2px]" style="background:linear-gradient(115deg,{blue},{red})">
					<div class="rounded-[10px] px-4 py-4 text-center" style="background:#0e0e18">
						<div class="text-[10px] tracking-[0.3em] text-white/40 mb-1">ON THE BLOCK</div>
						<div style="font-style:italic;font-weight:900;font-size:28px;line-height:1.05">{v.round.item}</div>
					</div>
				</div>

				{#if v.round.mode === 'live'}
					<!-- LIVE center -->
					<div class="flex-1 flex flex-col items-center justify-center">
						<div class="w-36 h-36 rounded-full flex flex-col items-center justify-center"
							style="background:#0e0e18;border:3px solid {v.round.leaderIsMe ? blue : red};box-shadow:0 0 55px {v.round.leaderIsMe ? 'rgba(91,140,255,.35)' : 'rgba(255,95,77,.35)'}">
							<div style="font-weight:900;font-style:italic;font-size:50px;line-height:1">${v.round.currentBid}</div>
							<div class="text-[10px] tracking-[0.25em] mt-1" style="color:{v.round.leaderIsMe ? blue : red}">
								{v.round.leaderName ? (v.round.leaderIsMe ? 'YOU LEAD' : `${v.round.leaderName} LEADS`) : 'OPEN'}
							</div>
						</div>
						<div class="mt-3 text-[11px] tracking-widest {v.round.yourTurn ? 'text-white' : 'text-white/40'}">
							{v.round.yourTurn ? 'YOUR MOVE' : 'THEIR MOVE'} — {fmtTime(msLeft)}
						</div>
					</div>

					<!-- LIVE actions -->
					<div class="px-5 pb-7 space-y-2">
						{#if v.round.yourTurn}
							<div class="grid grid-cols-3 gap-2">
								{#each [1, 2] as inc}
									<button onclick={() => raise(v!.round!.currentBid + inc)}
										disabled={v.round.currentBid + inc > (v.me?.budget ?? 0)}
										class="py-4 rounded-lg font-bold text-lg disabled:opacity-30"
										style="background:{blue};color:#0b0b12;font-style:italic;font-weight:900">+${inc}</button>
								{/each}
								<div class="rounded-lg flex items-center overflow-hidden" style="border:2px solid {blue}">
									<input type="number" inputmode="numeric" bind:value={custom} placeholder="$"
										onkeydown={(e) => e.key === 'Enter' && raiseCustom()}
										class="w-full bg-transparent text-center outline-none py-4 text-lg"
										style="font-style:italic;font-weight:900;color:{blue}" />
								</div>
							</div>
							<button onclick={pass} class="w-full py-3 rounded-lg text-sm tracking-[0.3em] font-bold text-white/60" style="background:rgba(255,255,255,.06)">PASS</button>
						{:else}
							<div class="text-center py-6 text-white/40 text-sm tracking-widest">WAITING FOR {v.opp?.name ?? 'OPPONENT'}…</div>
						{/if}
					</div>

				{:else}
					<!-- SILENT center -->
					<div class="flex-1 flex flex-col items-center justify-center px-5 gap-4">
						{#if v.me?.done}
							<div class="text-center text-[12px] text-white/50 tracking-widest">YOUR SQUAD IS FULL</div>
							<div class="text-[11px] text-white/30 -mt-2">sitting out — {v.opp?.name ?? 'opponent'} finishes up</div>
						{:else if v.round.youSealed}
							<div class="w-36 h-36 rounded-full flex flex-col items-center justify-center" style="background:#0e0e18;border:3px solid {blue}">
								<div style="font-weight:900;font-style:italic;font-size:26px">LOCKED</div>
								<div class="text-[10px] tracking-[0.25em] mt-1" style="color:{blue}">YOUR BID IS IN</div>
							</div>
							<div class="text-[12px] text-white/50 tracking-widest">
								{v.round.oppSealed ? 'REVEALING…' : `WAITING FOR ${v.opp?.name ?? 'OPPONENT'}…`}
							</div>
						{:else}
							<div class="text-center text-[12px] text-white/50 tracking-widest">
								WRITE YOUR SEALED BID {#if v.round.tieCount > 0}· REBID #{v.round.tieCount}{/if}
							</div>
							<div class="text-[11px] text-white/30 -mt-2">
								{v.round.oppSealed ? `${v.opp?.name} already locked in` : 'both bids reveal at once'}
							</div>
						{/if}
					</div>

					<!-- SILENT actions -->
					{#if v.me?.done}
						<div class="px-5 pb-7"><div class="w-full py-4 rounded-xl text-center text-white/40 text-sm tracking-widest" style="background:rgba(255,255,255,.04)">SITTING OUT</div></div>
					{:else if !v.round.youSealed}
						<div class="px-5 pb-7 space-y-2">
							<div class="rounded-xl flex items-center px-4" style="background:#0e0e18;border:1px solid #23233a">
								<span class="text-white/30 text-2xl" style="font-style:italic;font-weight:900">$</span>
								<input type="number" inputmode="numeric" bind:value={custom} placeholder="0" min="0" max={v.me?.budget}
									onkeydown={(e) => e.key === 'Enter' && sealCustom()}
									class="w-full bg-transparent outline-none py-4 pl-2 text-2xl" style="font-style:italic;font-weight:900" />
								<span class="text-[11px] text-white/30 whitespace-nowrap">of ${v.me?.budget}</span>
							</div>
							<button onclick={sealCustom} class="w-full py-4 rounded-xl" style="background:{blue};color:#0b0b12;font-weight:900;font-style:italic;font-size:18px">LOCK IT IN</button>
						</div>
					{:else}
						<div class="px-5 pb-7"><div class="w-full py-4 rounded-xl text-center text-white/40 text-sm tracking-widest" style="background:rgba(255,255,255,.04)">SEALED</div></div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</div>
