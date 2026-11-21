import { useCallback, useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(path, options) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Communication request failed.');
  return payload;
}

export default function F10Workspace() {
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem('campusconnect_token') || '');
  const [status, setStatus] = useState({ type: 'loading', message: 'Loading announcements...' });

  const loadAnnouncements = useCallback(async () => {
    try {
      const result = await request('/announcements');
      setAnnouncements(result.announcements);
      setStatus({ type: 'success', message: 'Announcements loaded.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!token.trim()) {
      setNotifications([]);
      return;
    }
    try {
      const result = await request('/notifications', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      setNotifications(result.notifications);
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }, [token]);

  useEffect(() => { void loadAnnouncements(); }, [loadAnnouncements]);
  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  async function markRead(notificationId) {
    try {
      await request(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      await loadNotifications();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  async function markAllRead() {
    try {
      await request('/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      await loadNotifications();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  return (
    <section id="communication" className="communication workspace">
      <div className="workspace-heading">
        <div><span className="eyebrow">F10 · COMMUNICATION</span><h2>Announcements & notifications</h2></div>
        <span className={`api-status ${status.type}`}>{status.message}</span>
      </div>
      <div className="communication-grid">
        <div className="communication-card">
          <div className="card-heading"><h3>Latest announcements</h3><button type="button" onClick={() => void loadAnnouncements()}>Refresh</button></div>
          {announcements.length === 0
            ? <p className="empty-state">No announcements are available yet.</p>
            : <div className="announcement-list">{announcements.map((announcement) => (
              <article className="announcement" key={announcement.id}>
                <div className="announcement-meta">{announcement.club_name || announcement.event_title || 'Campus'} · {new Date(announcement.created_at).toLocaleDateString()}</div>
                <h4>{announcement.title}</h4>
                <p>{announcement.content}</p>
              </article>
            ))}</div>}
        </div>
        <div className="communication-card">
          <div className="card-heading"><h3>Your notifications</h3>{token && <button type="button" onClick={() => void markAllRead()}>Mark all read</button>}</div>
          <label className="user-id-field">Authentication token
            <input
              type="password"
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                localStorage.setItem('campusconnect_token', event.target.value);
              }}
              placeholder="Bearer token from login"
            />
          </label>
          {!token
            ? <p className="empty-state">Enter an authentication token to load targeted notifications.</p>
            : notifications.length === 0
              ? <p className="empty-state">You have no notifications.</p>
              : <div className="notification-list">{notifications.map((notification) => (
                <article className={`notification ${notification.is_read ? 'read' : 'unread'}`} key={notification.id}>
                  <div><h4>{notification.title}</h4><p>{notification.message}</p><small>{new Date(notification.created_at).toLocaleString()}</small></div>
                  {!notification.is_read && <button type="button" onClick={() => void markRead(notification.id)}>Mark read</button>}
                </article>
              ))}</div>}
        </div>
      </div>
    </section>
  );
}
