<script lang="ts">
	// Animated versus split. Intro plays per player count, then settles on the tilted conic:
	//   2p → two halves SLAM together   3p → colours SPIN in like a wheel   4p → 2 slide in, 2 slide over.
	// Parent replays it by wrapping in {#key count}. Colours darken via color-mix; honours reduced-motion.
	let { count = 4, colors = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'] }: {
		count?: number;
		colors?: string[];
	} = $props();

	const vars = $derived(colors.map((c, i) => `--c${i}:${c}`).join(';'));
	const conic = $derived(
		{
			2: 'conic-gradient(from 25deg,var(--t1) 0 180deg,var(--t0) 180deg 360deg)',
			3: 'conic-gradient(from 10deg,var(--t1) 0 120deg,var(--t0) 120deg 240deg,var(--t2) 240deg 360deg)',
			4: 'conic-gradient(from 28deg,var(--t1) 0 90deg,var(--t3) 90deg 180deg,var(--t0) 180deg 270deg,var(--t2) 270deg 360deg)'
		}[count] ?? ''
	);
</script>

<div class="split c{count}" style="{vars};--conic:{conic}">
	<div class="resting" style="background:{conic}"></div>

	{#if count === 2}
		<div class="p slamL"></div>
		<div class="p slamR"></div>
		<div class="flash"></div>
	{:else if count === 3}
		<div class="spinner" style="background:{conic}"></div>
	{:else}
		<div class="p qL"></div>
		<div class="p qR"></div>
		<div class="p qBL"></div>
		<div class="p qBR"></div>
	{/if}
</div>

<style>
	.split {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #0b0b12;
		--dark: #0b0b12;
		--t0: color-mix(in srgb, var(--c0) 26%, var(--dark));
		--t1: color-mix(in srgb, var(--c1) 26%, var(--dark));
		--t2: color-mix(in srgb, var(--c2) 26%, var(--dark));
		--t3: color-mix(in srgb, var(--c3) 26%, var(--dark));
	}
	.resting {
		position: absolute;
		inset: 0;
		opacity: 0;
		animation: fadeInLate 1.15s forwards;
	}
	.p {
		position: absolute;
	}
	.flash {
		position: absolute;
		inset: 0;
		background: #fff;
		opacity: 0;
		pointer-events: none;
		animation: flash 1.1s forwards;
	}

	/* 2 players — slam */
	.c2 {
		animation: shake 1.1s;
	}
	.slamL {
		left: 0;
		top: 0;
		width: 50%;
		height: 100%;
		background: var(--t0);
		animation: slamL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.15s forwards;
	}
	.slamR {
		right: 0;
		top: 0;
		width: 50%;
		height: 100%;
		background: var(--t1);
		animation: slamR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.15s forwards;
	}

	/* 3 players — spin in like a wheel */
	.spinner {
		position: absolute;
		inset: 0;
		transform-origin: 50% 50%;
		animation: spinIn 0.95s cubic-bezier(0.2, 0.85, 0.25, 1) forwards, fadeOutLate 1.2s forwards;
	}

	/* 4 players — two halves slide in, then two slide over */
	.qL {
		left: 0;
		top: 0;
		width: 50%;
		height: 100%;
		background: var(--t2);
		animation: inLeft 0.45s ease-out forwards, fadeOutLate 1.15s forwards;
	}
	.qR {
		right: 0;
		top: 0;
		width: 50%;
		height: 100%;
		background: var(--t1);
		animation: inRight 0.45s ease-out forwards, fadeOutLate 1.15s forwards;
	}
	.qBL {
		left: 0;
		bottom: 0;
		width: 50%;
		height: 50%;
		background: var(--t0);
		animation: slideUp 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.42s both, fadeOutLate 1.15s forwards;
	}
	.qBR {
		right: 0;
		bottom: 0;
		width: 50%;
		height: 50%;
		background: var(--t3);
		animation: slideUp 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) 0.42s both, fadeOutLate 1.15s forwards;
	}

	@keyframes slamL {
		0% { transform: translateX(-100%); }
		70% { transform: translateX(4%); }
		85% { transform: translateX(-2%); }
		100% { transform: translateX(0); }
	}
	@keyframes slamR {
		0% { transform: translateX(100%); }
		70% { transform: translateX(-4%); }
		85% { transform: translateX(2%); }
		100% { transform: translateX(0); }
	}
	@keyframes inLeft {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(0); }
	}
	@keyframes inRight {
		0% { transform: translateX(100%); }
		100% { transform: translateX(0); }
	}
	@keyframes slideUp {
		0% { transform: translateY(100%); }
		80% { transform: translateY(-3%); }
		100% { transform: translateY(0); }
	}
	@keyframes spinIn {
		0% { transform: rotate(-220deg) scale(0.12); opacity: 0; }
		30% { opacity: 1; }
		75% { transform: rotate(8deg) scale(1.04); }
		100% { transform: rotate(0) scale(1); opacity: 1; }
	}
	@keyframes flash {
		0%, 52% { opacity: 0; }
		60% { opacity: 0.55; }
		100% { opacity: 0; }
	}
	@keyframes shake {
		0%, 52% { transform: translate(0, 0); }
		58% { transform: translate(-7px, 3px); }
		64% { transform: translate(6px, -3px); }
		72% { transform: translate(-3px, 2px); }
		80%, 100% { transform: translate(0, 0); }
	}
	@keyframes fadeInLate {
		0%, 72% { opacity: 0; }
		100% { opacity: 1; }
	}
	@keyframes fadeOutLate {
		0%, 72% { opacity: 1; }
		100% { opacity: 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.resting { opacity: 1; animation: none; }
		.p, .flash, .spinner { display: none; }
		.c2 { animation: none; }
	}
</style>
