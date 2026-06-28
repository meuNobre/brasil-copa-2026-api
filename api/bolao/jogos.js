const prisma = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');
const { applyCors } = require('../../lib/middleware');

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.split(' ')[1]);
      userId = payload.id;
    } catch {
      // token inválido/expirado: segue sem usuário
    }
  }

  try {
    const jogos = await prisma.jogo.findMany({
      // sem filtro de time — retorna TODOS os jogos da Copa
      orderBy: { utcDate: 'asc' },
      include: userId
        ? { palpites: { where: { userId } } }
        : false,
    });

    const result = jogos.map(jogo => {
      const meuPalpite = userId && jogo.palpites?.length
        ? {
            homeScore: jogo.palpites[0].homeScore,
            awayScore: jogo.palpites[0].awayScore,
            pontos: jogo.palpites[0].pontos,
          }
        : null;

      const { palpites, ...jogoSemPalpites } = jogo;

      return {
        ...jogoSemPalpites,
        meuPalpite,
        bloqueado: new Date(jogo.utcDate) <= new Date(),
      };
    });

    res.json({ jogos: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar jogos do bolão' });
  }
};