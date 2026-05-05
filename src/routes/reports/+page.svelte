<script lang="ts">
	let { data, form } = $props();
</script>

<section class="card">
	<h2>Пользовательские SQL-отчеты</h2>
	<p>
		Введите условие фильтрации для формирования отчета по счетам и связанным данным.
	</p>

	<form method="POST" class="stack" style="margin-top: 18px;">
		<label>
			WHERE fragment
			<textarea name="whereClause">{form?.whereClause ?? data.whereClause}</textarea>
		</label>
		<button type="submit">Запустить отчет</button>
	</form>

	{#if form?.error}
		<div class="banner" style="margin-top: 16px;">{form.error}</div>
	{/if}
</section>

<section class="table-wrap" style="margin-top: 18px;">
	<h2>Результаты</h2>
	<table style="margin-top: 12px;">
		<thead>
			<tr>
				<th>Customer</th>
				<th>Amount</th>
				<th>Owner</th>
				<th>Card hint</th>
			</tr>
		</thead>
		<tbody>
			{#if (form?.results ?? data.results).length === 0}
				<tr>
					<td colspan="4">Нет данных для отображения.</td>
				</tr>
			{:else}
				{#each form?.results ?? data.results as row}
					<tr>
						<td>{row.customer_name}</td>
						<td>{row.amount}</td>
						<td>{row.owner_name}</td>
						<td>{row.card_hint}</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</section>
