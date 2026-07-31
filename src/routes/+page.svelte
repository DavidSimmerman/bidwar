<script lang="ts">
	import { fly } from 'svelte/transition';
	import SplitBackground from '$lib/SplitBackground.svelte';
	import { POOL_NAMES, POOLS } from '$lib/pools';
	import type { Mode, TieRule } from '$lib/engine';

	const PALETTE = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'];
	const NAMES = ['You', 'Red', 'Green', 'Gold'];

	let name = $state('');
	let count = $state(2);
	let pool = $state('NBA GOATs');
	let budget = $state(20);
	let timerValue = $state(1);
	let timerUnit = $state<'s' | 'm' | 'h'>('m');
	let timerUnlimited = $state(false);
	let spotsMode = $state<'fixed' | 'unlimited'>('fixed');
	let spots = $state(5);
	let roundsValue = $state(10);
	let mode = $state<Mode>('live');
	let tie = $state<TieRule>('rebid');
	let showConfig = $state(false);
	let dlg = $state<HTMLDialogElement>();
	$effect(() => {
		if (showConfig) dlg?.showModal();
	});

	const rounds = $derived(spotsMode === 'fixed' ? spots * count : roundsValue);
	const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || lo)));

	const timers: ['s' | 'm' | 'h', string][] = [['s', 'sec'], ['m', 'min'], ['h', 'hr']];
	const ties: [TieRule, string][] = [['rebid', 'Rebid'], ['live', 'Go live'], ['random', 'Random'], ['toss', 'Toss it']];

	function start() {
		name = name.trim();
		if (!name) return;
		budget = clamp(budget, 5, 500);
		spots = clamp(spots, 1, 20);
		roundsValue = clamp(roundsValue, count, 200);
		timerValue = clamp(timerValue, 1, 999);
		showConfig = true;
	}
</script>

<div class="min-h-screen flex flex-col" style="background:#0a0a0c; font-family:'Archivo',sans-serif">
	<!-- HERO — animated split, replays when player count changes -->
	<div class="relative h-[300px] shrink-0 overflow-hidden">
		{#key count}
			<SplitBackground {count} colors={PALETTE.slice(0, count)} />
		{/key}
		<div class="absolute inset-0 flex flex-col items-center justify-between py-6" style="background:linear-gradient(180deg,rgba(10,10,12,.15),rgba(10,10,12,.55))">
			<div class="text-center">
				<div class="text-[11px] tracking-[0.5em] text-white/70">A BIDDING WAR</div>
				<div style="font-style:italic;font-weight:900;font-size:52px;line-height:1" class="text-white drop-shadow-lg">BID WAR</div>
			</div>
			<div class="flex gap-2">
				{#each [2, 3, 4] as n}
					<button
						onclick={() => (count = n)}
						class="px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-95"
						style={count === n
							? 'background:#fff;color:#0b0b12'
							: 'background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.25)'}
					>{n} PLAYERS</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- FORM -->
	<div class="flex-1 w-full max-w-[440px] mx-auto px-5 py-6 space-y-5">
		<!-- name -->
		<div>
			<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">YOUR NAME</div>
			<input
				bind:value={name}
				maxlength="16"
				placeholder="e.g. Dav"
				class="w-full rounded-xl px-4 py-3 text-lg outline-none"
				style="background:#0e0e18;border:1px solid #23233a;color:#fff;font-style:italic;font-weight:700"
			/>
		</div>

		<!-- pool -->
		<div>
			<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">POOL · {POOLS[pool].length} in it</div>
			<select
				bind:value={pool}
				class="w-full rounded-xl px-4 py-3 text-lg outline-none appearance-none"
				style="background:#0e0e18;border:1px solid #23233a;color:#fff;font-weight:700"
			>
				{#each POOL_NAMES as p}<option value={p}>{p}</option>{/each}
			</select>
			<div class="text-[11px] text-white/25 mt-1">Custom pools coming soon</div>
		</div>

		<!-- budget + timer (fully variable) -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">BUDGET EACH</div>
				<div class="flex items-center rounded-xl px-3" style="background:#0e0e18;border:1px solid #23233a">
					<span class="text-white/40 text-xl" style="font-style:italic;font-weight:900">$</span>
					<input type="number" min="5" max="500" bind:value={budget}
						class="w-full bg-transparent outline-none py-3 pl-1 text-lg" style="font-style:italic;font-weight:900" />
				</div>
			</div>
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">TIME / PICK</div>
				{#if timerUnlimited}
					<button onclick={() => (timerUnlimited = false)} class="w-full rounded-xl py-3 text-lg" style="background:#0e0e18;border:1px solid #23233a;color:#fff;font-style:italic;font-weight:900">∞ no limit</button>
				{:else}
					<div class="flex items-center rounded-xl px-2" style="background:#0e0e18;border:1px solid #23233a">
						<input type="number" min="1" max="999" bind:value={timerValue}
							class="w-full bg-transparent outline-none py-3 pl-2 text-lg" style="font-style:italic;font-weight:900" />
						<select bind:value={timerUnit} class="bg-transparent outline-none text-sm text-white/70 pr-1">
							{#each timers as [u, label]}<option value={u} style="color:#000">{label}</option>{/each}
						</select>
					</div>
				{/if}
				<button onclick={() => (timerUnlimited = !timerUnlimited)} class="text-[11px] text-white/30 mt-1 tracking-widest">{timerUnlimited ? 'set a timer' : 'make it unlimited'}</button>
			</div>
		</div>

		<!-- spots -->
		<div>
			<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">SQUAD SIZE</div>
			<div class="grid grid-cols-2 gap-2">
				<button onclick={() => (spotsMode = 'fixed')} class="rounded-xl py-2.5 transition active:scale-95" style={spotsMode === 'fixed' ? 'background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic' : 'background:#0e0e18;border:1px solid #23233a;color:#fff'}>Fixed</button>
				<button onclick={() => (spotsMode = 'unlimited')} class="rounded-xl py-2.5 transition active:scale-95" style={spotsMode === 'unlimited' ? 'background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic' : 'background:#0e0e18;border:1px solid #23233a;color:#fff'}>Unlimited</button>
			</div>
			<div class="flex items-center gap-3 mt-2">
				{#if spotsMode === 'fixed'}
					<button onclick={() => (spots = clamp(spots - 1, 1, 20))} class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition" style="background:#0e0e18;border:1px solid #23233a">−</button>
					<div class="text-2xl font-bold w-8 text-center" style="font-style:italic">{spots}</div>
					<button onclick={() => (spots = clamp(spots + 1, 1, 20))} class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition" style="background:#0e0e18;border:1px solid #23233a">+</button>
					<span class="text-[12px] text-white/40">each · <b class="text-white/70">{rounds} rounds</b> total</span>
				{:else}
					<span class="text-[12px] text-white/40">until broke ·</span>
					<button onclick={() => (roundsValue = clamp(roundsValue - 1, count, 200))} class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition" style="background:#0e0e18;border:1px solid #23233a">−</button>
					<div class="text-2xl font-bold w-10 text-center" style="font-style:italic">{roundsValue}</div>
					<button onclick={() => (roundsValue = clamp(roundsValue + 1, count, 200))} class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition" style="background:#0e0e18;border:1px solid #23233a">+</button>
					<span class="text-[12px] text-white/40">rounds cap</span>
				{/if}
			</div>
		</div>

		<!-- mode -->
		<div>
			<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">BID MODE</div>
			<div class="grid grid-cols-2 gap-2">
				<button onclick={() => (mode = 'live')} class="rounded-xl py-3 text-center transition active:scale-95" style={mode === 'live' ? 'background:#5b8cff;color:#0b0b12' : 'background:#0e0e18;border:1px solid #23233a'}>
					<div style="font-weight:900;font-style:italic;font-size:18px">Live</div>
					<div class="text-[11px] {mode === 'live' ? 'opacity-70' : 'text-white/30'}">1-up in real time</div>
				</button>
				<button onclick={() => (mode = 'silent')} class="rounded-xl py-3 text-center transition active:scale-95" style={mode === 'silent' ? 'background:#5b8cff;color:#0b0b12' : 'background:#0e0e18;border:1px solid #23233a'}>
					<div style="font-weight:900;font-style:italic;font-size:18px">Silent</div>
					<div class="text-[11px] {mode === 'silent' ? 'opacity-70' : 'text-white/30'}">sealed, highest wins</div>
				</button>
			</div>
		</div>

		{#if mode === 'silent'}
			<div transition:fly={{ y: -8, duration: 200 }}>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">IF SILENT BIDS TIE</div>
				<div class="flex flex-wrap gap-2">
					{#each ties as [key, label]}
						<button onclick={() => (tie = key)} class="px-3 py-2 rounded-lg text-sm font-bold transition active:scale-95" style={tie === key ? 'background:#ff5f4d;color:#fff' : 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.6)'}>{label}</button>
					{/each}
				</div>
			</div>
		{/if}

		<button
			onclick={start}
			class="w-full py-4 rounded-xl text-lg transition active:scale-[0.98] hover:brightness-110"
			style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic"
		>START — INVITE {count - 1} {count === 2 ? 'PLAYER' : 'PLAYERS'}</button>
	</div>
</div>

<!-- config confirm — native <dialog> gives Esc-to-close, focus trap & backdrop for free.
     engine v2 wires this to a real lobby next. -->
<dialog bind:this={dlg} onclose={() => (showConfig = false)} class="config">
	<div style="font-style:italic;font-weight:900;font-size:24px" class="mb-1">READY, {name.toUpperCase()}</div>
	<div class="text-[12px] text-white/40 mb-4">Lobby + live game land with the N-player engine (next build).</div>
	<div class="space-y-1.5 text-sm">
		{#each [['Players', count], ['Pool', pool], ['Budget', `$${budget} each`], ['Timer', timerUnlimited ? 'none' : `${timerValue}${timerUnit} / pick`], ['Squad', spotsMode === 'fixed' ? `${spots} each` : 'unlimited'], ['Rounds', rounds], ['Mode', mode === 'live' ? 'Live' : `Silent · ${tie}`]] as [k, v]}
			<div class="flex justify-between border-b border-white/5 pb-1.5"><span class="text-white/40 tracking-widest text-[11px] uppercase">{k}</span><span style="font-weight:700">{v}</span></div>
		{/each}
	</div>
	<form method="dialog"><button class="w-full mt-5 py-3 rounded-xl" style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">GOT IT</button></form>
</dialog>

<style>
	.config {
		margin: auto;
		width: calc(100% - 2rem);
		max-width: 380px;
		color: #fff;
		background: #0b0b12;
		border: 1px solid #23233a;
		border-radius: 1rem;
		padding: 1.5rem;
	}
	.config::backdrop { background: rgba(0, 0, 0, 0.6); }
	.config[open] { animation: pop 0.18s ease-out; }
	@keyframes pop { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
