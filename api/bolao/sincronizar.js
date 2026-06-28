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

    for (const m of matches) {
      const winnerTeamId =
        m.score?.winner === 'HOME_TEAM' ? (m.homeTeam?.id ?? null) :
        m.score?.winner === 'AWAY_TEAM' ? (m.awayTeam?.id ?? null) :
        null;

      const campos = {
        status: m.status,
        homeTeamId: m.homeTeam?.id ?? 0,
        homeTeamName: m.homeTeam?.name || 'A definir',
        awayTeamId: m.awayTeam?.id ?? 0,
        awayTeamName: m.awayTeam?.name || 'A definir',
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
        utcDate: new Date(m.utcDate),
        groupName: m.group || null,
        stage: m.stage || null,
        winnerTeamId,
        penaltiesHome: m.score?.penalties?.home ?? null,
        penaltiesAway: m.score?.penalties?.away ?? null,
      };

      await prisma.jogo.upsert({
        where: { id: m.id },
        update: campos,
        create: { id: m.id, ...campos },
      });
    }

    // --- Pontuar palpites de jogos finalizados ---
    const jogosFinalizados = await prisma.jogo.findMany({
      where: { status: 'FINISHED' },
      include: { palpites: { where: { pontos: null } } },
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
          data: { pontos },
        });

        palpitesPontuados++;
      }
    }

    // --- Pontuar palpites de campeão (quando a Final encerrar) ---
    const final = await prisma.jogo.findFirst({
      where: { stage: 'FINAL', status: 'FINISHED', winnerTeamId: { not: null } },
    });

    let campeoesPontuados = 0;

    if (final) {
      // Descobre o nome do time vencedor
      const nomeVencedor =
        final.winnerTeamId === final.homeTeamId
          ? final.homeTeamName
          : final.awayTeamName;

      // Pontua quem ainda não foi avaliado
      const palpitesCampeao = await prisma.palpiteCampeao.findMany({
        where: { pontos: null },
      });

      for (const pc of palpitesCampeao) {
        const acertou = pc.teamName === nomeVencedor;
        await prisma.palpiteCampeao.update({
          where: { id: pc.id },
          data: { pontos: acertou ? 20 : 0 },
        });
        campeoesPontuados++;
      }
    }

    res.json({
      ok: true,
      totalMatchesRecebidos: matches.length,
      jogosSincronizados: matches.length,
      palpitesPontuados,
      campeoesPontuados,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao sincronizar jogos' });
  }
};
