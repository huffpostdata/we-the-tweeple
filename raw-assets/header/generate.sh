#!/bin/sh

IN="$(dirname "$0")"
OUT="$IN"/../../assets/images

set -x
convert "$IN"/desktop.png -quality 80 "$OUT"/header-desktop.jpg
convert "$IN"/mobile.png -quality 80 "$OUT"/header-mobile.jpg
