# alexischr.github.io

Hi! It's me, Alexis

## Blog workflow

Posts are static pages generated from markdown:

1. Add `blog/posts/YYYY-MM-DD-slug.md` (first `# heading` becomes the title).
2. Run `npm install` (first time) and `npm run build`.
3. Commit everything the build changed (the new `blog/<slug>.html`, `blog/index.html`, `sitemap.xml`).

## Social card

`og-image.png` is generated from `assets/og-card.html`:

```
npx playwright screenshot --viewport-size=1200,630 --wait-for-timeout=3000 \
  "file://$PWD/assets/og-card.html" og-image.png
```
