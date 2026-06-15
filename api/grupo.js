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
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/standings',
      { headers: { 'X-Auth-Token': process.env.API_KEY } }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Erro ao consultar Football-Data' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', details: err.message });
  }
};
