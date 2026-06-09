const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());

app.get('/api/jogos', async (req, res) => {
  const response = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?team=6310',
    {
      headers: {
        'X-Auth-Token': process.env.API_KEY
      }
    }
  );

  const data = await response.json();
  res.json(data);
});

app.get('/api/grupo', async (req, res) => {
  const response = await fetch(
    'https://api.football-data.org/v4/competitions/WC/standings',
    {
      headers: {
        'X-Auth-Token': process.env.API_KEY
      }
    }
  );

  const data = await response.json();
  res.json(data);
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});