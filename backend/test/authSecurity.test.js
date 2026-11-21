import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { authController } from '../src/controllers/authController.js';
import { verifyToken, requireRole } from '../src/middleware/authMiddleware.js';
import { authService } from '../src/services/authService.js';
import { userModel } from '../src/models/userModel.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

test('Public registration cannot assign campus_admin role', async () => {
  const changes = [];

  changes.push(mock.method(userModel, 'findByEmail', async () => null));
  changes.push(mock.method(authService, 'hashPassword', async () => 'hashed'));
  changes.push(mock.method(authService, 'generateToken', () => 'test-token'));

  changes.push(
    mock.method(userModel, 'createUser', async (_name, _email, _hash, role) => ({
      id: 1,
      full_name: 'Test Student',
      email: 'student@example.com',
      role,
    }))
  );

  try {
    const req = {
      body: {
        full_name: 'Test Student',
        email: 'student@example.com',
        password: 'TestPassword123!',
        role: 'campus_admin',
      },
    };

    const res = createResponse();

    await authController.register(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.user.role, 'student');
    assert.notEqual(res.body.user.role, 'campus_admin');
  } finally {
    changes.reverse().forEach((change) => change.mock.restore());
  }
});

test('Inactive user cannot log in', async () => {
  const change = mock.method(userModel, 'findByEmail', async () => ({
    id: 2,
    email: 'inactive@example.com',
    password_hash: 'hashed',
    role: 'student',
    is_active: false,
  }));

  try {
    const req = {
      body: {
        email: 'inactive@example.com',
        password: 'TestPassword123!',
      },
    };

    const res = createResponse();

    await authController.login(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /inactive/i);
  } finally {
    change.mock.restore();
  }
});

test('Missing authentication token returns 401', async () => {
  const req = { headers: {} };
  const res = createResponse();

  let nextCalled = false;

  await verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('Invalid JWT returns 401', async () => {
  const change = mock.method(authService, 'verifyToken', () => {
    const error = new Error('Invalid token');
    error.name = 'JsonWebTokenError';
    throw error;
  });

  try {
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
    };

    const res = createResponse();

    let nextCalled = false;

    await verifyToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  } finally {
    change.mock.restore();
  }
});

test('Expired JWT returns 401', async () => {
  const change = mock.method(authService, 'verifyToken', () => {
    const error = new Error('Expired token');
    error.name = 'TokenExpiredError';
    throw error;
  });

  try {
    const req = {
      headers: { authorization: 'Bearer expired-token' },
    };

    const res = createResponse();

    await verifyToken(req, res, () => {
      assert.fail('Expired token must not pass authentication');
    });

    assert.equal(res.statusCode, 401);
  } finally {
    change.mock.restore();
  }
});

test('Inactive user cannot access protected endpoints', async () => {
  const changes = [];

  changes.push(
    mock.method(authService, 'verifyToken', () => ({
      id: 3,
      role: 'student',
    }))
  );

  changes.push(
    mock.method(userModel, 'findById', async () => ({
      id: 3,
      email: 'inactive@example.com',
      role: 'student',
      is_active: false,
    }))
  );

  try {
    const req = {
      headers: { authorization: 'Bearer valid-test-token' },
    };

    const res = createResponse();

    let nextCalled = false;

    await verifyToken(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  } finally {
    changes.reverse().forEach((change) => change.mock.restore());
  }
});

test('Student cannot access campus_admin-only routes', () => {
  const middleware = requireRole('campus_admin');

  const req = {
    user: {
      id: 4,
      role: 'student',
    },
  };

  const res = createResponse();

  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('campus_admin can access authorized routes', () => {
  const middleware = requireRole('campus_admin');

  const req = {
    user: {
      id: 5,
      role: 'campus_admin',
    },
  };

  const res = createResponse();

  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('Missing JWT_SECRET rejects token generation', () => {
  const previousSecret = process.env.JWT_SECRET;

  try {
    delete process.env.JWT_SECRET;

    assert.throws(
      () => authService.generateToken({
        id: 6,
        email: 'test@example.com',
        role: 'student',
      }),
      /JWT_SECRET/
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});