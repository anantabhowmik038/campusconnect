import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';
const API_BASE = rawApiBase.endsWith('/api')
  ? rawApiBase
  : `${rawApiBase.replace(/\/+$/, '')}/api`;
const CLUBS_API = `${API_BASE}/clubs`;

const CATEGORIES = ['All', 'Technology', 'Cultural', 'Sports', 'Academic', 'Social'];

function readAuthFromStorage() {
  try {
    const token = localStorage.getItem('token') || '';
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token, user };
  } catch {
    return { token: '', user: null };
  }
}

export default function ClubsPage() {
  const [auth, setAuth] = useState(() => readAuthFromStorage());

  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [includeAllAdmin, setIncludeAllAdmin] = useState(false);

  const [selectedClub, setSelectedClub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create club form state (campus_admin or club_officer only)
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Technology');
  const [newDescription, setNewDescription] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');

  // Edit club form state (authorized officer or campus_admin)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  const syncAuth = useCallback(() => {
    const nextAuth = readAuthFromStorage();
    setAuth((prev) => {
      if (
        prev.token === nextAuth.token &&
        JSON.stringify(prev.user) === JSON.stringify(nextAuth.user)
      ) {
        return prev;
      }
      return nextAuth;
    });
  }, []);

  useEffect(() => {
    syncAuth();
    const handleStorage = () => syncAuth();
    const handleFocus = () => syncAuth();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    const interval = window.setInterval(syncAuth, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(interval);
    };
  }, [syncAuth]);

  const token = auth.token;
  const currentUser = auth.user;
  const isAuthenticated = Boolean(token);
  const role = currentUser?.role || 'guest';
  const isAdmin = role === 'campus_admin';
  const isOfficer = role === 'club_officer';
  const canCreateClub = Boolean(isAuthenticated && (isAdmin || isOfficer));

  useEffect(() => {
    if (!isAuthenticated) {
      setSelectedClub(null);
      setIsEditing(false);
      setIncludeAllAdmin(false);
    }
  }, [isAuthenticated]);

  const canEditSelectedClub =
    Boolean(isAuthenticated && selectedClub && currentUser) &&
    (isAdmin || (isOfficer && selectedClub.officer_user_id === currentUser.id));

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category && category !== 'All') params.set('category', category);
      if (includeAllAdmin && isAdmin) params.set('includeAll', 'true');

      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const queryString = params.toString();
      const url = queryString ? `${CLUBS_API}?${queryString}` : CLUBS_API;

      const response = await fetch(url, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load clubs.');
      }

      setClubs(Array.isArray(data.clubs) ? data.clubs : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, category, includeAllAdmin, isAdmin, token]);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const handleQuickLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    syncAuth();
    setSelectedClub(null);
    setIsEditing(false);
    setNotice('Signed out. Viewing public club status and member counts.');
  };

  const handleSelectClub = async (clubId) => {
    syncAuth();
    const latest = readAuthFromStorage();
    if (!latest.token) {
      setSelectedClub(null);
      setNotice('Join or log in to CampusConnect to view club details, owner info, and members.');
      return;
    }

    setError('');
    setNotice('');
    setIsEditing(false);
    try {
      const response = await fetch(`${CLUBS_API}/${clubId}`, {
        headers: {
          Authorization: `Bearer ${latest.token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Club not found.');
      }

      const normalizedMembers = Array.isArray(data.club?.members) ? data.club.members : [];
      setSelectedClub({
        ...data.club,
        members: normalizedMembers,
      });
    } catch (err) {
      setSelectedClub(null);
      setError(err.message);
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const latest = readAuthFromStorage();
    const latestRole = latest.user?.role;
    if (!latest.token || (latestRole !== 'campus_admin' && latestRole !== 'club_officer')) {
      setError('Only campus_admin or club_officer can create a club.');
      return;
    }

    try {
      const response = await fetch(CLUBS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${latest.token}`,
        },
        body: JSON.stringify({
          name: newName,
          category: newCategory,
          description: newDescription,
          logo_url: newLogoUrl || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create club.');
      }

      setNewName('');
      setNewDescription('');
      setNewLogoUrl('');
      setNotice('Club created successfully.');
      await fetchClubs();
      if (data.club?.id) {
        await handleSelectClub(data.club.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditingClub = () => {
    if (!selectedClub) return;
    setEditName(selectedClub.name || '');
    setEditCategory(selectedClub.category || '');
    setEditDescription(selectedClub.description || '');
    setEditStatus(selectedClub.status || 'active');
    setIsEditing(true);
    setError('');
    setNotice('');
  };

  const handleUpdateClub = async (e) => {
    e.preventDefault();
    if (!selectedClub) return;

    const latest = readAuthFromStorage();
    if (!latest.token) return;

    setError('');
    setNotice('');

    try {
      const payload = {
        name: editName,
        category: editCategory,
        description: editDescription,
      };
      if (latest.user?.role === 'campus_admin') {
        payload.status = editStatus;
      }

      const response = await fetch(`${CLUBS_API}/${selectedClub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${latest.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update club.');
      }

      const updatedMembers = Array.isArray(data.club?.members)
        ? data.club.members
        : selectedClub.members || [];

      setIsEditing(false);
      setSelectedClub({
        ...data.club,
        members: updatedMembers,
      });
      setNotice('Club details updated successfully.');
      await fetchClubs();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedMembers =
    isAuthenticated && Array.isArray(selectedClub?.members) ? selectedClub.members : [];

  return (
    <div style={{ maxWidth: '1040px', margin: '30px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>CampusConnect Club Directory</h2>

        {!isAuthenticated ? (
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '16px',
              background: '#f1f3f5',
              color: '#343a40',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
          >
            Mode: Guest (Logged Out)
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                background: '#e7f5ff',
                color: '#1864ab',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              Logged in as {currentUser?.full_name || currentUser?.email || 'Member'} · Role: {role}
            </span>
            <button
              type="button"
              onClick={handleQuickLogout}
              style={{
                padding: '6px 12px',
                background: '#e9ecef',
                color: '#212529',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px', marginTop: '12px', background: '#ffe6e6', color: '#a80000', borderRadius: '6px' }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ padding: '10px', marginTop: '12px', background: '#e6f7ed', color: '#136f3a', borderRadius: '6px' }}>
          {notice}
        </div>
      )}

      {/* Search & Filter Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '20px 0' }}>
        <input
          type="text"
          placeholder="Search clubs by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 240px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {isAuthenticated && isAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={includeAllAdmin}
              onChange={(e) => setIncludeAllAdmin(e.target.checked)}
            />
            Show inactive clubs (campus_admin)
          </label>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Club List */}
        <div>
          <h3>Clubs ({clubs.length})</h3>
          {loading ? (
            <p>Loading clubs...</p>
          ) : clubs.length === 0 ? (
            <p>No clubs found.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {clubs.map((club) => {
                const enrolledCount =
                  club.enrolled_members_count ?? club.member_count ?? club.members_count ?? 0;

                return (
                  <div
                    key={club.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '14px',
                      background: selectedClub?.id === club.id ? '#f5f9ff' : '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{club.name}</strong>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: '#eee' }}>
                        {club.category || 'General'}
                      </span>
                    </div>

                    {isAuthenticated && club.description && (
                      <p style={{ margin: '8px 0', color: '#444', fontSize: '14px' }}>
                        {club.description}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '10px',
                        fontSize: '12px',
                        color: '#555',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <span>
                        Status: <strong>{club.status}</strong> · Enrolled Members: <strong>{enrolledCount}</strong>
                      </span>

                      {isAuthenticated ? (
                        <button
                          type="button"
                          onClick={() => handleSelectClub(club.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          View Details
                        </button>
                      ) : (
                        <span style={{ color: '#777', fontStyle: 'italic' }}>
                          Login required for details
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Guest Join Box vs Logged-In Role-Based Panel */}
        <div style={{ display: 'grid', gap: '20px' }}>
          {!isAuthenticated ? (
            <div
              style={{
                border: '1px solid #b6d4fe',
                background: '#f8fbff',
                borderRadius: '8px',
                padding: '18px',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Join CampusConnect to Visit More</h3>
              <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.55 }}>
                CampusConnect connects students, club officers, and campus administrators across student organizations.
                As a guest, you can view club status and enrolled member counts. Join or sign in to view full club
                details, club owner/officer information, member lists, or access role-based club controls.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <Link
                  to="/login"
                  style={{
                    padding: '9px 16px',
                    background: '#007bff',
                    color: '#fff',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  style={{
                    padding: '9px 16px',
                    background: '#28a745',
                    color: '#fff',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  Register
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Role Capabilities Summary */}
              <div
                style={{
                  border: '1px solid #dee2e6',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '14px',
                  fontSize: '13px',
                }}
              >
                <strong>Role Permissions ({role}):</strong>
                {isAdmin && (
                  <p style={{ margin: '6px 0 0' }}>
                    You have <strong>campus_admin</strong> access: view all clubs (including inactive), inspect owner/member
                    details, create clubs, and edit any club or change its status.
                  </p>
                )}
                {isOfficer && (
                  <p style={{ margin: '6px 0 0' }}>
                    You have <strong>club_officer</strong> access: inspect club details/members, create clubs, and edit
                    clubs assigned to your account.
                  </p>
                )}
                {!isAdmin && !isOfficer && (
                  <p style={{ margin: '6px 0 0' }}>
                    You have <strong>{role}</strong> access: browse clubs and inspect club details, owner info, and
                    members. Creating and editing clubs are restricted to <strong>campus_admin</strong> and{' '}
                    <strong>club_officer</strong>.
                  </p>
                )}
              </div>

              {/* Selected Club Details (Logged-in only) */}
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
                <h3>Club Details</h3>
                {!selectedClub ? (
                  <p style={{ color: '#666' }}>Click &ldquo;View Details&rdquo; on a club to see owner, members, and info.</p>
                ) : !isEditing ? (
                  <div>
                    <h4 style={{ marginTop: 0 }}>{selectedClub.name}</h4>
                    <p><strong>Category:</strong> {selectedClub.category || 'General'}</p>
                    <p><strong>Status:</strong> {selectedClub.status}</p>
                    <p>
                      <strong>Enrolled Members:</strong>{' '}
                      {selectedClub.enrolled_members_count ?? selectedClub.member_count ?? 0}
                    </p>
                    <p>
                      <strong>Club Owner / Officer:</strong>{' '}
                      {selectedClub.officer_name || selectedClub.officer_user_id}
                    </p>
                    <p><strong>Description:</strong> {selectedClub.description || 'No description provided.'}</p>

                    <div>
                      <strong>Members ({selectedMembers.length}):</strong>
                      {selectedMembers.length === 0 ? (
                        <p style={{ marginTop: '6px', color: '#666', fontSize: '14px' }}>
                          No approved members listed yet.
                        </p>
                      ) : (
                        <ul style={{ marginTop: '6px', paddingLeft: '18px' }}>
                          {selectedMembers.map((member) => {
                            const memberKey =
                              member.membership_id || member.id || member.user_id || member.email;
                            const memberName =
                              member.full_name || member.name || member.email || member.user_id;
                            const memberRole = member.club_role || member.role;
                            const memberStatus = member.status;

                            return (
                              <li key={memberKey} style={{ marginBottom: '4px' }}>
                                <span>{memberName}</span>
                                {memberRole ? ` (${memberRole})` : ''}
                                {memberStatus ? ` — ${memberStatus}` : ''}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {canEditSelectedClub ? (
                      <button
                        type="button"
                        onClick={startEditingClub}
                        style={{
                          marginTop: '10px',
                          padding: '8px 14px',
                          background: '#333',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Edit Club
                      </button>
                    ) : (
                      <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                        Editing is available only to the assigned club officer or a campus admin.
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleUpdateClub}>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Club Name:</label><br />
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Category:</label><br />
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Description:</label><br />
                      <textarea
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    {isAdmin && (
                      <div style={{ marginBottom: '10px' }}>
                        <label>Status (campus_admin only):</label><br />
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                        >
                          <option value="active">active</option>
                          <option value="inactive">inactive</option>
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="submit"
                        style={{
                          padding: '8px 14px',
                          background: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        style={{
                          padding: '8px 14px',
                          background: '#ccc',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Create Club Form (campus_admin and club_officer only) */}
              {canCreateClub && (
                <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
                  <h3>Create a Club</h3>
                  <form onSubmit={handleCreateClub}>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Club Name *:</label><br />
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Category:</label><br />
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      >
                        {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Logo URL (optional):</label><br />
                      <input
                        type="text"
                        value={newLogoUrl}
                        onChange={(e) => setNewLogoUrl(e.target.value)}
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label>Description:</label><br />
                      <textarea
                        rows={3}
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
                        padding: '8px 16px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Create Club
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}