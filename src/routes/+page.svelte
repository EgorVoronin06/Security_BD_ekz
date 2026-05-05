<script lang="ts">
	let { data } = $props();
</script>

<section class="grid hero">
	<div class="card hero-card">
		<div>
			<span class="eyebrow">Course Workspace</span>
			<h2>Портал данных для практического задания</h2>
			<p>
				Используйте разделы портала для работы с клиентскими данными, счетами, отчетами и
				журналом событий в рамках итоговой практики.
			</p>
		</div>

		<div class="stats">
			<div class="stat">
				<strong>{data.stats.users}</strong>
				<span>учетных записей</span>
			</div>
			<div class="stat">
				<strong>{data.stats.customers}</strong>
				<span>клиентов</span>
			</div>
			<div class="stat">
				<strong>{data.stats.invoices}</strong>
				<span>счетов</span>
			</div>
			<div class="stat">
				<strong>{data.stats.audits}</strong>
				<span>записей аудита</span>
			</div>
		</div>
	</div>

	<aside class="note">
		<h2>Учетная запись для входа</h2>
		<table>
			<thead>
				<tr>
					<th>Login</th>
					<th>Password</th>
				</tr>
			</thead>
			<tbody>
				{#each data.demoUsers as user}
					<tr>
						<td class="hint">{user.username}</td>
						<td class="hint">{user.password}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p>Используйте эти учетные записи для входа и исследования поведения системы.</p>
	</aside>
</section>

<section class="card" style="margin-top: 18px;">
	<h2>Основные разделы</h2>
	<div class="list" style="margin-top: 16px;">
		<article>
			<h3><a href="/catalog">Клиентский каталог</a></h3>
			<p>Поиск и просмотр клиентских записей.</p>
		</article>
		<article>
			<h3><a href="/reports">Отчеты</a></h3>
			<p>Формирование выборок по счетам и связанным данным.</p>
		</article>
		<article>
			<h3><a href="/admin/users">Пользователи</a></h3>
			<p>Список учетных записей и рабочие параметры доступа.</p>
		</article>
		<article>
			<h3><a href="/audit">Журнал событий</a></h3>
			<p>История системных действий и операций.</p>
		</article>
	</div>
</section>

<section class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 18px;">
	<div class="card">
		<h2>Контекст задания</h2>
		<p>
			Практика охватывает прикладную логику, доступ к данным, роли пользователей и работу с
			PostgreSQL в контейнеризированной среде.
		</p>
	</div>

	<div class="card">
		<h2>Среда</h2>
		<p>
			Стенд предназначен для локального использования в рамках курса и поднимается через Docker.
		</p>
	</div>
</section>
