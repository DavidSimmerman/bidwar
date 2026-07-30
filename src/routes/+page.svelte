<script lang="ts">
	import { goto } from '$app/navigation';
	import { POOL_NAMES, POOLS } from '$lib/pools';
	import type { Mode, TieRule, TimerKey } from '$lib/engine';

	const blue = '#5b8cff';
	const red = '#ff5f4d';

	let pool = $state('NBA GOATs');
	let spotsMode = $state<'fixed' | 'unlimited'>('fixed');
	let spots = $state(5);
	let timer = $state<TimerKey>('5m');
	let mode = $state<Mode>('live');
	let tie = $state<TieRule>('rebid');
	let budget = $state(20);
	let creating = $state(false);
	let err = $state('');

	const timers: [TimerKey, string][] = [
		['10s', '10s'], ['1m', '1m'], ['5m', '5m'], ['1h', '1h'], ['12h', '12h'], ['24h', '24h'], ['inf', '∞']
	];
	const ties: [TieRule, string][] = [
		['rebid', 'Rebid'], ['live', 'Go live'], ['random', 'Random'], ['toss', 'Toss it']
	];

	async function create() {
		creating = true;
		err = '';
		try {
			const res = await fetch('/api/game', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					pool,
					spots: spotsMode === 'fixed' ? spots : null,
					timer,
					mode,
					tie,
					budget
				})
			});
			if (!res.ok) throw new Error(await res.text());
			const { id } = await res.json();
			goto(`/g/${id}`);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Something went wrong';
			creating = false;
		}
	}
</script>

<div class="flex min-h-screen justify-center px-4 py-8" style="background:#0a0a0c">
	<div
		class="w-full max-w-[400px] rounded-[2rem] overflow-hidden flex flex-col ring-1 ring-white/10"
		style="background:#0b0b12; font-family:'Archivo',sans-serif"
	>
		<div class="text-center pt-8 pb-1">
			<div class="text-[11px] tracking-[0.35em] text-white/40">SET THE RULES</div>
			<div style="font-style:italic; font-weight:900; font-size:30px">NEW BID WAR</div>
		</div>

		<div class="flex-1 px-5 pt-4 space-y-5">
			<!-- pool -->
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">POOL</div>
				<div class="flex flex-wrap gap-2">
					{#each POOL_NAMES as name}
						<button
							onclick={() => (pool = name)}
							class="px-3 py-2 rounded-lg text-sm font-bold transition"
							style={pool === name
								? `background:${blue}; color:#0b0b12`
								: 'background:#0e0e18; border:1px solid #23233a; color:rgba(255,255,255,.6)'}
						>{name}</button>
					{/each}
				</div>
				<div class="text-[11px] text-white/30 mt-1">{POOLS[pool].length} in the pool</div>
			</div>

			<!-- spots -->
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">SPOTS TO FILL</div>
				<div class="grid grid-cols-2 gap-2">
					<button
						onclick={() => (spotsMode = 'fixed')}
						class="rounded-xl py-3 px-3 text-left"
						style={spotsMode === 'fixed'
							? `background:${blue}; color:#0b0b12`
							: 'background:#0e0e18; border:1px solid #23233a'}
					>
						<div style="font-weight:900; font-style:italic; font-size:20px">Fixed squad</div>
						<div class="text-[11px] {spotsMode === 'fixed' ? 'opacity-70' : 'text-white/40'}">pick a size</div>
					</button>
					<button
						onclick={() => (spotsMode = 'unlimited')}
						class="rounded-xl py-3 px-3 text-left"
						style={spotsMode === 'unlimited'
							? `background:${blue}; color:#0b0b12`
							: 'background:#0e0e18; border:1px solid #23233a'}
					>
						<div style="font-weight:900; font-style:italic; font-size:20px">Unlimited</div>
						<div class="text-[11px] {spotsMode === 'unlimited' ? 'opacity-70' : 'text-white/40'}">until you're broke</div>
					</button>
				</div>
				{#if spotsMode === 'fixed'}
					<div class="flex items-center gap-3 mt-2">
						<button onclick={() => (spots = Math.max(1, spots - 1))} class="w-9 h-9 rounded-lg text-lg font-bold" style="background:#0e0e18; border:1px solid #23233a">−</button>
						<div class="text-2xl font-bold w-10 text-center" style="font-style:italic">{spots}</div>
						<button onclick={() => (spots = Math.min(20, spots + 1))} class="w-9 h-9 rounded-lg text-lg font-bold" style="background:#0e0e18; border:1px solid #23233a">+</button>
						<span class="text-[12px] text-white/40">players each</span>
					</div>
				{/if}
			</div>

			<!-- budget -->
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">BUDGET EACH</div>
				<div class="flex gap-2">
					{#each [10, 20, 50, 100] as b}
						<button
							onclick={() => (budget = b)}
							class="flex-1 py-2 rounded-lg text-sm font-bold"
							style={budget === b
								? `background:${blue}; color:#0b0b12`
								: 'background:#0e0e18; border:1px solid #23233a; color:rgba(255,255,255,.6)'}
						>${b}</button>
					{/each}
				</div>
			</div>

			<!-- timer -->
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">TIME PER PICK</div>
				<div class="flex flex-wrap gap-2">
					{#each timers as [key, label]}
						<button
							onclick={() => (timer = key)}
							class="px-3 py-2 rounded-lg text-sm font-bold"
							style={timer === key
								? `background:${blue}; color:#0b0b12`
								: 'background:#0e0e18; border:1px solid #23233a; color:rgba(255,255,255,.6)'}
						>{label}</button>
					{/each}
				</div>
			</div>

			<!-- mode -->
			<div>
				<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">BID MODE</div>
				<div class="grid grid-cols-2 gap-2">
					<button
						onclick={() => (mode = 'live')}
						class="rounded-xl py-3 text-center"
						style={mode === 'live' ? `background:${blue}; color:#0b0b12` : 'background:#0e0e18; border:1px solid #23233a'}
					>
						<div style="font-weight:900; font-style:italic; font-size:18px">Live</div>
						<div class="text-[11px] {mode === 'live' ? 'opacity-70' : 'text-white/30'}">1-up in real time</div>
					</button>
					<button
						onclick={() => (mode = 'silent')}
						class="rounded-xl py-3 text-center"
						style={mode === 'silent' ? `background:${blue}; color:#0b0b12` : 'background:#0e0e18; border:1px solid #23233a'}
					>
						<div style="font-weight:900; font-style:italic; font-size:18px">Silent</div>
						<div class="text-[11px] {mode === 'silent' ? 'opacity-70' : 'text-white/30'}">sealed, highest wins</div>
					</button>
				</div>
			</div>

			<!-- tie rule (silent only) -->
			{#if mode === 'silent'}
				<div>
					<div class="text-[10px] tracking-[0.3em] text-white/40 mb-2">IF SILENT BIDS TIE</div>
					<div class="flex flex-wrap gap-2">
						{#each ties as [key, label]}
							<button
								onclick={() => (tie = key)}
								class="px-3 py-2 rounded-lg text-sm font-bold"
								style={tie === key
									? `background:${red}; color:#fff`
									: 'background:#0e0e18; border:1px solid #23233a; color:rgba(255,255,255,.6)'}
							>{label}</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="px-5 pb-8 pt-4 space-y-2">
			{#if err}<div class="text-[12px] text-center" style="color:{red}">{err}</div>{/if}
			<button
				onclick={create}
				disabled={creating}
				class="w-full py-4 rounded-xl disabled:opacity-50"
				style="background:{blue}; color:#0b0b12; font-weight:900; font-style:italic; font-size:18px"
			>{creating ? 'CREATING…' : 'INVITE A FRIEND'}</button>
			<button
				disabled
				title="Coming soon"
				class="w-full py-3 rounded-xl text-sm tracking-[0.25em] font-bold text-white/30 cursor-not-allowed"
				style="background:rgba(255,255,255,.04)"
			>MATCH A RANDOM · SOON</button>
		</div>
	</div>
</div>
