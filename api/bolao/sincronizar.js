const prisma = require('../../lib/db');

const BRASIL_TEAM_ID = 764;

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  const authHeader = req.headers.authorization;
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const secret = bearerSecret || req.headers['x-cron-secret'] || req.query?.secret;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const response = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?team=${BRASIL_TEAM_ID}`,
      { headers: { 'X-Auth-Token': process.env.API_KEY } }
    );

    if (!response.ok) {
      return res.status(502).json({ error: 'Erro ao consultar Football-Data' });
    }

    const data = await response.json();
    const matches = data.matches || [];
    const grupoMatches = matches.filter(m => m.group);

    for (const m of grupoMatches) {
      await prisma.jogo.upsert({
        where: { id: m.id },
        update: {
          status: m.status,
          homeScore: m.score?.fullTime?.home ?? null,
          awayScore: m.score?.fullTime?.away ?? null,
          utcDate: new Date(m.utcDate),
          groupName: m.group
        },
        create: {
          id: m.id,
          homeTeamId: m.homeTeam.id,
          homeTeamName: m.homeTeam.name,
          awayTeamId: m.awayTeam.id,
          awayTeamName: m.awayTeam.name,
          utcDate: new Date(m.utcDate),
          status: m.status,
          homeScore: m.score?.fullTime?.home ?? null,
          awayScore: m.score?.fullTime?.away ?? null,
          groupName: m.group
        }
      });
    }

    const jogosFinalizados = await prisma.jogo.findMany({
      where: { status: 'FINISHED' },
      include: { palpites: { where: { pontos: null } } }
    });

    let palpitesPontuados = 0;

    for (const jogo of jogosFinalizados) {
      if (jogo.homeScore === null || jogo.awayScore === null) continue;

      for (const palpite of jogo.palpites) {
        const acertouPlacar =
          palpite.homeScore === jogo.homeScore && palpite.awayScore === jogo.awayScore;

        const resultadoReal = Math.sign(jogo.homeScore - jogo.awayScore);
        const resultadoPalpite = Math.sign(palpite.homeScore - palpite.awayScore);
        const acertouResultado = resultadoReal === resultadoPalpite;

        let pontos = 0;
        if (acertouPlacar) pontos = 10;
        else if (acertouResultado) pontos = 5;

        await prisma.palpite.update({
          where: { id: palpite.id },
          data: { pontos }
        });

        palpitesPontuados++;
      }
    }

    res.json({
      ok: true,
      totalMatchesRecebidos: matches.length,
      jogosSincronizados: grupoMatches.length,
      palpitesPontuados
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao sincronizar jogos' });
  }
};