<script lang="ts">
	let { data } = $props();
</script>

<section class="card">
	<h2>Invoice #{data.invoice.id}</h2>
	<p>Детали счета, клиента и связанной финансовой информации.</p>
</section>

<section class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 18px;">
	<div class="card">
		<h2>Финансовые данные</h2>
		<table style="margin-top: 12px;">
			<tbody>
				<tr>
					<th>Customer</th>
					<td>{data.invoice.customer_name}</td>
				</tr>
				<tr>
					<th>Email</th>
					<td>{data.invoice.customer_email}</td>
				</tr>
				<tr>
					<th>Amount</th>
					<td>{data.invoice.amount}</td>
				</tr>
				<tr>
					<th>Status</th>
					<td>{data.invoice.status}</td>
				</tr>
				<tr>
					<th>Card hint</th>
					<td>{data.invoice.card_hint}</td>
				</tr>
			</tbody>
		</table>
	</div>

	<div class="card">
		<h2>Внутренние заметки</h2>
		<p>{data.invoice.notes}</p>
		<p style="margin-top: 16px;">
			Владелец объекта: <strong>{data.invoice.owner_username}</strong>
		</p>
		<p>Дата создания: {new Date(data.invoice.created_at).toLocaleString('ru-RU')}</p>
	</div>
</section>
