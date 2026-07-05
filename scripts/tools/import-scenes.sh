#!/bin/bash
# Import ALL pet scene renders (every style pack each pet has) from the
# remotion export into the site repo, resized + converted per site convention
# (sips -Z 1200, JPEG q82, target <400KB, warn otherwise).
#
# Anchor pets = the 8 with pixel animation frames on the site
# (images/team/pets/<pet>/f0-f2.png). Style packs are auto-discovered from
# the export's scenes/<condition>-<pack>.png filenames. Missing conditions
# (e.g. milo night-cinematic) are tolerated with a warning; the client falls
# back to that pack's cloudy render via onerror.
#
# Idempotent: skips files that already exist. Run from repo root:
#   bash scripts/tools/import-scenes.sh
set -euo pipefail

EXPORT="/Users/dominicsenese008/projects/remotion-templates/weatherpets-export/pets"
PETS=(jeter maple tonka hugh frenchy jumper guinness milo)
CONDITIONS=(sunny partlycloudy cloudy rain snow thunderstorm night)

for pet in "${PETS[@]}"; do
  mkdir -p "images/pets/$pet"
  # discover style packs for this pet
  packs=$(ls "$EXPORT/$pet/scenes/" 2>/dev/null | sed -nE 's/^[a-z]+-([a-z-]+)\.png$/\1/p' | sort -u)
  if [[ -z "$packs" ]]; then
    echo "WARN no scene packs found for $pet" >&2
    continue
  fi
  for style in $packs; do
    for cond in "${CONDITIONS[@]}"; do
      src="$EXPORT/$pet/scenes/$cond-$style.png"
      dst="images/pets/$pet/$cond-$style.jpg"
      if [[ -f "$dst" ]]; then
        echo "skip (exists): $dst"
        continue
      fi
      if [[ ! -f "$src" ]]; then
        echo "WARN missing source (client falls back to cloudy): $src" >&2
        continue
      fi
      tmp="images/pets/$pet/.tmp-$cond.png"
      cp "$src" "$tmp"
      sips -Z 1200 "$tmp" >/dev/null 2>&1
      sips -s format jpeg -s formatOptions 82 "$tmp" --out "$dst" >/dev/null 2>&1
      rm "$tmp"
      size=$(stat -f%z "$dst")
      if (( size > 400000 )); then
        echo "WARN >400KB: $dst ($((size/1024))KB)"
      else
        echo "ok: $dst ($((size/1024))KB)"
      fi
    done
  done
done
echo "done."
