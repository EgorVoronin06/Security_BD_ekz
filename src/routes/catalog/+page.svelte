<script lang="ts">
	let { data } = $props();
</script>

<section class="card">
	<h2>Поиск клиентов</h2>
	<p>
		Используйте форму для поиска клиентов по email.
	</p>

	<form method="GET" class="inline-form" style="margin-top: 18px;">
		<label>
			Email
			<input name="q" value={data.q} placeholder="example.org, corp.local..." />
		</label>
		<button type="submit">Искать</button>
	</form>

</section>

<section class="table-wrap" style="margin-top: 18px;">
	<h2>Результаты</h2>
	{#if !data.q.trim()}
		<p style="margin-top: 12px;">Введите поисковый запрос, чтобы загрузить данные.</p>
	{:else}
		<table style="margin-top: 12px;">
			<thead>
				<tr>
					<th>ID</th>
					<th>ФИО</th>
					<th>Email</th>
					<th>Tier</th>
					<th>Owner</th>
				</tr>
			</thead>
			<tbody>
				{#if data.customers.length === 0}
					<tr>
						<td colspan="5">Совпадений не найдено.</td>
					</tr>
				{:else}
					{#each data.customers as customer}
						<tr>
							<td>{customer.id}</td>
							<td>{customer.full_name}</td>
							<td>{customer.email}</td>
							<td>{customer.tier}</td>
							<td>{customer.owner_user_id}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	{/if}
</section>
