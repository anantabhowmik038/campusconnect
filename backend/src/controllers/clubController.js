import { clubModel } from '../models/clubModel.js';

const ALLOWED_STATUSES = new Set(['active', 'inactive']);

function isValidLogoUrl(value) {
  if (!value) return true;
  if (value.startsWith('/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const clubController = {
  // GET /api/clubs?search=&category=&includeAll=true
  async listClubs(req, res, next) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
      const includeAll =
        req.query.includeAll === 'true' && req.user?.role === 'campus_admin';

      const clubs = await clubModel.findAll({
        search,
        category,
        includeAll,
      });

      const isAuthenticated = Boolean(req.user);

      // Guest users get public status & enrolled member counts only
      const formattedClubs = isAuthenticated
        ? clubs
        : clubs.map((club) => ({
            id: club.id,
            name: club.name,
            category: club.category,
            status: club.status,
            enrolled_members_count:
              club.enrolled_members_count ?? club.member_count ?? club.members_count ?? 0,
          }));

      return res.status(200).json({ clubs: formattedClubs });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/clubs/:id
  async getClubById(req, res, next) {
    try {
      const rawId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
      const numericId = Number(rawId);
      const isValidId =
        (Number.isInteger(numericId) && numericId > 0) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);

      if (!rawId || !isValidId) {
        return res.status(400).json({ error: 'Invalid club ID.' });
      }

      const clubId = Number.isInteger(numericId) && numericId > 0 ? numericId : rawId;
      const club = await clubModel.findById(clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found.' });
      }

      if (club.status !== 'active' && req.user?.role !== 'campus_admin') {
        return res.status(404).json({ error: 'Club not found.' });
      }

      // Guest users only see public status & enrolled member count
      if (!req.user) {
        return res.status(200).json({
          club: {
            id: club.id,
            name: club.name,
            category: club.category,
            status: club.status,
            enrolled_members_count:
              club.enrolled_members_count ?? club.member_count ?? club.members_count ?? 0,
          },
        });
      }

      return res.status(200).json({ club });
    } catch (err) {
      if (err?.code === '22P02') {
        return res.status(400).json({ error: 'Invalid club ID.' });
      }
      return next(err);
    }
  },

  // POST /api/clubs (campus_admin or club_officer only)
  async createClub(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const canCreate =
        req.user.role === 'campus_admin' || req.user.role === 'club_officer';
      if (!canCreate) {
        return res.status(403).json({
          error: 'Forbidden: only a campus administrator or club officer can create a club.',
        });
      }

      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      const category =
        typeof req.body.category === 'string' && req.body.category.trim()
          ? req.body.category.trim()
          : 'General';
      const description =
        typeof req.body.description === 'string' ? req.body.description.trim() : '';
      const rawLogo =
        typeof req.body.logo_url === 'string' ? req.body.logo_url.trim() : '';
      const logoUrl = rawLogo ? rawLogo : null;

      if (!name) {
        return res.status(400).json({ error: 'Club name is required.' });
      }

      if (logoUrl && !isValidLogoUrl(logoUrl)) {
        return res.status(400).json({
          error: 'Logo URL must start with "/", "http://", or "https://".',
        });
      }

      const rawAuthUserId = req.user.id;
      const hasExplicitOfficerId =
        req.user.role === 'campus_admin' &&
        req.body.officer_user_id !== undefined &&
        req.body.officer_user_id !== null &&
        String(req.body.officer_user_id).trim() !== '';

      const candidateId = hasExplicitOfficerId
        ? req.body.officer_user_id
        : rawAuthUserId;

      const numericId = Number(candidateId);
      const officerUserId =
        Number.isInteger(numericId) && numericId > 0
          ? numericId
          : typeof candidateId === 'string' && candidateId.trim() !== ''
            ? candidateId.trim()
            : null;

      if (!officerUserId) {
        return res.status(400).json({ error: 'Invalid officer_user_id.' });
      }

      const status =
        req.user.role === 'campus_admin' &&
        typeof req.body.status === 'string' &&
        ALLOWED_STATUSES.has(req.body.status)
          ? req.body.status
          : 'active';

      const created = await clubModel.create({
        name,
        description,
        category,
        logo_url: logoUrl,
        officer_user_id: officerUserId,
        status,
      });

      return res.status(201).json({ club: created });
    } catch (err) {
      if (err?.code === '23505') {
        return res.status(409).json({ error: 'A club with this name already exists.' });
      }
      if (err?.code === '23503' || err?.code === '22P02') {
        return res.status(400).json({ error: 'Invalid officer_user_id.' });
      }
      return next(err);
    }
  },

  // PATCH /api/clubs/:id (campus_admin or assigned club_officer only)
  async updateClub(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const rawId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
      const numericId = Number(rawId);
      const isValidId =
        (Number.isInteger(numericId) && numericId > 0) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);

      if (!rawId || !isValidId) {
        return res.status(400).json({ error: 'Invalid club ID.' });
      }

      const clubId = Number.isInteger(numericId) && numericId > 0 ? numericId : rawId;
      const existingClub = await clubModel.findById(clubId);
      if (!existingClub) {
        return res.status(404).json({ error: 'Club not found.' });
      }

      const authUserId = req.user.id;
      const isAdmin = req.user.role === 'campus_admin';
      const isAssignedOfficer =
        req.user.role === 'club_officer' && existingClub.officer_user_id === authUserId;

      if (!isAdmin && !isAssignedOfficer) {
        return res.status(403).json({
          error: 'Forbidden: only a campus administrator or the assigned club officer can update this club.',
        });
      }

      const updates = {};

      if (req.body.name !== undefined) {
        const trimmedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!trimmedName) {
          return res.status(400).json({ error: 'Club name cannot be empty.' });
        }
        updates.name = trimmedName;
      }

      if (req.body.category !== undefined) {
        updates.category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
      }

      if (req.body.description !== undefined) {
        updates.description =
          typeof req.body.description === 'string' ? req.body.description.trim() : '';
      }

      if (req.body.logo_url !== undefined) {
        const trimmedLogo =
          typeof req.body.logo_url === 'string' ? req.body.logo_url.trim() : '';
        if (trimmedLogo && !isValidLogoUrl(trimmedLogo)) {
          return res.status(400).json({
            error: 'Logo URL must start with "/", "http://", or "https://".',
          });
        }
        updates.logo_url = trimmedLogo || null;
      }

      if (req.body.status !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({
            error: 'Forbidden: only a campus administrator can change club status.',
          });
        }
        if (!ALLOWED_STATUSES.has(req.body.status)) {
          return res.status(400).json({ error: 'Status must be either "active" or "inactive".' });
        }
        updates.status = req.body.status;
      }

      if (req.body.officer_user_id !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({
            error: 'Forbidden: only a campus administrator can reassign the club officer.',
          });
        }
        const rawOfficerId = req.body.officer_user_id;
        const nextNumericOfficerId = Number(rawOfficerId);
        const nextOfficerId =
          Number.isInteger(nextNumericOfficerId) && nextNumericOfficerId > 0
            ? nextNumericOfficerId
            : typeof rawOfficerId === 'string' && rawOfficerId.trim() !== ''
              ? rawOfficerId.trim()
              : null;

        if (!nextOfficerId) {
          return res.status(400).json({ error: 'Invalid officer_user_id.' });
        }
        updates.officer_user_id = nextOfficerId;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
      }

      const updated = await clubModel.updateById(clubId, updates);
      return res.status(200).json({ club: updated });
    } catch (err) {
      if (err?.code === '23505') {
        return res.status(409).json({ error: 'A club with this name already exists.' });
      }
      if (err?.code === '23503' || err?.code === '22P02') {
        return res.status(400).json({ error: 'Invalid officer_user_id.' });
      }
      return next(err);
    }
  },
};