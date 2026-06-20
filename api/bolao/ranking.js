const prisma = require('../../lib/db');
const { applyCors } = require('../../../lib/middleware');

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') return res.status(405).end();

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        palpites: {
          select: { pontos: true, jogo: { select: { status: true } } }
        }
      }
    });

    const ranking = users.map(u => {
      const palpitesFinalizados = u.palpites.filter(p => p.jogo.status === 'FINISHED');
      const pontos = palpitesFinalizados.reduce((sum, p) => sum + (p.pontos || 0), 0);
      const acertosExatos = palpitesFinalizados.filter(p => p.pontos === 10).length;
      const acertosResultado = palpitesFinalizados.filter(p => p.pontos === 5).length;

      return {
        username: u.username,
        pontos,
        jogosAvaliados: palpitesFinalizados.length,
        acertosExatos,
        acertosResultado
      };
    });

    ranking.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.acertosExatos !== a.acertosExatos) return b.acertosExatos - a.acertosExatos;
      return a.username.localeCompare(b.username);
    });

    const result = ranking.map((r, index) => ({ posicao: index + 1, ...r }));

    res.json({ ranking: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao montar ranking' });
  }
};

