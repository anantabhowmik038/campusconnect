const campusDate = new Intl.DateTimeFormat('en-BD', {
  timeZone: 'Asia/Dhaka',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function EventCard({ event, href }) {
  return (
    <article className="discovery-card">
      {event.image_url && <img src={event.image_url} alt="" loading="lazy" />}
      <div className="discovery-card-content">
        {event.category && <span className="pill">{event.category}</span>}
        {href ? <h2><a href={href}>{event.title}</a></h2> : <h1>{event.title}</h1>}
        <p className="muted">{event.club_name}</p>
        <p><time dateTime={event.start_time}>{campusDate.format(new Date(event.start_time))}</time>
          {' – '}<time dateTime={event.end_time}>{campusDate.format(new Date(event.end_time))}</time></p>
        <p>Capacity {event.capacity}</p>
        {event.description && <p className="discovery-description">{event.description}</p>}
      </div>
    </article>
  );
}
