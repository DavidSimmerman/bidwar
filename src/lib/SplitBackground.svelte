<script lang="ts">
	// Animated versus split. Bright pieces play the intro, then crossfade to the dark tilted conic.
	//   2p → two DIAGONAL halves slam together   3p → a circular colour-wheel spins in
	//   4p → blue+red connect (a 2p fake-out), then green+gold slide in over the corners.
	// Everything is overscanned so the screen-shake never reveals black edges. Honours reduced-motion.
	let { count = 4, colors = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'] }: {
		count?: number;
		colors?: string[];
	} = $props();

	const vars = $derived(colors.map((c, i) => `--c${i}:${c}`).join(';'));
	// dark resting conic (settled look)
	const rest = $derived(
		{
			2: 'conic-gradient(from 25deg,var(--t1) 0 180deg,var(--t0) 180deg 360deg)',
			3: 'conic-gradient(from 10deg,var(--t1) 0 120deg,var(--t0) 120deg 240deg,var(--t2) 240deg 360deg)',
			4: 'conic-gradient(from 28deg,var(--t1) 0 90deg,var(--t3) 90deg 180deg,var(--t0) 180deg 270deg,var(--t2) 270deg 360deg)'
		}[count] ?? ''
	);
	// bright colour-wheel used by the 3p spinner
	const bright3 = 'conic-gradient(from 10deg,var(--c1) 0 120deg,var(--c0) 120deg 240deg,var(--c2) 240deg 360deg)';
</script>

<div class="split c{count}" style={vars}>
	<div class="stage">
		<div class="resting" style="background:{rest}"></div>

		{#if count === 2}
			<div class="p slamL"></div>
			<div class="p slamR"></div>
			<div class="flash"></div>
		{:else if count === 3}
			<div class="spinner" style="background:{bright3}"></div>
		{:else}
			<div class="p slamL"></div>
			<div class="p slamR"></div>
			<div class="p cornerTL"></div>
			<div class="p cornerBR"></div>
		{/if}
	</div>
</div>

<style>
	.split {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #0b0b12;
		--t0: color-mix(in srgb, var(--c0) 26%, #0b0b12);
		--t1: color-mix(in srgb, var(--c1) 26%, #0b0b12);
		--t2: color-mix(in srgb, var(--c2) 26%, #0b0b12);
		--t3: color-mix(in srgb, var(--c3) 26%, #0b0b12);
	}
	.stage {
		position: absolute;
		inset: -8%; /* overscan → shake never reveals an edge */
	}
	.resting {
		position: absolute;
		inset: 0;
		/* dark settled conic sits underneath the whole time → no black gaps, and the bright
		   pieces just fade away to reveal it (vibrant → dark). */
	}
	.p {
		position: absolute;
		inset: 0;
		animation-fill-mode: both;
	}
	.flash {
		position: absolute;
		inset: 0;
		background: #fff;
		opacity: 0;
		animation: flash 1.15s forwards;
	}

	/* ---- 2 players: diagonal slam ---- */
	.c2 {
		animation: shake 1.15s;
	}
	.c2 .slamL {
		background: var(--c0);
		clip-path: polygon(0 0, 60% 0, 40% 100%, 0 100%);
		animation: inL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.2s forwards;
	}
	.c2 .slamR {
		background: var(--c1);
		clip-path: polygon(60% 0, 100% 0, 100% 100%, 40% 100%);
		animation: inR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.2s forwards;
	}

	/* ---- 3 players: circular spinner (bigger than frame → no corners) ---- */
	.spinner {
		position: absolute;
		width: 240%;
		height: 240%;
		left: -70%;
		top: -70%;
		border-radius: 50%;
		transform-origin: center;
		animation: spin 1s cubic-bezier(0.15, 0.85, 0.25, 1) forwards, fadeOutLate 1.3s forwards;
	}

	/* ---- 4 players: blue+red fake-out, then green+gold over the corners ---- */
	.c4 .slamL {
		background: var(--c0); /* blue, lower-left */
		clip-path: polygon(0 0, 55% 0, 45% 100%, 0 100%);
		animation: inL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.35s forwards;
	}
	.c4 .slamR {
		background: var(--c1); /* red, upper-right */
		clip-path: polygon(55% 0, 100% 0, 100% 100%, 45% 100%);
		animation: inR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.35s forwards;
	}
	.cornerTL {
		background: var(--c2); /* green, top-left */
		clip-path: polygon(0 0, 64% 0, 0 64%);
		animation: inTL 0.55s cubic-bezier(0.2, 0.85, 0.3, 1) 0.5s both, fadeOutLate 1.35s forwards;
	}
	.cornerBR {
		background: var(--c3); /* gold, bottom-right */
		clip-path: polygon(100% 36%, 100% 100%, 36% 100%);
		animation: inBR 0.55s cubic-bezier(0.2, 0.85, 0.3, 1) 0.5s both, fadeOutLate 1.35s forwards;
	}

	@keyframes inL { 0% { transform: translateX(-130%); } 100% { transform: translateX(0); } }
	@keyframes inR { 0% { transform: translateX(130%); } 100% { transform: translateX(0); } }
	@keyframes inTL { 0% { transform: translate(-80%, -80%); } 100% { transform: translate(0, 0); } }
	@keyframes inBR { 0% { transform: translate(80%, 80%); } 100% { transform: translate(0, 0); } }
	@keyframes spin {
		0% { transform: rotate(-460deg) scale(0.75); opacity: 0; }
		20% { opacity: 1; }
		100% { transform: rotate(0) scale(1); opacity: 1; }
	}
	@keyframes flash {
		0%, 40% { opacity: 0; }
		48% { opacity: 0.5; }
		100% { opacity: 0; }
	}
	@keyframes shake {
		0%, 40% { transform: translate(0, 0); }
		46% { transform: translate(-6px, 3px); }
		52% { transform: translate(6px, -3px); }
		60% { transform: translate(-3px, 2px); }
		68%, 100% { transform: translate(0, 0); }
	}
	@keyframes fadeInLate { 0%, 74% { opacity: 0; } 100% { opacity: 1; } }
	@keyframes fadeOutLate { 0%, 74% { opacity: 1; } 100% { opacity: 0; } }

	@media (prefers-reduced-motion: reduce) {
		.resting { opacity: 1; animation: none; }
		.p, .flash, .spinner { display: none; }
		.c2 { animation: none; }
	}
</style>
