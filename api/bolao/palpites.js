  const prisma = require('../../lib/db');
  const { requireAuth, applyCors } = require('../../lib/middleware');

  module.exports = async (req, res) => {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    const payload = requireAuth(req, res);
    if (!payload) return;

    if (req.method === 'GET') {
      try {
        const palpites = await prisma.palpite.findMany({
          where: { userId: payload.id },
          include: { jogo: true },
          orderBy: { jogo: { utcDate: 'asc' } }
        });
        return res.json({ palpites });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao buscar palpites' });
      }
    }

    if (req.method === 'POST') {
      const { jogoId, homeScore, awayScore } = req.body || {};

      if (
        jogoId === undefined ||
        homeScore === undefined ||
        awayScore === undefined
      ) {
        return res.status(400).json({ error: 'Informe jogoId, homeScore e awayScore' });
      }

      const home = Number(homeScore);
      const away = Number(awayScore);

      if (
        !Number.isInteger(home) || !Number.isInteger(away) ||
        home < 0 || away < 0 || home > 20 || away > 20
      ) {
        return res.status(400).json({ error: 'Placar inválido' });
      }

      try {
        const jogo = await prisma.jogo.findUnique({ where: { id: Number(jogoId) } });

        if (!jogo) {
          return res.status(404).json({ error: 'Jogo não encontrado' });
        }

        if (new Date(jogo.utcDate) <= new Date()) {
          return res.status(403).json({ error: 'O prazo para palpitar neste jogo já encerrou' });
        }

        const palpite = await prisma.palpite.upsert({
          where: {
            userId_jogoId: { userId: payload.id, jogoId: jogo.id }
          },
          update: { homeScore: home, awayScore: away },
          create: { userId: payload.id, jogoId: jogo.id, homeScore: home, awayScore: away }
        });

        return res.json({ palpite });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao salvar palpite' });
      }
    }

    res.status(405).end();
  };
