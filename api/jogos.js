const { applyCors } = require('../lib/middleware');

function setCors(req, res) {
  const origin = req.headers.origin;

  const allowedOrigins = [
    'https://brasil-copa-2026-five.vercel.app'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;

  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      {
        headers: {
          'X-Auth-Token': process.env.API_KEY
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({ error: 'Erro ao consultar Football-Data' });
    }

    const data = await response.json();

    const teamId = 764;

    const filteredMatches = (data.matches || []).filter(match =>
      match.homeTeam?.id === teamId ||
      match.awayTeam?.id === teamId
    );

    return res.status(200).json({ matches: filteredMatches });

  } catch (err) {
    return res.status(500).json({
      error: 'Erro interno',
      details: err.message
    });
  }
};