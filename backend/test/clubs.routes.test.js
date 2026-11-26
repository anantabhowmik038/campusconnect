import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

// Set dummy DATABASE_URL and JWT_SECRET before importing app modules
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@127.0.0.1:5432/campusconnect_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-f02-routes';

const { authService } = await import('../src/services/authService.js');
const { getDatabasePool } = await import('../src/config/database.js');
const { default: app } = await import('../src/app.js');

// In-memory mock tables for clubs, users, and club_memberships
let usersRows = [];
let clubsRows = [];
let membershipsRows = [];
let clubIdSeq = 10;

function resetMockDb() {
  clubIdSeq = 10;
  usersRows = [
    { id: 1, full_name: 'Admin User', email: 'admin@campusconnect.edu', role: 'campus_admin', is_active: true },
    { id: 20, full_name: 'Officer One', email: 'officer1@campusconnect.edu', role: 'club_officer', is_active: true },
    { id: 21, full_name: 'Officer Two', email: 'officer2@campusconnect.edu', role: 'club_officer', is_active: true },
    { id: 30, full_name: 'Student One', email: 'student1@campusconnect.edu', role: 'student', is_active: true },
    { id: 31, full_name: 'Student Two', email: 'student2@campusconnect.edu', role: 'student', is_active: true },
  ];

  clubsRows = [
    {
      id: 1,
      name: 'Robotics & AI Society',
      description: 'Hands-on robotics and machine learning projects',
      category: 'Technology',
      logo_url: null,
      status: 'active',
      officer_user_id: 20,
      created_at: '2026-11-01T10:00:00.000Z',
      updated_at: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 2,
      name: 'Campus Debate Forum',
      description: 'Parliamentary and public speaking sessions',
      category: 'Academic',
      logo_url: null,
      status: 'active',
      officer_user_id: 21,
      created_at: '2026-11-02T10:00:00.000Z',
      updated_at: '2026-11-02T10:00:00.000Z',
    },
    {
      id: 3,
      name: 'Archived Chess Club',
      description: 'Inactive club for admin visibility checks',
      category: 'Sports',
      logo_url: null,
      status: 'inactive',
      officer_user_id: 20,
      created_at: '2026-11-03T10:00:00.000Z',
      updated_at: '2026-11-03T10:00:00.000Z',
    },
  ];

  // 14 approved members for club 1 (including 2 detailed users + 12 additional approved rows)
  membershipsRows = [
    { id: 101, club_id: 1, user_id: 30, role: 'member', status: 'approved', joined_at: '2026-11-05T08:00:00.000Z' },
    { id: 102, club_id: 1, user_id: 31, role: 'secretary', status: 'approved', joined_at: '2026-11-06T08:00:00.000Z' },
    ...Array.from({ length: 12 }, (_, idx) => ({
      id: 200 + idx,
      club_id: 1,
      user_id: 30,
      role: 'member',
      status: 'approved',
      joined_at: '2026-11-07T08:00:00.000Z',
    })),
    { id: 301, club_id: 2, user_id: 30, role: 'member', status: 'pending', joined_at: '2026-11-08T08:00:00.000Z' },
  ];
}

function isUuid(val) {
  return (
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val.trim()
    )
  );
}

async function mockQuery(sql, params = []) {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();

  // userModel.findById query
  if (normalizedSql.includes('FROM users WHERE id = $1')) {
    const user = usersRows.find((u) => String(u.id) === String(params[0])) || null;
    return { rows: user ? [user] : [] };
  }

  // clubModel.findMembersByClubId query
  if (normalizedSql.includes('FROM club_memberships cm INNER JOIN users u')) {
    const clubId = params[0];
    const rows = membershipsRows
      .filter(
        (m) =>
          String(m.club_id) === String(clubId) &&
          String(m.status).toLowerCase() === 'approved'
      )
      .map((m) => {
        const u = usersRows.find((usr) => String(usr.id) === String(m.user_id)) || {};
        return {
          membership_id: m.id,
          user_id: m.user_id,
          full_name: u.full_name || `User ${m.user_id}`,
          email: u.email || '',
          club_role: m.role,
          status: m.status,
          joined_at: m.joined_at,
        };
      });
    return { rows };
  }

  // clubModel.findById query
  if (normalizedSql.includes('FROM clubs c') && normalizedSql.includes('WHERE c.id = $1')) {
    const targetId = params[0];
    const numericId = Number(targetId);
    if (!Number.isInteger(numericId) && !isUuid(targetId)) {
      const err = new Error(`invalid input syntax for type integer: "${targetId}"`);
      err.code = '22P02';
      throw err;
    }

    const club = clubsRows.find((c) => String(c.id) === String(targetId));
    if (!club) return { rows: [] };

    const officer = usersRows.find((u) => String(u.id) === String(club.officer_user_id));
    const approvedCount = membershipsRows.filter(
      (m) =>
        String(m.club_id) === String(club.id) &&
        String(m.status).toLowerCase() === 'approved'
    ).length;

    return {
      rows: [
        {
          ...club,
          officer_name: officer?.full_name || null,
          enrolled_members_count: approvedCount,
        },
      ],
    };
  }

  // clubModel.findAll query
  if (normalizedSql.includes('FROM clubs c')) {
    let filtered = [...clubsRows];
    let pIdx = 0;

    if (normalizedSql.includes('c.status = $')) {
      const statusParam = params[pIdx++];
      filtered = filtered.filter((c) => c.status === statusParam);
    }

    if (normalizedSql.includes('c.name ILIKE $')) {
      const rawPattern = String(params[pIdx++]).replace(/%/g, '').toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(rawPattern) ||
          (c.description || '').toLowerCase().includes(rawPattern)
      );
    }

    if (normalizedSql.includes('LOWER(COALESCE(c.category')) {
      const catParam = String(params[pIdx++]).toLowerCase();
      filtered = filtered.filter((c) => (c.category || '').toLowerCase() === catParam);
    }

    const rows = filtered.map((club) => {
      const officer = usersRows.find((u) => String(u.id) === String(club.officer_user_id));
      const approvedCount = membershipsRows.filter(
        (m) =>
          String(m.club_id) === String(club.id) &&
          String(m.status).toLowerCase() === 'approved'
      ).length;
      return {
        ...club,
        officer_name: officer?.full_name || null,
        enrolled_members_count: approvedCount,
      };
    });

    return { rows };
  }

  // clubModel.create query
  if (normalizedSql.startsWith('INSERT INTO clubs')) {
    const [name, description, category, logo_url, officer_user_id, status] = params;
    const duplicate = clubsRows.some(
      (c) => c.name.trim().toLowerCase() === String(name).trim().toLowerCase()
    );
    if (duplicate) {
      const err = new Error('duplicate key value violates unique constraint "clubs_name_key"');
      err.code = '23505';
      throw err;
    }

    const officerExists = usersRows.some((u) => String(u.id) === String(officer_user_id));
    if (!officerExists) {
      const err = new Error(
        'insert or update on table "clubs" violates foreign key constraint'
      );
      err.code = '23503';
      throw err;
    }

    const now = new Date().toISOString();
    const created = {
      id: ++clubIdSeq,
      name,
      description,
      category,
      logo_url,
      officer_user_id,
      status,
      created_at: now,
      updated_at: now,
    };
    clubsRows.push(created);
    return { rows: [created] };
  }

  // clubModel.updateById query
  if (normalizedSql.startsWith('UPDATE clubs SET')) {
    const clubId = params[params.length - 1];
    const idx = clubsRows.findIndex((c) => String(c.id) === String(clubId));
    if (idx === -1) return { rows: [] };

    const setPart = normalizedSql.slice(
      'UPDATE clubs SET '.length,
      normalizedSql.indexOf(' WHERE id = $')
    );
    const assignments = setPart.split(',').map((s) => s.trim());
    const nextUpdates = {};

    for (const assign of assignments) {
      const match = assign.match(/^([a-z_]+)\s*=\s*\$(\d+)$/i);
      if (match) {
        const col = match[1];
        const val = params[Number(match[2]) - 1];
        nextUpdates[col] = val;
      }
    }

    if (nextUpdates.name) {
      const dup = clubsRows.some(
        (c, i) =>
          i !== idx &&
          c.name.trim().toLowerCase() === String(nextUpdates.name).trim().toLowerCase()
      );
      if (dup) {
        const err = new Error('duplicate key value violates unique constraint "clubs_name_key"');
        err.code = '23505';
        throw err;
      }
    }

    clubsRows[idx] = {
      ...clubsRows[idx],
      ...nextUpdates,
      updated_at: new Date().toISOString(),
    };
    return { rows: [clubsRows[idx]] };
  }

  throw new Error(`Unhandled mock SQL query: ${normalizedSql}`);
}

const pool = getDatabasePool();
if (pool) {
  pool.query = mockQuery;
}

function signTestToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function apiRequest(baseUrl, method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

test.beforeEach(() => {
  resetMockDb();
});

test('1. Public club listing, search, category filter, and guest vs auth payload', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const guestRes = await apiRequest(baseUrl, 'GET', '/api/clubs');
    assert.equal(guestRes.status, 200);
    assert.equal(guestRes.body.clubs.length, 2);
    assert.equal(guestRes.body.clubs[0].enrolled_members_count, 14);
    assert.equal(guestRes.body.clubs[0].description, undefined);

    const searchRes = await apiRequest(baseUrl, 'GET', '/api/clubs?search=Robotics');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.clubs.length, 1);
    assert.equal(searchRes.body.clubs[0].name, 'Robotics & AI Society');

    const catRes = await apiRequest(baseUrl, 'GET', '/api/clubs?category=Academic');
    assert.equal(catRes.status, 200);
    assert.equal(catRes.body.clubs.length, 1);
    assert.equal(catRes.body.clubs[0].name, 'Campus Debate Forum');

    const studentToken = signTestToken(usersRows[3]);
    const detailRes = await apiRequest(baseUrl, 'GET', '/api/clubs/1', { token: studentToken });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.club.enrolled_members_count, 14);
    assert.equal(Array.isArray(detailRes.body.club.members), true);
    assert.equal(detailRes.body.club.members.length, 14);
  } finally {
    server.close();
  }
});

test('2. Authorized club creation by campus_admin and club_officer', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const officer1Token = signTestToken(usersRows[1]);
    const adminToken = signTestToken(usersRows[0]);

    const officerCreate = await apiRequest(baseUrl, 'POST', '/api/clubs', {
      token: officer1Token,
      body: {
        name: 'Photography Collective',
        category: 'Cultural',
        description: 'Campus photography walks',
      },
    });
    assert.equal(officerCreate.status, 201);
    assert.equal(officerCreate.body.club.name, 'Photography Collective');
    assert.equal(officerCreate.body.club.officer_user_id, 20);

    const adminCreate = await apiRequest(baseUrl, 'POST', '/api/clubs', {
      token: adminToken,
      body: {
        name: 'Cybersecurity Lab',
        category: 'Technology',
        officer_user_id: 21,
        status: 'active',
      },
    });
    assert.equal(adminCreate.status, 201);
    assert.equal(adminCreate.body.club.officer_user_id, 21);
  } finally {
    server.close();
  }
});

test('3. Student and unauthorized officer restrictions (401 / 403)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const studentToken = signTestToken(usersRows[3]);
    const officer2Token = signTestToken(usersRows[2]);

    const unauth = await apiRequest(baseUrl, 'POST', '/api/clubs', {
      body: { name: 'Unauthorized Club', category: 'Social' },
    });
    assert.equal(unauth.status, 401);

    const studentCreate = await apiRequest(baseUrl, 'POST', '/api/clubs', {
      token: studentToken,
      body: { name: 'Student Club', category: 'Social' },
    });
    assert.equal(studentCreate.status, 403);

    const studentPatch = await apiRequest(baseUrl, 'PATCH', '/api/clubs/1', {
      token: studentToken,
      body: { name: 'Hacked Name' },
    });
    assert.equal(studentPatch.status, 403);

    const wrongOfficerPatch = await apiRequest(baseUrl, 'PATCH', '/api/clubs/1', {
      token: officer2Token,
      body: { description: 'Unauthorized edit' },
    });
    assert.equal(wrongOfficerPatch.status, 403);
  } finally {
    server.close();
  }
});

test('4. Club editing by assigned officer and campus_admin', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const officer1Token = signTestToken(usersRows[1]);
    const adminToken = signTestToken(usersRows[0]);

    const officerPatch = await apiRequest(baseUrl, 'PATCH', '/api/clubs/1', {
      token: officer1Token,
      body: { description: 'Updated robotics description' },
    });
    assert.equal(officerPatch.status, 200);
    assert.equal(officerPatch.body.club.description, 'Updated robotics description');

    const adminPatch = await apiRequest(baseUrl, 'PATCH', '/api/clubs/1', {
      token: adminToken,
      body: { status: 'inactive' },
    });
    assert.equal(adminPatch.status, 200);
    assert.equal(adminPatch.body.club.status, 'inactive');
  } finally {
    server.close();
  }
});

test('5. Invalid club IDs return 400 and unknown IDs return 404', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const studentToken = signTestToken(usersRows[3]);

    const invalidRes = await apiRequest(baseUrl, 'GET', '/api/clubs/invalid-id-@@@', {
      token: studentToken,
    });
    assert.equal(invalidRes.status, 400);

    const missingRes = await apiRequest(baseUrl, 'GET', '/api/clubs/99999', {
      token: studentToken,
    });
    assert.equal(missingRes.status, 404);
  } finally {
    server.close();
  }
});

test('6. Duplicate club names return 409 Conflict', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const adminToken = signTestToken(usersRows[0]);

    const dupRes = await apiRequest(baseUrl, 'POST', '/api/clubs', {
      token: adminToken,
      body: {
        name: 'Robotics & AI Society',
        category: 'Technology',
      },
    });
    assert.equal(dupRes.status, 409);
  } finally {
    server.close();
  }
});