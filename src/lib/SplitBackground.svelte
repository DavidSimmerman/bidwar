<script lang="ts">
	// Animated versus split. Bright pieces play the intro, then hand off to the dark tilted conic.
	//   2p → two halves slam together   3p → a colour-wheel spins in   4p → left+right wedges
	//   slam, then top+bottom wedges drop in.
	// Every piece is a slice of the SAME conic-gradient as the resting state (just one colour +
	// transparent), so the animated angles are identical to the final angles by construction —
	// no aspect-ratio maths, no clip-path guessing. Honours reduced-motion.
	// preview=true → muted tint colours (home page); false → bright (game start).
	let { count = 4, colors = ['#5b8cff', '#ff5f4d', '#35d07f', '#ffb020'], preview = false }: {
		count?: number;
		colors?: string[];
		preview?: boolean;
	} = $props();

	const vars = $derived(colors.map((c, i) => `--c${i}:${c}`).join(';'));
	const rest = $derived(
		{
			2: 'conic-gradient(from 25deg,var(--t1) 0 180deg,var(--t0) 180deg 360deg)',
			3: 'conic-gradient(from 10deg,var(--t1) 0 120deg,var(--t0) 120deg 240deg,var(--t2) 240deg 360deg)',
			4: 'conic-gradient(from 28deg,var(--t1) 0 90deg,var(--t3) 90deg 180deg,var(--t0) 180deg 270deg,var(--t2) 270deg 360deg)'
		}[count] ?? ''
	);
	const spinner3 = $derived(preview
		? 'conic-gradient(from 10deg,var(--t1) 0 120deg,var(--t0) 120deg 240deg,var(--t2) 240deg 360deg)'
		: 'conic-gradient(from 10deg,var(--c1) 0 120deg,var(--c0) 120deg 240deg,var(--c2) 240deg 360deg)');
</script>

<div class="split c{count}" class:preview style={vars}>
	<div class="stage">
		<div class="resting" style="background:{rest}"></div>

		{#if count === 2}
			<div class="p slamL"></div>
			<div class="p slamR"></div>
			<div class="flash"></div>
		{:else if count === 3}
			<div class="spinner-wrap">
				<div class="spinner" style="background:{spinner3}"></div>
			</div>
		{:else}
			<div class="p slamL"></div>
			<div class="p slamR"></div>
			<div class="p wedgeTop"></div>
			<div class="p wedgeBot"></div>
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
		/* animation pieces use bright colours by default, tint in preview */
		--ac0: var(--c0); --ac1: var(--c1); --ac2: var(--c2); --ac3: var(--c3);
	}
	.split.preview {
		--ac0: var(--t0); --ac1: var(--t1); --ac2: var(--t2); --ac3: var(--t3);
	}
	.stage {
		position: absolute;
		inset: -8%; /* overscan → shake never reveals an edge */
	}

	.resting { position: absolute; inset: 0; }
	/* Resting conic stays BLACK until the pieces cover the screen (~44%), then snaps solid
	   underneath them, so when they fade out (74→100%) they reveal a solid conic — no
	   crossfade dip through the near-black background (that dip read as a "black flash"). */
	.c2 .resting  { animation: restIn 1.2s  forwards; }
	.c3 .resting  { animation: restIn 1.3s  forwards; }
	.c4 .resting  { animation: restIn 1.35s forwards; }

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

	/* ---- 2p: two halves of the resting conic (from 25deg) slam together ---- */
	.c2 { animation: shake 1.15s; }
	.preview.c2 { animation: none; }
	.c2 .slamL {
		background: conic-gradient(from 25deg, transparent 0 180deg, var(--ac0) 180deg 360deg);
		animation: inL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.2s forwards;
	}
	.c2 .slamR {
		background: conic-gradient(from 25deg, var(--ac1) 0 180deg, transparent 180deg 360deg);
		animation: inR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.2s forwards;
	}

	/* ---- 3p: circular spinner (250vmax = square regardless of aspect ratio) ---- */
	.spinner-wrap {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeOutLate 1.3s forwards;
	}
	.spinner {
		width: 250vmax;
		height: 250vmax;
		flex-shrink: 0;
		border-radius: 50%;
		transform-origin: center;
		animation: spin 1s cubic-bezier(0.15, 0.85, 0.25, 1) forwards;
	}

	/* ---- 4p: each piece is one 90° wedge of the resting conic (from 28deg) ----
	   right(red)+left(blue) slam in horizontally, then top(green)+bottom(gold) drop in.
	   Because every wedge shares the resting conic's `from 28deg` + 90° arcs, the settled
	   result is pixel-identical to the resting state. */
	.c4 .slamL {  /* blue — left wedge, 208°→298° */
		background: conic-gradient(from 28deg, transparent 0 180deg, var(--ac0) 180deg 270deg, transparent 270deg 360deg);
		animation: inL 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.35s forwards;
	}
	.c4 .slamR {  /* red — right wedge, 28°→118° */
		background: conic-gradient(from 28deg, var(--ac1) 0 90deg, transparent 90deg 360deg);
		animation: inR 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) forwards, fadeOutLate 1.35s forwards;
	}
	.c4 .wedgeTop {  /* green — top wedge, 298°→28° */
		background: conic-gradient(from 28deg, transparent 0 270deg, var(--ac2) 270deg 360deg);
		animation: inTop 0.55s cubic-bezier(0.2, 0.85, 0.3, 1) 0.5s both, fadeOutLate 1.35s forwards;
	}
	.c4 .wedgeBot {  /* gold — bottom wedge, 118°→208° */
		background: conic-gradient(from 28deg, transparent 0 90deg, var(--ac3) 90deg 180deg, transparent 180deg 360deg);
		animation: inBot 0.55s cubic-bezier(0.2, 0.85, 0.3, 1) 0.5s both, fadeOutLate 1.35s forwards;
	}

	@keyframes inL   { from { transform: translateX(-130%); } to { transform: translateX(0); } }
	@keyframes inR   { from { transform: translateX(130%);  } to { transform: translateX(0); } }
	@keyframes inTop { from { transform: translateY(-115%); } to { transform: translateY(0); } }
	@keyframes inBot { from { transform: translateY(115%);  } to { transform: translateY(0); } }
	@keyframes spin  { 0% { transform: rotate(-460deg) scale(0.75); } 100% { transform: rotate(0) scale(1); } }
	@keyframes flash { 0%, 40% { opacity: 0; } 48% { opacity: 0.5; } 100% { opacity: 0; } }
	@keyframes shake {
		0%, 40%  { transform: translate(0, 0); }
		46%      { transform: translate(-6px, 3px); }
		52%      { transform: translate(6px, -3px); }
		60%      { transform: translate(-3px, 2px); }
		68%, 100% { transform: translate(0, 0); }
	}
	@keyframes restIn      { 0%, 44% { opacity: 0; } 56%, 100% { opacity: 1; } }
	@keyframes fadeOutLate { 0%, 74% { opacity: 1; } 100% { opacity: 0; } }

	@media (prefers-reduced-motion: reduce) {
		.c2 { animation: none; }
		.p, .flash, .spinner-wrap { display: none; }
	}
</style>
