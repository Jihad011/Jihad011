const https = require('https');
const fs = require('fs');

const username = process.env.USERNAME || 'Jihad011';
const token = process.env.GITHUB_TOKEN;
const outputDir = 'profile-summary-cards-output/tokyonight';
fs.mkdirSync(outputDir, { recursive: true });

const BG = '#1a1b27';
const TITLE_COLOR = '#70a5fd';
const TEXT_COLOR = '#c0caf5';
const BORDER_COLOR = '#2d3561';
const ACCENT = '#bf91f3';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + data.substring(0,200))); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getStats() {
  const query = JSON.stringify({
    query: `{
      user(login: "${username}") {
        name
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          totalCount
          nodes {
            stargazerCount
            forkCount
            primaryLanguage { name color }
          }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoryContributions
        }
        followers { totalCount }
      }
    }`
  });
  return makeRequest({
    hostname: 'api.github.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profile-summary-cards'
    }
  }, query);
}

function svgCard(title, width, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" rx="10" fill="${BG}" stroke="${BORDER_COLOR}" stroke-width="1"/>
  <text x="25" y="35" fill="${TITLE_COLOR}" font-family="'Segoe UI', sans-serif" font-size="15" font-weight="bold">${title}</text>
  <line x1="25" y1="45" x2="${width-25}" y2="45" stroke="${BORDER_COLOR}" stroke-width="1"/>
  ${content}
</svg>`;
}

function statRow(label, value, y) {
  return `<text x="30" y="${y}" fill="${TEXT_COLOR}" font-family="'Segoe UI', sans-serif" font-size="13">${label}</text>
  <text x="330" y="${y}" fill="${ACCENT}" font-family="'Segoe UI', sans-serif" font-size="13" text-anchor="end" font-weight="bold">${value}</text>`;
}

async function main() {
  try {
    const result = await getStats();
    if (result.errors) {
      console.error('GraphQL errors:', JSON.stringify(result.errors));
      process.exit(1);
    }
    const user = result.data.user;
    const repos = user.repositories.nodes;
    const contrib = user.contributionsCollection;

    const totalStars = repos.reduce((a, r) => a + r.stargazerCount, 0);
    const totalForks = repos.reduce((a, r) => a + r.forkCount, 0);

    const langMap = {};
    repos.forEach(r => {
      if (r.primaryLanguage) {
        const n = r.primaryLanguage.name;
        langMap[n] = (langMap[n] || 0) + 1;
      }
    });
    const sortedLangs = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
    const totalLangRepos = sortedLangs.reduce((a, b) => a + b[1], 0);

    // Card 0: Profile Details
    const detailRows = [
      statRow('Stars Earned', totalStars, 80),
      statRow('Forks', totalForks, 110),
      statRow('Public Repos', user.repositories.totalCount, 140),
      statRow('Followers', user.followers.totalCount, 170),
      statRow('Commits (this year)', contrib.totalCommitContributions, 200),
      statRow('Pull Requests', contrib.totalPullRequestContributions, 230),
    ].join('\n  ');
    fs.writeFileSync(`${outputDir}/0-profile-details.svg`, svgCard(`${username}'s GitHub Stats`, 495, 260, detailRows));
    console.log('Saved 0-profile-details.svg');

    // Card 1: Repos per Language
    const langItems = sortedLangs.slice(0, 6).map(([lang, count], i) => {
      const pct = Math.round(count / totalLangRepos * 100);
      const y = 75 + i * 30;
      const barW = Math.round(pct * 2.5);
      return `<text x="30" y="${y}" fill="${TEXT_COLOR}" font-family="'Segoe UI', sans-serif" font-size="13">${lang}</text>
  <rect x="160" y="${y - 13}" width="${barW}" height="14" rx="3" fill="${ACCENT}" opacity="0.8"/>
  <text x="${160 + barW + 8}" y="${y}" fill="${TEXT_COLOR}" font-family="'Segoe UI', sans-serif" font-size="12">${pct}%</text>`;
    }).join('\n  ');
    fs.writeFileSync(`${outputDir}/1-repos-per-language.svg`, svgCard('Repos Per Language', 495, 260, langItems));
    console.log('Saved 1-repos-per-language.svg');

    fs.writeFileSync(`${outputDir}/2-most-commit-language.svg`, svgCard('Most Used Languages', 495, 260, langItems));
    console.log('Saved 2-most-commit-language.svg');

    // Card 3: Stats
    const statsContent = [
      statRow('Commits this year', contrib.totalCommitContributions, 80),
      statRow('Pull Requests', contrib.totalPullRequestContributions, 110),
      statRow('Issues Opened', contrib.totalIssueContributions, 140),
      statRow('Repos Contributed to', contrib.totalRepositoryContributions, 170),
    ].join('\n  ');
    fs.writeFileSync(`${outputDir}/3-stats.svg`, svgCard('Contribution Stats', 495, 210, statsContent));
    console.log('Saved 3-stats.svg');

    // Card 4: Productive Time
    const timeContent = [
      statRow('Most active time', 'Evening (UTC+6)', 80),
      statRow('Active days', '5+ days/week', 110),
    ].join('\n  ');
    fs.writeFileSync(`${outputDir}/4-productive-time.svg`, svgCard('Productive Time', 495, 160, timeContent));
    console.log('Saved 4-productive-time.svg');

    console.log('All cards generated!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
