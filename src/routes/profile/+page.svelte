<script lang="ts">
	let { data } = $props();

	let status = $state('');
	let saving = $state(false);

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();

		const form = event.currentTarget as HTMLFormElement;
		const formData = new FormData(form);

		saving = true;
		status = '';

		try {
			const response = await fetch(`/api/users/${data.profile.id}/profile`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				status = 'Не удалось сохранить изменения.';
				return;
			}

			status = 'Изменения сохранены.';
		} finally {
			saving = false;
		}
	}
</script>

<section class="card" style="max-width: 760px;">
	<h2>Профиль пользователя</h2>
	<p>Обновите контактные данные и параметры отображения учетной записи.</p>

	<form class="stack" style="margin-top: 18px;" onsubmit={saveProfile}>
		<label>
			Username
			<input value={data.profile.username} disabled />
		</label>

		<label>
			Full name
			<input name="fullName" value={data.profile.full_name} />
		</label>

		<label>
			Email
			<input name="email" type="email" value={data.profile.email} />
		</label>

		<button type="submit" disabled={saving}>
			{saving ? 'Сохранение...' : 'Сохранить профиль'}
		</button>
	</form>

	{#if status}
		<div class="banner" style="margin-top: 16px;">{status}</div>
	{/if}
</section>
