#!/bin/sh

IN="$(dirname "$0")"
OUT="$IN"/../assets/images

set -e -x
convert "$IN"/header/desktop.png -quality 80 "$OUT"/header-desktop.jpg
convert "$IN"/header/mobile.png -quality 80 "$OUT"/header-mobile.jpg
convert "$IN"/bird.png -background white -flatten -quality 80 "$OUT"/bird.jpg
