const OWNER = process.env.GITHUB_TIMBER_OWNER || 'RingOfFireOrg';
const REPO = process.env.GITHUB_TIMBER_REPO || 'Timber';
const BRANCH = process.env.GITHUB_TIMBER_BRANCH || 'main';
const BASE_PATH = (process.env.GITHUB_TIMBER_BASE_PATH || '2026').replace(/^\/+|\/+$/g, '');

async function fetchGitHubJson(url) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'pt-match-diagnosis'
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

async function loadTree() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`;
  const data = await fetchGitHubJson(url);
  return Array.isArray(data.tree) ? data.tree : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const folder = String(req.query.folder || '').replace(/^\/+|\/+$/g, '');
  const fullFolder = folder ? `${BASE_PATH}/${folder}` : BASE_PATH;

  try {
    const tree = await loadTree();
    const pairs = new Map();
    tree.forEach(entry => {
      if (entry.type !== 'blob') return;
      const lastSlash = entry.path.lastIndexOf('/');
      const folderPath = lastSlash >= 0 ? entry.path.slice(0, lastSlash) : '';
      if (folderPath !== fullFolder) return;
      if (!entry.path.endsWith('.dslog') && !entry.path.endsWith('.dsevents')) return;
      const name = entry.path.slice(lastSlash + 1);
      const baseName = name.replace(/\.(dslog|dsevents)$/i, '');
      const ext = name.toLowerCase().endsWith('.dslog') ? 'dslog' : 'dsevents';
      if (!pairs.has(baseName)) pairs.set(baseName, { baseName });
      const record = pairs.get(baseName);
      record[`${ext}Path`] = entry.path;
      record[`${ext}Name`] = name;
      record.size = (record.size || 0) + (entry.size || 0);
    });

    const matches = [...pairs.values()]
      .filter(p => p.dslogPath && p.dseventsPath)
      .sort((a, b) => a.baseName.localeCompare(b.baseName, undefined, { numeric: true, sensitivity: 'base' }))
      .map(p => ({
        ...p,
        label: p.baseName,
        folder
      }));

    res.status(200).json({
      success: true,
      repo: { owner: OWNER, repo: REPO, branch: BRANCH, basePath: BASE_PATH },
      folder,
      matches
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
