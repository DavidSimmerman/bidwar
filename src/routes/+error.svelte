<script lang="ts">
	import { page } from '$app/state';

	// A dead draft link is the likely way to land here, but this is the root error
	// page — only claim "that draft is gone" when the URL was actually a draft.
	const missingDraft = $derived(page.status === 404 && page.url.pathname.startsWith('/setup/'));
	const message = $derived(
		missingDraft ? 'That draft is gone' : page.status === 404 ? 'Nothing here' : (page.error?.message ?? 'Something broke')
	);
</script>

<div
	class="min-h-screen flex items-center justify-center px-6"
	style="background:#0a0a0c; font-family:'Archivo',sans-serif"
>
	<div class="text-center max-w-[380px] stagger">
		<div style="font-style:italic;font-weight:900;font-size:84px;line-height:1;color:#ff5f4d" class="smash-in">
			{page.status}
		</div>
		<div class="text-[11px] tracking-[0.4em] text-white/40 mt-2">BID WAR</div>
		<div style="font-style:italic;font-weight:900;font-size:26px" class="text-white mt-3">{message}</div>
		<div class="text-[13px] text-white/35 mt-2">
			{missingDraft
				? 'It may have been deleted by whoever made it — the rest of the market is still there.'
				: 'That link went nowhere. The market is this way.'}
		</div>
		<a
			href="/"
			class="press inline-block mt-6 px-6 py-3.5 rounded-xl text-[15px]"
			style="background:#5b8cff;color:#0b0b12;font-weight:900;font-style:italic">BACK TO THE MARKET</a
		>
	</div>
</div>
