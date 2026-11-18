export function createEventController(service) {
  return {
    async create(req, res) {
      res.status(201).json({ data: await service.create(req.user, req.body) });
    },
    async edit(req, res) {
      res.json({ data: await service.edit(req.user, req.params.eventId, req.body) });
    },
    async submit(req, res) {
      res.json({ data: await service.submit(req.user, req.params.eventId, req.body) });
    },
    async review(req, res) {
      res.json({ data: await service.review(req.user, req.params.eventId, req.body) });
    },
    async listProposals(req, res) {
      res.json(await service.listProposals(req.user, req.query));
    },
    async listPending(req, res) {
      res.json(await service.listPending(req.user, req.query));
    },
  };
}
