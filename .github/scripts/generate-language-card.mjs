import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "J1angJJ";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "profile-language-card",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

const languageColors = {
  Python: "#3572A5",
  C: "#555555",
  "C++": "#f34b7d",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#663399",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  TeX: "#3D6117",
  Jupyter: "#DA5B0B",
  Markdown: "#083fa1",
  Makefile: "#427819",
  CMake: "#DA3434",
  Vue: "#41b883",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
};

async function request(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function listRepos() {
  const repos = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await request(
      `https://api.github.com/users/${owner}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
    );
    repos.push(
      ...batch.filter((repo) => !repo.fork && !repo.archived && repo.name !== owner),
    );
    if (batch.length < 100) break;
  }
  return repos;
}

async function collectLanguages(repos) {
  const totals = new Map();
  for (const repo of repos) {
    const languages = await request(repo.languages_url);
    for (const [language, bytes] of Object.entries(languages)) {
      totals.set(language, (totals.get(language) || 0) + bytes);
    }
  }
  return [...totals.entries()]
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1]);
}

function buildSvg(languages, dark = false) {
  const total = languages.reduce((sum, [, bytes]) => sum + bytes, 0);
  const top = languages.slice(0, 6);
  const bg = dark ? "#0d1117" : "#ffffff";
  const border = dark ? "#30363d" : "#d0d7de";
  const subtle = dark ? "#161b22" : "#f6f8fa";
  const title = dark ? "#e6edf3" : "#24292f";
  const text = dark ? "#c9d1d9" : "#57606a";
  const muted = dark ? "#8b949e" : "#6e7781";
  const track = dark ? "#21262d" : "#eaeef2";
  const segmentStroke = dark ? "#0d1117" : "#ffffff";
  const width = 520;
  const rowHeight = 48;
  const barX = 28;
  const barWidth = 464;
  const headerY = 34;
  const totalBarY = 76;
  const rowStartY = 126;
  const height = rowStartY + top.length * rowHeight + 18;

  let offset = 0;
  const totalBar = top
    .map(([language, bytes]) => {
      const pct = total ? (bytes / total) * 100 : 0;
      const color = languageColors[language] || "#6e7781";
      const x = offset;
      offset += pct;
      return `<rect x="${x.toFixed(3)}%" y="0" width="${pct.toFixed(3)}%" height="14" fill="${color}" stroke="${segmentStroke}" stroke-width="1"/>`;
    })
    .join("");

  const rows = top
    .map(([language, bytes], index) => {
      const rawPct = total ? (bytes / total) * 100 : 0;
      const pct = rawPct.toFixed(1);
      const fillWidth = Math.max((rawPct / 100) * barWidth, rawPct > 0 ? 3 : 0);
      const y = rowStartY + index * rowHeight;
      const color = languageColors[language] || "#6e7781";
      return [
        `<circle cx="${barX + 6}" cy="${y - 13}" r="5.5" fill="${color}"/>`,
        `<text x="${barX + 20}" y="${y - 8}" fill="${text}" font-size="14" font-weight="600">${escapeXml(language)}</text>`,
        `<text x="${barX + barWidth}" y="${y - 8}" fill="${muted}" font-size="13" text-anchor="end">${pct}%</text>`,
        `<rect x="${barX}" y="${y + 5}" width="${barWidth}" height="12" rx="6" fill="${track}"/>`,
        `<rect x="${barX}" y="${y + 5}" width="${fillWidth.toFixed(1)}" height="12" rx="6" fill="${color}"/>`,
      ].join("");
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Most used languages</title>
  <desc id="desc">Most used languages across public source repositories owned by ${escapeXml(owner)}.</desc>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="6" fill="${bg}" stroke="${border}"/>
  <rect x="16" y="16" width="488" height="86" rx="6" fill="${subtle}"/>
  <text x="28" y="${headerY}" fill="${title}" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700">Most Used Languages</text>
  <text x="28" y="56" fill="${muted}" font-family="Segoe UI, Arial, sans-serif" font-size="12">Public source repositories, sorted by total bytes</text>
  <g transform="translate(${barX} ${totalBarY})">
    <clipPath id="total-bar-clip"><rect width="${barWidth}" height="14" rx="7"/></clipPath>
    <rect width="${barWidth}" height="14" rx="7" fill="${track}"/>
    <g clip-path="url(#total-bar-clip)">${totalBar}</g>
  </g>
  <g font-family="Segoe UI, Arial, sans-serif">${rows}</g>
</svg>
`;
}

const repos = await listRepos();
const languages = await collectLanguages(repos);

await mkdir("readme/resources", { recursive: true });
await writeFile("readme/resources/languages.svg", buildSvg(languages, false));
await writeFile("readme/resources/languages-dark.svg", buildSvg(languages, true));
