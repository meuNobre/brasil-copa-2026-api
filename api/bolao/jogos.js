const prisma = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');
const { applyCors } = require('../../lib/middleware');

const BRASIL_TEAM_ID = 764; // ID usado pela Football-Data para o Brasil

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') return res.status(405).end();

  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.split(' ')[1]);
      userId = payload.id;
    } catch {
      // token inválido/expirado: segue sem usuário (não bloqueia a listagem)
    }
  }

  try {
    const jogos = await prisma.jogo.findMany({
      where: {
        OR: [
          { homeTeamId: BRASIL_TEAM_ID },
          { awayTeamId: BRASIL_TEAM_ID }
        ],
        groupName: { not: null }
      },
      orderBy: { utcDate: 'asc' },
      include: userId
        ? { palpites: { where: { userId } } }
        : false
    });

    const result = jogos.map(jogo => {
      const meuPalpite = userId && jogo.palpites?.length
        ? {
            homeScore: jogo.palpites[0].homeScore,
            awayScore: jogo.palpites[0].awayScore,
            pontos: jogo.palpites[0].pontos
          }
        : null;

      const { palpites, ...jogoSemPalpites } = jogo;

      return {
        ...jogoSemPalpites,
        meuPalpite,
        // o palpite só pode ser feito/editado antes do início do jogo
        bloqueado: new Date(jogo.utcDate) <= new Date()
      };
    });

    res.json({ jogos: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar jogos do bolão' });
  }
};
