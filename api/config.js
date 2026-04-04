// api/config.js — Vercel Serverless Function
// Returns the Apps Script URL from environment variable
// Set APPS_SCRIPT_URL in your Vercel project settings → Environment Variables

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  
  res.status(200).json({
    appsScriptUrl: process.env.APPS_SCRIPT_URL || null,
    sheetId: process.env.SHEET_ID || null,
    github: {
      owner: process.env.GITHUB_TIMBER_OWNER || 'RingOfFireOrg',
      repo: process.env.GITHUB_TIMBER_REPO || 'Timber',
      branch: process.env.GITHUB_TIMBER_BRANCH || 'main',
      basePath: process.env.GITHUB_TIMBER_BASE_PATH || '2026'
    }
  });
}
