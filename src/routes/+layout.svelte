<script lang="ts">
	import '../app.css';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>Training Data Portal</title>
	<meta
		name="description"
		content="Учебный портал для итоговой практики по работе с PostgreSQL и веб-приложением."
	/>
</svelte:head>

<div class="shell">
	<header class="topbar">
		<div class="brand">
			<p class="eyebrow">Training Data Portal</p>
			<h1>Internal Operations Workspace</h1>
			<p>Внутренний портал для работы с клиентами, отчетами и журналом событий.</p>
		</div>

		<div class="nav">
			<a href="/">Главная</a>
			<a href="/profile">Профиль</a>
			<a href="/catalog">Клиенты</a>
			<a href="/reports">SQL Reports</a>
			<a href="/audit">Аудит</a>
			{#if data.user}
				<a href="/invoices/f11d0794-51d4-4824-8c4e-7d79c42f1275">Invoice demo</a>
				<a href="/logout">Выход</a>
			{:else}
				<a href="/login">Вход</a>
			{/if}
		</div>
	</header>

	<div class="meta">
		{#if data.user}
			Сессия: <strong>{data.user.username}</strong> ({data.user.role})
		{:else}
			Гость. Для входа используйте учетные данные, выданные для практики.
		{/if}
	</div>

	{@render children()}
</div>
