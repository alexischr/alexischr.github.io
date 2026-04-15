#!/bin/bash
# Scans blog/posts/*.md and writes blog/posts.json
# Extracts title from first "# ..." line, date from YYYY-MM-DD filename prefix.
# Run from repo root: ./blog/generate-posts.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
POSTS_DIR="$DIR/posts"
OUT="$DIR/posts.json"

echo "[" > "$OUT"
first=true

for f in $(ls -r "$POSTS_DIR"/*.md 2>/dev/null); do
  slug=$(basename "$f" .md)
  date=$(echo "$slug" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
  title=$(grep -m1 '^# ' "$f" | sed 's/^# //')

  if [ -z "$title" ]; then
    # derive title from slug minus date prefix
    title=$(echo "$slug" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//' | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1')
  fi

  if [ "$first" = true ]; then
    first=false
  else
    echo "," >> "$OUT"
  fi

  printf '  {"slug": "%s", "title": "%s", "date": "%s"}' "$slug" "$title" "$date" >> "$OUT"
done

echo "" >> "$OUT"
echo "]" >> "$OUT"

echo "Wrote $(grep -c '"slug"' "$OUT") post(s) to $OUT"
