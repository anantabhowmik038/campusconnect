const publicColumns = 'e.id, e.title, e.category, e.image_url, e.start_time, e.end_time, ' +
  'e.capacity, e.status, e.club_id, c.name AS club_name';
const publishedEvents = "FROM events e JOIN clubs c ON c.id = e.club_id WHERE e.status = 'published'";

/**
 * Lists published events only. Date filters are interpreted in Bangladesh time.
 * Search matches title or description literally, and event ID breaks ties in start-time order.
 *
 * @async
 * @param {pg.Pool} pool - Database pool.
 * @param {object} filters - Validated discovery filters.
 * @param {string} [filters.search] - Case-insensitive title or description substring.
 * @param {string} [filters.category] - Case-insensitive exact category.
 * @param {?string} [filters.from] - Inclusive start date in YYYY-MM-DD format.
 * @param {?string} [filters.to] - Inclusive end date in YYYY-MM-DD format.
 * @param {number} filters.page - One-based page number.
 * @param {number} filters.limit - Maximum rows per page.
 * @param {'start_asc'|'start_desc'} filters.sort - Start-time ordering.
 * @returns {Promise<{data: object[], pagination: {page: number, limit: number, total: number}}>} Public rows and pagination metadata.
 */
export async function listPublicEvents(pool, { search, category, from, to, page, limit, sort }) {
  const order = sort === 'start_desc' ? 'start_time DESC, id DESC' : 'start_time ASC, id ASC';
  const { rows: [result] } = await pool.query(
    `WITH matching AS (
       SELECT ${publicColumns}
       ${publishedEvents}
         AND ($1::text IS NULL OR strpos(lower(e.title), lower($1)) > 0
              OR strpos(lower(e.description), lower($1)) > 0)
         AND ($2::text IS NULL OR lower(e.category) = lower($2))
         AND ($3::date IS NULL OR e.start_time >= ($3::date::timestamp AT TIME ZONE 'Asia/Dhaka'))
         AND ($4::date IS NULL OR e.start_time < (($4::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka'))
     ), page_rows AS (
       SELECT * FROM matching ORDER BY ${order} LIMIT $5 OFFSET $6
     )
     SELECT COALESCE((SELECT jsonb_agg(page_rows ORDER BY ${order}) FROM page_rows), '[]') AS data,
            (SELECT count(*) FROM matching) AS total`,
    [search || null, category || null, from, to, limit, (page - 1) * limit],
  );
  return { data: result.data, pagination: { page, limit, total: Number(result.total) } };
}

/**
 * Fetches public event details, including the description. Only published events are eligible.
 *
 * @async
 * @param {pg.Pool} pool - Database pool.
 * @param {string} id - Event UUID.
 * @returns {Promise<object|undefined>} Public event row or undefined if no published event matches.
 */
export async function findPublicEvent(pool, id) {
  const { rows: [event] } = await pool.query(
    `SELECT ${publicColumns}, e.description ${publishedEvents} AND e.id = $1`, [id],
  );
  return event;
}
