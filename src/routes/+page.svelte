<script lang="ts">
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SplitBackground from '$lib/SplitBackground.svelte';
	import { POOL_NAMES, POOLS } from '$lib/pools';
	import type { Mode, TieRule } from '$lib/engine';

	const PALETTE = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'];
	const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000 };

	let name = $state('');
	let nameGate = $state(false);
	let count = $state(2);
	let pool = $state('NBA GOATs');
	let budget = $state(20);
	let timerValue = $state(1);
	let timerUnit = $state<'s' | 'm' | 'h'>('m');
	let timerUnlimited = $state(true); // unlimited time is the default
	let spotsMode = $state<'fixed' | 'unlimited'>('fixed');
	let spots = $state(5);
	let roundsValue = $state(10);
	let mode = $state<Mode>('live');
	let tie = $state<TieRule>('rebid');
	let creating = $state(false);
	let err = $state('');

	// Name is asked once (first visit) and remembered — not re-typed per game.
	onMount(() => {
		name = localStorage.getItem('bw_name') ?? '';
		if (!name) nameGate = true;
	});
	function saveName() {
		name = name.trim();
		if (!name) return;
		localStorage.setItem('bw_name', name);
		nameGate = false;
	}
	let nameDlg = $state<HTMLDialogElement>();
	$effect(() => {
		if (nameGate) nameDlg?.showModal();
		else nameDlg?.close();
	});

	const rounds = $derived(spotsMode === 'fixed' ? spots * count : roundsValue);
	const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || lo)));

	const timers: ['s' | 'm' | 'h', string][] = [['s', 'sec'], ['m', 'min'], ['h', 'hr']];
	const ties: [TieRule, string][] = [['rebid', 'Rebid'], ['live', 'Go live'], ['random', 'Random'], ['toss', 'Toss it']];

	async function start() {
		name = name.trim();
		if (!name) {
			err = 'Enter a name first';
			return;
		}
		creating = true;
		err = '';
		try {
			const res = await fetch('/api/game', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					pool,
					players: count,
					spots: spotsMode === 'fixed' ? clamp(spots, 1, 20) : null,
					rounds: clamp(rounds, count, 500),
					timerMs: timerUnlimited ? null : clamp(timerValue, 1, 999) * UNIT_MS[timerUnit],
					budget: clamp(budget, 5, 500),
					mode,
					tie
				})
			});
			if (!res.ok) throw new Error(await res.text());
			const { id } = await res.json();
			goto(`/g/${id}`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Could not create game';
			creating = false;
		}
	}
</script>

<div class="min-h-screen flex flex-col" style="background:#0a0a0c; font-family:'Archivo',sans-serif">
	<!-- HERO — animated split, replays when player count changes -->
	<div class="relative h-[300px] shrink-0 overflow-hidden">
		{#key count}
			<SplitBackground {count} colors={PALETTE.slice(0, count)} preview />
		{/key}
		<div class="absolute inset-0 flex flex-col items-center justify-between py-6" style="background:linear-gradient(180deg,rgba(10,10,12,.15),rgba(10,10,12,.55))">
			<div class="text-center">
				<div class="text-[11px] tracking-[0.5em] text-white/70">A BIDDING WAR</div>
				<div style="font-style:italic;font-weight:900;font-size:52px;line-height:1" class="text-white drop-shadow-lg smash-in">BID WAR</div>
			</div>
			<div class="flex gap-2 stagger">
				{#each [2, 3, 4] as n}
					<button
						onclick={() => (count = n)}
						class="press px-5 py-2.5 rounded-xl text-sm font-bold"
						style={count === n
							? 'background:#fff;color:#0b0b12'
							: 'background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.25)'}
					>{n} PLAYERS</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- FORM -->
	<div class="flex-1 w-full max-w-[440px] mx-auto px-5 py-6 space-y-5 stagger">
		<!-- playing as (name is set once via the gate, then remembered) -->
		<div class="flex items-center justify-between">
			<div class="text-sm text-white/60">Playing as <b class="text-white" style="font-style:italic">{name || '—'}</b></div>
			<button onclick={() => (nameGate = true)} class="text-[11px] tracking-widest font-bold active:scale-95 transition" style="color:#5b8cff">CHANGE</button>
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
			<div class="text-[11px] text-white/25 mt-1">Pool market — build & browse your own — coming next</div>
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
				<div class="grid grid-cols-2 gap-1 p-1 rounded-xl" style="background:#0e0e18;border:1px solid #23233a">
					<button onclick={() => (timerUnlimited = true)} class="py-2 rounded-lg text-sm font-bold transition active:scale-95" style={timerUnlimited ? 'background:#5b8cff;color:#0b0b12;font-style:italic' : 'color:rgba(255,255,255,.55)'}>∞ None</button>
					<button onclick={() => (timerUnlimited = false)} class="py-2 rounded-lg text-sm font-bold transition active:scale-95" style={!timerUnlimited ? 'background:#5b8cff;color:#0b0b12;font-style:italic' : 'color:rgba(255,255,255,.55)'}>Timed</button>
				</div>
				{#if !timerUnlimited}
					<div class="flex items-center rounded-xl px-2 mt-1" style="background:#0e0e18;border:1px solid #23233a" transition:fly={{ y: -6, duration: 150 }}>
						<input type="number" min="1" max="999" bind:value={timerValue}
							class="w-full bg-transparent outline-none py-2.5 pl-2 text-lg" style="font-style:italic;font-weight:900" />
						<select bind:value={timerUnit} class="bg-transparent outline-none text-sm text-white/70 pr-1">
							{#each timers as [u, label]}<option value={u} style="color:#000">{label}</option>{/each}
						</select>
					</div>
				{/if}
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

		{#if err}<div class="text-[12px] text-center" style="color:#ff5f4d">{err}</div>{/if}
		<button
			onclick={start}
			disabled={creating}
			class="press w-full py-4 rounded-xl text-lg hover:brightness-110 disabled:opacity-50"
			style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic"
		>{creating ? 'CREATING…' : `START — INVITE ${count - 1} ${count === 2 ? 'PLAYER' : 'PLAYERS'}`}</button>
	</div>
</div>

<!-- first-visit name gate (native <dialog>: Esc/focus/backdrop for free) -->
<dialog bind:this={nameDlg} onclose={() => (nameGate = false)} class="namegate">
	<div class="text-center">
		<div class="text-[11px] tracking-[0.4em] text-white/50">WELCOME TO</div>
		<div style="font-style:italic;font-weight:900;font-size:36px" class="mb-3">BID WAR</div>
	</div>
	<div class="text-sm text-white/50 text-center mb-3">What should we call you?</div>
	<input
		bind:value={name}
		maxlength="16"
		placeholder="your name"
		onkeydown={(e) => e.key === 'Enter' && saveName()}
		class="w-full rounded-xl px-4 py-3 text-lg text-center outline-none"
		style="background:#0e0e18;border:1px solid #23233a;color:#fff;font-style:italic;font-weight:900"
	/>
	<button onclick={saveName} class="w-full mt-3 py-3 rounded-xl active:scale-95 transition" style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">LET'S GO</button>
</dialog>

<style>
	.namegate {
		margin: auto;
		width: calc(100% - 2rem);
		max-width: 360px;
		background: #0b0b12;
		border: 1px solid #23233a;
		border-radius: 1rem;
		padding: 1.75rem;
		color: #fff;
	}
	.namegate::backdrop { background: rgba(10, 10, 12, 0.82); }
	.namegate[open] { animation: pop 0.18s ease-out; }
	@keyframes pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
