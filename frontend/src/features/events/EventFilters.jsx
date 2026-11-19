export default function EventFilters({ query }) {
  function applyFilters(event) {
    event.preventDefault();
    const filters = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (value.trim()) filters.set(key, value.trim());
    }
    if (query.has('limit')) filters.set('limit', query.get('limit'));
    window.location.assign('/events?' + filters);
  }

  return (
    <form className="discovery-filters" action="/events" onSubmit={applyFilters}>
      <label>Search events<input name="search" type="search" maxLength={120} defaultValue={query.get('search') || ''} /></label>
      <label>Category<input name="category" maxLength={80} defaultValue={query.get('category') || ''} /></label>
      <label>From date<input name="from" type="date" defaultValue={query.get('from') || ''} /></label>
      <label>To date<input name="to" type="date" defaultValue={query.get('to') || ''} /></label>
      <label>Sort by start date
        <select name="sort" defaultValue={query.get('sort') || 'start_asc'}>
          <option value="start_asc">Earliest first</option>
          <option value="start_desc">Latest first</option>
        </select>
      </label>
      <div className="discovery-actions"><button type="submit">Apply filters</button><a href="/events">Clear</a></div>
    </form>
  );
}
