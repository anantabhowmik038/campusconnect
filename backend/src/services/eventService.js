import { createEventModel } from '../models/eventModel.js';
import { isUuid, validateDateRange, validateId, validatePage, validateProposal, validateReview } from '../validation/eventValidation.js';
import { EventError } from './eventError.js';

/**
 * Checks that the event workflow received an authenticated actor and, when specified, the required role.
 *
 * @param {object} actor - Authenticated user supplied by event middleware.
 * @param {string} actor.id - Actor UUID.
 * @param {string} actor.role - Actor's current role.
 * @param {string} [role] - Required role for the operation.
 * @returns {string} The actor UUID normalized to lowercase.
 * @throws {EventError} HTTP 401 for an invalid identity or 403 for a role mismatch.
 */
export function requireEventActor(actor, role) {
  if (!isUuid(actor?.id)) throw new EventError(401, 'UNAUTHENTICATED', 'Verified sign-in is required.');
  if (role && actor.role !== role) throw new EventError(403, 'FORBIDDEN', 'You do not have access to this operation.');
  return actor.id.toLowerCase();
}

function requireAssignedClub(club, officerId) {
  if (!club || club.officer_user_id !== officerId) {
    throw new EventError(403, 'FORBIDDEN', 'You must be assigned to the club to manage its proposals.');
  }
}

function requireStatus(event, allowed) {
  if (!allowed.includes(event.status)) {
    throw new EventError(409, 'INVALID_TRANSITION', 'This action is unavailable for a ' + event.status + ' proposal.');
  }
}

/**
 * Creates the proposal workflow backed by a transactional event model.
 * Officers manage proposals for their assigned clubs. Administrators review pending proposals
 * using the current submission version to prevent stale decisions.
 *
 * @param {object} [model] - Event persistence adapter. Defaults to the PostgreSQL event model.
 * @returns {object} Service methods for creating, editing, submitting, reviewing, and listing proposals.
 */
export function createEventService(model = createEventModel()) {
  async function changeProposal(actor, eventId, role, action) {
    const userId = requireEventActor(actor, role);
    const id = validateId(eventId, 'eventId');
    return model.transaction(async (client) => {
      const event = await model.lockEvent(client, id);
      if (!event) throw new EventError(404, 'EVENT_NOT_FOUND', 'Proposal not found.');
      if (role === 'club_officer') {
        requireAssignedClub(await model.lockClub(client, event.club_id), userId);
      }
      return action(client, event, userId);
    });
  }

  return {
    async create(actor, body) {
      const officerId = requireEventActor(actor, 'club_officer');
      const proposal = validateProposal(body, true);
      return model.transaction(async (client) => {
        const club = await model.lockClub(client, proposal.club_id);
        requireAssignedClub(club, officerId);
        if (club.status !== 'active') {
          throw new EventError(403, 'FORBIDDEN', 'New proposals require an active club.');
        }
        return model.insert(client, proposal, officerId);
      });
    },

    edit(actor, eventId, body) {
      return changeProposal(actor, eventId, 'club_officer', (client, event) => {
        requireStatus(event, ['draft', 'rejected']);
        const changes = validateProposal(body, false);
        if (changes.start_time || changes.end_time) {
          validateDateRange(changes.start_time ?? event.start_time, changes.end_time ?? event.end_time);
        }
        return model.updateProposal(client, event.id, changes);
      });
    },

    submit(actor, eventId, body) {
      return changeProposal(actor, eventId, 'club_officer', (client, event) => {
        requireStatus(event, ['draft', 'rejected']);
        if (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) {
          throw new EventError(400, 'VALIDATION_ERROR', 'Submit accepts an empty body.');
        }
        return model.submit(client, event.id);
      });
    },

    /**
     * Records an administrator decision on a pending proposal and checks the submission version while locked.
     *
     * @function review
     * @param {object} actor - Authenticated campus administrator.
     * @param {string} eventId - Proposal UUID.
     * @param {object} body - Validated by the review workflow.
     * @param {'approved'|'rejected'} body.decision - Review decision.
     * @param {number} body.submission_version - Version displayed to the reviewer.
     * @param {string} [body.review_note] - Required and nonblank for rejection.
     * @returns {Promise<object>} The updated proposal row.
     * @throws {EventError} Invalid identity, input, missing proposal, invalid state, or stale version. Transaction failures reject the promise.
     */
    review(actor, eventId, body) {
      return changeProposal(actor, eventId, 'campus_admin', (client, event, reviewerId) => {
        requireStatus(event, ['pending']);
        const review = validateReview(body);
        if (review.submission_version !== event.submission_version) {
          throw new EventError(409, 'STALE_SUBMISSION', 'This proposal was resubmitted. Open the latest submission before reviewing it.');
        }
        return model.review(client, event.id, reviewerId, review);
      });
    },

    async listProposals(actor, query) {
      const officerId = requireEventActor(actor, 'club_officer');
      return model.list({ ...validatePage(query), officerId });
    },

    async listPending(actor, query) {
      requireEventActor(actor, 'campus_admin');
      return model.list(validatePage(query));
    },
  };
}
