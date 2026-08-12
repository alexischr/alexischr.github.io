#!/usr/bin/env node
// Static blog builder for thenull.net.
//
// Reads blog/posts/*.md and writes a static blog/<slug>.html per post,
// rewrites the post list in blog/index.html (between the posts:start/end
// markers), and regenerates sitemap.xml.
//
// Usage: npm run build   (from the repo root, after `npm install`)

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const katex = require('katex');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(__dirname, 'posts');
const SITE = 'https://thenull.net';

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escapeJson = (s) => JSON.stringify(s).slice(1, -1);

// ── Collect posts ───────────────────────────────────────────
const posts = [];
for (const file of fs.readdirSync(POSTS_DIR).sort().reverse()) {
  if (!file.endsWith('.md')) continue;
  const slug = file.slice(0, -3);
  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    console.warn(`skipping ${file}: filename must start with YYYY-MM-DD`);
    continue;
  }
  const date = dateMatch[1];
  const md = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');

  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug.slice(11).replace(/-/g, ' ');
  const body = titleMatch ? md.replace(/^#\s+.+\n+/, '') : md;

  // Description: first non-heading paragraph, rendered → tags stripped → ≤160 chars.
  const firstPara = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith('#')) || '';
  let description = marked
    .parse(firstPara)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (description.length > 160) {
    description = description.slice(0, 160).replace(/\s+\S*$/, '') + '…';
  }

  // Render markdown, then KaTeX ($$…$$ blocks first, then $…$ inline) —
  // same pipeline the old client-side post.html used.
  let hasMath = false;
  const html = marked
    .parse(body)
    .replace(/\$\$([^$]+?)\$\$/g, (_, tex) => {
      hasMath = true;
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    })
    .replace(/\$([^$]+?)\$/g, (_, tex) => {
      hasMath = true;
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    });

  posts.push({ slug, date, title, description, html, hasMath });
}

// ── Write post pages ────────────────────────────────────────
const template = fs.readFileSync(path.join(__dirname, '_template.html'), 'utf8');
for (const p of posts) {
  const page = template
    .replaceAll('{{TITLE}}', escapeHtml(p.title))
    .replaceAll('{{TITLE_JSON}}', escapeJson(p.title))
    .replaceAll('{{DESCRIPTION}}', escapeHtml(p.description))
    .replaceAll('{{DESCRIPTION_JSON}}', escapeJson(p.description))
    .replaceAll('{{CANONICAL}}', `${SITE}/blog/${p.slug}`)
    .replaceAll('{{DATE_ISO}}', p.date)
    .replaceAll('{{DATE}}', p.date)
    .replaceAll(
      '{{KATEX_CSS}}',
      p.hasMath
        ? '  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css" />'
        : ''
    )
    .replace('{{BODY}}', p.html);
  fs.writeFileSync(path.join(__dirname, `${p.slug}.html`), page);
  console.log(`wrote blog/${p.slug}.html`);
}

// ── Rewrite the post list in blog/index.html ────────────────
const indexPath = path.join(__dirname, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const listItems = posts.length
  ? posts
      .map(
        (p) => `        <li class="post-item">
          <time class="post-date" datetime="${p.date}">${p.date}</time>
          <a class="post-title" href="/blog/${p.slug}">${escapeHtml(p.title)}</a>
        </li>`
      )
      .join('\n')
  : '        <li class="post-item"><span class="post-date">—</span> Nothing here yet.</li>';
const updated = index.replace(
  /(<!-- posts:start -->)[\s\S]*?(<!-- posts:end -->)/,
  `$1\n${listItems}\n        $2`
);
if (updated === index && !index.includes('<!-- posts:start -->')) {
  throw new Error('blog/index.html is missing the <!-- posts:start/end --> markers');
}
fs.writeFileSync(indexPath, updated);
console.log('updated blog/index.html');

// ── Regenerate sitemap.xml ──────────────────────────────────
const latest = posts[0] ? posts[0].date : null;
const urls = [
  { loc: `${SITE}/`, lastmod: latest, priority: '1.0' },
  { loc: `${SITE}/blog/`, lastmod: latest, priority: '0.7' },
  ...posts.map((p) => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.date, priority: '0.6' })),
  { loc: `${SITE}/resume.pdf`, priority: '0.8' },
  { loc: `${SITE}/burbujafighters.html`, priority: '0.3' },
];
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
console.log('updated sitemap.xml');
