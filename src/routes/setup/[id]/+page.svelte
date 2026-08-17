<script lang="ts">
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import SplitBackground from '$lib/SplitBackground.svelte';
	import NameGate from '$lib/NameGate.svelte';
	import { CAT_HUE } from '$lib/drafts';
	import type { Mode, TieRule } from '$lib/engine';

	let { data } = $props();
	const draft = $derived(data.draft);

	const PALETTE = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'];
	const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000 };

	let name = $state('');
	let nameGate = $state(false);
	let count = $state(2);
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

	const rounds = $derived(spotsMode === 'fixed' ? spots * count : roundsValue);
	const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n || lo)));

	const timers: ['s' | 'm' | 'h', string][] = [['s', 'sec'], ['m', 'min'], ['h', 'hr']];
	const ties: [TieRule, string][] = [['rebid', 'Rebid'], ['live', 'Go live'], ['random', 'Random'], ['toss', 'Toss it']];

	async function start() {
		if (!name.trim()) {
			nameGate = true;
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
					draft: draft.id,
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
	<div class="relative h-[300px] lg:h-[380px] shrink-0 overflow-hidden">
		{#key count}
			<SplitBackground {count} colors={PALETTE.slice(0, count)} preview />
		{/key}
		<div
			class="absolute inset-0 flex flex-col items-center justify-between py-6"
			style="background:linear-gradient(180deg,rgba(10,10,12,.15),rgba(10,10,12,.55))"
		>
			<div class="text-center px-6">
				<div class="text-[11px] tracking-[0.5em] text-white/70 lg:text-[13px]">BIDDING OVER</div>
				<div
					style="font-style:italic;font-weight:900;line-height:1.05"
					class="text-white drop-shadow-lg smash-in text-[40px] lg:text-[68px]"
				>
					{draft.title}
				</div>
				<div class="text-[11px] text-white/60 mt-1 lg:text-[13px]">{draft.items.length} items · by {draft.author}</div>
			</div>
			<div class="flex gap-2 stagger">
				{#each [2, 3, 4] as n}
					<button
						onclick={() => (count = n)}
						class="press px-5 py-2.5 rounded-xl text-sm font-bold"
						style={count === n
							? 'background:#fff;color:#0b0b12'
							: 'background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.25)'}
						>{n} PLAYERS</button
					>
				{/each}
			</div>
		</div>
		<a
			href="/"
			class="absolute top-4 left-4 text-[11px] tracking-widest font-bold px-2.5 py-1.5 rounded-lg"
			style="background:rgba(0,0,0,.45);color:#fff">‹ MARKET</a
		>
	</div>

	<!-- FORM -->
	<div class="flex-1 w-full max-w-[440px] lg:max-w-[560px] mx-auto px-5 py-6 lg:py-9 space-y-5 stagger">
		<div class="flex items-center justify-between">
			<div class="text-sm text-white/60">Playing as <b class="text-white" style="font-style:italic">{name || '—'}</b></div>
			<button
				onclick={() => (nameGate = true)}
				class="text-[11px] tracking-widest font-bold active:scale-95 transition"
				style="color:#5b8cff">CHANGE</button
			>
		</div>

		<!-- chosen draft -->
		<a href="/" class="flex items-center gap-3 rounded-xl p-2.5" style="background:#0e0e18;border:1px solid #23233a">
			<div
				class="w-11 h-11 rounded-lg shrink-0"
				style="background:linear-gradient(135deg,{CAT_HUE[draft.category]},#0e0e18)"
			></div>
			<div class="min-w-0 flex-1">
				<div class="text-[14px] font-bold text-white truncate">{draft.title}</div>
				<div class="text-[11px] text-white/35">{draft.category} · {draft.items.length} items</div>
			</div>
			<div class="text-[11px] font-bold" style="color:#5b8cff">CHANGE</div>
		</a>

		<!-- budget + timer -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">BUDGET EACH</div>
				<div class="flex items-center rounded-xl px-3" style="background:#0e0e18;border:1px solid #23233a">
					<span class="text-white/40 text-xl" style="font-style:italic;font-weight:900">$</span>
					<input
						type="number"
						min="5"
						max="500"
						bind:value={budget}
						aria-label="Budget each"
						class="w-full bg-transparent outline-none py-3 pl-1 text-lg text-white"
						style="font-style:italic;font-weight:900"
					/>
				</div>
			</div>
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">TIME / PICK</div>
				<div class="grid grid-cols-2 gap-1 p-1 rounded-xl" style="background:#0e0e18;border:1px solid #23233a">
					<button
						onclick={() => (timerUnlimited = true)}
						class="py-2 rounded-lg text-sm font-bold transition active:scale-95"
						style={timerUnlimited ? 'background:#5b8cff;color:#0b0b12;font-style:italic' : 'color:rgba(255,255,255,.55)'}
						>∞ None</button
					>
					<button
						onclick={() => (timerUnlimited = false)}
						class="py-2 rounded-lg text-sm font-bold transition active:scale-95"
						style={!timerUnlimited ? 'background:#5b8cff;color:#0b0b12;font-style:italic' : 'color:rgba(255,255,255,.55)'}
						>Timed</button
					>
				</div>
				{#if !timerUnlimited}
					<div
						class="flex items-center rounded-xl px-2 mt-1"
						style="background:#0e0e18;border:1px solid #23233a"
						transition:fly={{ y: -6, duration: 150 }}
					>
						<input
							type="number"
							min="1"
							max="999"
							bind:value={timerValue}
							aria-label="Time per pick"
							class="w-full bg-transparent outline-none py-2.5 pl-2 text-lg text-white"
							style="font-style:italic;font-weight:900"
						/>
						<select bind:value={timerUnit} aria-label="Time unit" class="bg-transparent outline-none text-sm text-white/70 pr-1">
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
				<button
					onclick={() => (spotsMode = 'fixed')}
					class="rounded-xl py-2.5 transition active:scale-95 text-white"
					style={spotsMode === 'fixed'
						? 'background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic'
						: 'background:#0e0e18;border:1px solid #23233a'}>Fixed</button
				>
				<button
					onclick={() => (spotsMode = 'unlimited')}
					class="rounded-xl py-2.5 transition active:scale-95 text-white"
					style={spotsMode === 'unlimited'
						? 'background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic'
						: 'background:#0e0e18;border:1px solid #23233a'}>Unlimited</button
				>
			</div>
			<div class="flex items-center gap-3 mt-2">
				{#if spotsMode === 'fixed'}
					<button
						onclick={() => (spots = clamp(spots - 1, 1, 20))}
						aria-label="Fewer spots"
						class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition text-white"
						style="background:#0e0e18;border:1px solid #23233a">−</button
					>
					<div class="text-2xl font-bold w-8 text-center text-white" style="font-style:italic">{spots}</div>
					<button
						onclick={() => (spots = clamp(spots + 1, 1, 20))}
						aria-label="More spots"
						class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition text-white"
						style="background:#0e0e18;border:1px solid #23233a">+</button
					>
					<span class="text-[12px] text-white/40">each · <b class="text-white/70">{rounds} rounds</b> total</span>
				{:else}
					<span class="text-[12px] text-white/40">until broke ·</span>
					<button
						onclick={() => (roundsValue = clamp(roundsValue - 1, count, 200))}
						aria-label="Fewer rounds"
						class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition text-white"
						style="background:#0e0e18;border:1px solid #23233a">−</button
					>
					<div class="text-2xl font-bold w-10 text-center text-white" style="font-style:italic">{roundsValue}</div>
					<button
						onclick={() => (roundsValue = clamp(roundsValue + 1, count, 200))}
						aria-label="More rounds"
						class="w-9 h-9 rounded-lg text-lg font-bold active:scale-90 transition text-white"
						style="background:#0e0e18;border:1px solid #23233a">+</button
					>
					<span class="text-[12px] text-white/40">rounds cap</span>
				{/if}
			</div>
		</div>

		<!-- mode -->
		<div>
			<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">BID MODE</div>
			<div class="grid grid-cols-2 gap-2">
				<button
					onclick={() => (mode = 'live')}
					class="rounded-xl py-3 text-center transition active:scale-95 text-white"
					style={mode === 'live' ? 'background:#5b8cff;color:#0b0b12' : 'background:#0e0e18;border:1px solid #23233a'}
				>
					<div style="font-weight:900;font-style:italic;font-size:18px">Live</div>
					<div class="text-[11px] {mode === 'live' ? 'opacity-70' : 'text-white/30'}">1-up in real time</div>
				</button>
				<button
					onclick={() => (mode = 'silent')}
					class="rounded-xl py-3 text-center transition active:scale-95 text-white"
					style={mode === 'silent' ? 'background:#5b8cff;color:#0b0b12' : 'background:#0e0e18;border:1px solid #23233a'}
				>
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
						<button
							onclick={() => (tie = key)}
							class="px-3 py-2 rounded-lg text-sm font-bold transition active:scale-95"
							style={tie === key
								? 'background:#ff5f4d;color:#fff'
								: 'background:#0e0e18;border:1px solid #23233a;color:rgba(255,255,255,.6)'}>{label}</button
						>
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
			>{creating ? 'CREATING…' : `START — INVITE ${count - 1} ${count === 2 ? 'PLAYER' : 'PLAYERS'}`}</button
		>
	</div>
</div>

<NameGate bind:name bind:open={nameGate} />
