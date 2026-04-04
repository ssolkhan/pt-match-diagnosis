const OWNER = process.env.GITHUB_TIMBER_OWNER || 'RingOfFireOrg';
const REPO = process.env.GITHUB_TIMBER_REPO || 'Timber';
const BRANCH = process.env.GITHUB_TIMBER_BRANCH || 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const path = String(req.query.path || '').replace(/^\/+/, '');
  if (!path || (!path.endsWith('.dslog') && !path.endsWith('.dsevents'))) {
    res.status(400).json({ success: false, error: 'A .dslog or .dsevents path is required.' });
    return;
  }

  try {
    const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(BRANCH)}/${path}`;
    const headers = { 'User-Agent': 'pt-match-diagnosis' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(rawUrl, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub raw ${response.status}: ${text.slice(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    res.status(200);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-File-Path', path);
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
