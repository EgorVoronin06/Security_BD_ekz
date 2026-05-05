<script lang="ts">
	let { data } = $props();
</script>

<section class="card">
	<h2>Журнал аудита</h2>
	<p>Хронология событий, операций и служебных действий в системе.</p>
</section>

<section class="table-wrap" style="margin-top: 18px;">
	<table>
		<thead>
			<tr>
				<th>Time</th>
				<th>Actor</th>
				<th>Action</th>
				<th>Details</th>
			</tr>
		</thead>
		<tbody>
			{#each data.events as event}
				<tr>
					<td>{new Date(event.created_at).toLocaleString('ru-RU')}</td>
					<td>{event.actor_username}</td>
					<td>{event.action}</td>
					<td>{event.details}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
