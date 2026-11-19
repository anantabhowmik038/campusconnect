const publicColumns = 'e.id, e.title, e.category, e.image_url, e.start_time, e.end_time, ' +
  'e.capacity, e.status, e.club_id, c.name AS club_name';
const publishedEvents = "FROM events e JOIN clubs c ON c.id = e.club_id WHERE e.status = 'published'";

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

export async function findPublicEvent(pool, id) {
  const { rows: [event] } = await pool.query(
    `SELECT ${publicColumns}, e.description ${publishedEvents} AND e.id = $1`, [id],
  );
  return event;
}
