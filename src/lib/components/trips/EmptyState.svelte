<script lang="ts">
	interface Props {
		message: string;
	}

	let { message }: Props = $props();
</script>

<div class="empty-state">
	<p class="empty-message">{message}</p>
</div>

<style>
	.empty-state {
		padding: 1rem 0;
	}

	.empty-message {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
	}
</style>
