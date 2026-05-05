<script lang="ts">
	let { form } = $props();
</script>

<section class="form-panel" style="max-width: 520px; margin: 36px auto 0;">
	<h2>Вход в учебный портал</h2>
	<p>Используйте один из демо-аккаунтов с главной страницы.</p>

	{#if form?.error}
		<div class="banner" style="margin-top: 16px;">{form.error}</div>
	{/if}

	<form method="POST" class="stack" style="margin-top: 18px;">
		<label>
			Username
			<input name="username" autocomplete="username" />
		</label>

		<label>
			Password
			<input name="password" type="password" autocomplete="current-password" />
		</label>

		<button type="submit">Войти</button>
	</form>
</section>

