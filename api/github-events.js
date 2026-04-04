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

function buildFolderSummaries(tree) {
  const prefix = `${BASE_PATH}/`;
  const folders = new Map();
  const filesByFolder = new Map();

  tree.forEach(entry => {
    if (entry.type !== 'blob' || !entry.path.startsWith(prefix)) return;
    if (!entry.path.endsWith('.dslog') && !entry.path.endsWith('.dsevents')) return;
    const lastSlash = entry.path.lastIndexOf('/');
    const folderPath = lastSlash >= 0 ? entry.path.slice(0, lastSlash) : BASE_PATH;
    if (!filesByFolder.has(folderPath)) filesByFolder.set(folderPath, new Map());
    const folderFiles = filesByFolder.get(folderPath);
    const name = entry.path.slice(lastSlash + 1);
    const baseName = name.replace(/\.(dslog|dsevents)$/i, '');
    const ext = name.toLowerCase().endsWith('.dslog') ? 'dslog' : 'dsevents';
    if (!folderFiles.has(baseName)) folderFiles.set(baseName, {});
    folderFiles.get(baseName)[ext] = name;
  });

  for (const [folderPath, pairs] of filesByFolder.entries()) {
    const pairCount = [...pairs.values()].filter(v => v.dslog && v.dsevents).length;
    if (!pairCount) continue;
    const relativePath = folderPath === BASE_PATH ? '' : folderPath.slice(prefix.length);
    const name = relativePath || BASE_PATH;
    folders.set(folderPath, { path: relativePath, name, pairCount });
  }

  return [...folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  try {
    const tree = await loadTree();
    const folders = buildFolderSummaries(tree);
    res.status(200).json({
      success: true,
      repo: { owner: OWNER, repo: REPO, branch: BRANCH, basePath: BASE_PATH },
      folders
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
