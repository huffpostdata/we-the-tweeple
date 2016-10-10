#!/usr/bin/env node

'use strict'

/**
 * Creates a UTFGrid representation of all the birds in the directory.
 *
 * https://github.com/mapbox/utfgrid-spec/blob/master/1.3/utfgrid.md
 *
 * The "grid" is the input image -- that is, a pixel array corresponding to
 * the background JPEG.
 *
 * The "keys" are the words top search for.
 */
const fs = require('fs')
const Canvas = require('canvas')

const dir = process.argv[2]
console.log(`Reading files from ${dir}...`)

const basenames = fs.readdirSync(dir)
if (basenames.length === 0) throw new Error("Need at least one image")
console.log(`Files: ${basenames.join(' ')}`)

const keys = [ null ]
const grid = []
let width = null
let height = null

function keyToChar(key) {
  let index = keys.length
  keys.push(key)

  // https://github.com/mapbox/utfgrid-spec/blob/master/1.3/utfgrid.md#encoding-ids
  index += 32
  if (index >= 34) index += 1
  if (index >= 92) index += 1
  return String.fromCharCode(index)
}

function charToKey(c) {
  let id = c.charCodeAt(0)
  if (id >= 93) id -= 1
  if (id >= 35) id -= 1
  id -= 32

  return keys[id]
}

for (let basename of basenames) {
  console.log(`${basename}...`)

  const image = new Canvas.Image()
  image.src = fs.readFileSync(`${dir}/${basename}`)
  if (width === null) {
    width = image.width
    height = image.height

    const row = []
    for (let x = 0; x < width; x++) {
      row.push(' ')
    }
    for (let y = 0; y < height; y++) {
      grid.push(row.slice())
    }
  } else {
    if (width !== image.width || height !== image.height) {
      throw new Error(`Wrong size in ${basename}! Expected ${width}x${height}, got ${image.width}x${image.height}`)
    }
  }

  const key = basename.slice(0, basename.length - 4)
  const c = keyToChar(key)

  const canvas = new Canvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, width, height)
  const buf = canvas.toBuffer('raw')
  for (let y = 0; y < height; y++) {
    const row = buf.slice(y * canvas.stride)
    for (let x = 0; x < width; x++) {
      // LE or BE doesn't matter: all transparent pixels are 0
      const px = row.readUInt32LE(x * 4)
      if (px > 0) grid[y][x] = c
    }
  }
}

const utfgrid = {
  grid: grid.map(r => r.join('')),
  keys: keys
}

const outFilename = `${__dirname}/../../assets/data/${dir}-grid.json`
console.log(`Writing ${outFilename}`)
fs.writeFileSync(outFilename, JSON.stringify(utfgrid, undefined, ' '))
