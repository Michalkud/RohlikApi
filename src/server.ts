import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/orders/delivered', async (req: Request, res: Response) => {
  console.log('Received request to /orders/delivered');
  const rohlikCookies = req.headers['rohlik-cookies'];
  if (!rohlikCookies) {
    res.status(401).json({ error: 'Missing rohlik-cookies header' });
    return;
  }
  try {
    const response = await axios.get('https://www.rohlik.cz/api/v3/orders/delivered?offset=0&limit=6', {
      headers: {
        'Cookie': String(rohlikCookies),
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'cs,en;q=0.9,sk;q=0.8',
        'Referer': 'https://www.rohlik.cz/uzivatel/profil',
        'x-origin': 'WEB',
      },
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch delivered orders', details: err instanceof Error ? err.message : err });
  }
});

app.get('/user/credits', async (req: Request, res: Response) => {
  console.log('Received request to /user/credits');
  const rohlikCookies = req.headers['rohlik-cookies'];
  if (!rohlikCookies) {
    res.status(401).json({ error: 'Missing rohlik-cookies header' });
    return;
  }
  try {
    const response = await axios.get('https://www.rohlik.cz/api/v3/user/credits', {
      headers: {
        'Cookie': String(rohlikCookies),
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'cs,en;q=0.9,sk;q=0.8',
        'Referer': 'https://www.rohlik.cz/uzivatel/profil',
        'x-origin': 'WEB',
      },
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user credits', details: err instanceof Error ? err.message : err });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
 