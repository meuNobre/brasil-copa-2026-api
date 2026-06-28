const prisma = require('../../lib/db');
const { requireAuth, applyCors } = require('../../lib/middleware');

// Times que podem aparecer no mata-mata da Copa 2026
// (usado para validar o palpite e popular o select no front)
const TIMES_MATA_MATA = [
  'Germany', 'Japan', 'Cameroon', 'Mexico', 'Netherlands', 'Morocco',
  'South Africa', 'Canada', 'Brazil', 'Argentina', 'Australia', 'Switzerland',
  'United States', 'Portugal', 'France', 'Spain', 'England', 'Croatia',
  'Serbia', 'South Korea', 'Ecuador', 'Senegal', 'Poland', 'Denmark',
  'Belgium', 'Tunisia', 'Colombia', 'Uruguay', 'Costa Rica', 'Panama',
  'Jamaica', 'Honduras', 'Venezuela', 'Bolivia', 'Peru', 'Chile',
  'New Zealand', 'Saudi Arabia', 'Iran', 'Iraq', 'Qatar',
];

module.exports = async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  const payload = requireAuth(req, res);
  if (!payload) return;

  // GET — retorna palpite atual do usuário + se ainda está aberto
  if (req.method === 'GET') {
    try {
      const palpite = await prisma.palpiteCampeao.findUnique({
        where: { userId: payload.id },
      });

      const bloqueado = await isBloqueado();

      return res.json({ palpite, bloqueado, times: TIMES_MATA_MATA });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao buscar palpite de campeão' });
    }
  }

  // POST — salva/atualiza palpite de campeão
  if (req.method === 'POST') {
    const { teamName } = req.body || {};

    if (!teamName || typeof teamName !== 'string' || !teamName.trim()) {
      return res.status(400).json({ error: 'Informe o nome do time campeão' });
    }

    try {
      const bloqueado = await isBloqueado();
      if (bloqueado) {
        return res.status(403).json({
          error: 'O prazo para palpitar no campeão já encerrou (mata-mata iniciado)',
        });
      }

      const palpite = await prisma.palpiteCampeao.upsert({
        where: { userId: payload.id },
        update: { teamName: teamName.trim() },
        create: { userId: payload.id, teamName: teamName.trim() },
      });

      return res.json({ palpite });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao salvar palpite de campeão' });
    }
  }

  res.status(405).end();
};

// Bloqueia quando o primeiro jogo do mata-mata já começou
async function isBloqueado() {
  const primeiroMataMata = await prisma.jogo.findFirst({
    where: { groupName: null, stage: { not: null } },
    orderBy: { utcDate: 'asc' },
  });

  if (!primeiroMataMata) return false;
  return new Date(primeiroMataMata.utcDate) <= new Date();
}
