<script lang="ts">
	import { onMount } from 'svelte';

	// Asks for a display name once per browser, then remembers it.
	// Native <dialog> → Esc, focus trap, backdrop and inertness for free.
	let { name = $bindable(''), open = $bindable(false) } = $props();

	let dlg = $state<HTMLDialogElement>();
	let entry = $state('');

	onMount(() => {
		name = localStorage.getItem('bw_name') ?? '';
		if (!name) open = true;
	});

	$effect(() => {
		if (open) {
			entry = name;
			dlg?.showModal();
		} else dlg?.close();
	});

	function save() {
		const v = entry.trim().slice(0, 16);
		if (!v) return;
		name = v;
		localStorage.setItem('bw_name', v);
		open = false;
	}
</script>

<dialog bind:this={dlg} onclose={() => (open = false)} class="namegate">
	<div class="text-center">
		<div class="text-[11px] tracking-[0.4em] text-white/50">WELCOME TO</div>
		<div style="font-style:italic;font-weight:900;font-size:36px" class="mb-3">BID WAR</div>
	</div>
	<div class="text-sm text-white/50 text-center mb-3">What should we call you?</div>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:value={entry}
		maxlength="16"
		autofocus
		placeholder="your name"
		aria-label="Your name"
		onkeydown={(e) => e.key === 'Enter' && save()}
		class="w-full rounded-xl px-4 py-3 text-lg text-center outline-none"
		style="background:#0e0e18;border:1px solid #23233a;color:#fff;font-style:italic;font-weight:900"
	/>
	<button
		onclick={save}
		class="w-full mt-3 py-3 rounded-xl active:scale-95 transition"
		style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">LET'S GO</button
	>
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
