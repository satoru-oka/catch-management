#!/usr/bin/env node
// 単発の修正スクリプト: <label> と直後の <input>/<select>/<textarea> に
// id / htmlFor を付与する。フィールドの name 属性をそのまま id として再利用する。
//
// 使い方: node scripts/add-label-ids.mjs <page-id-prefix> <file...>
//   prefix と name を組み合わせて id を作る (ページ間衝突を避けるため)。
//
// 実装上の注意: 既に id / htmlFor が付いているブロックはスキップする。

import fs from 'node:fs'

const [, , prefix, ...files] = process.argv
if (!prefix || files.length === 0) {
  console.error('usage: add-label-ids.mjs <prefix> <file...>')
  process.exit(2)
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')

  // <label className="..."> ... </label>\s*<(input|select|textarea) ... name="X" ...
  // multi-line. 単純化して最初に見つかる name="..." を採用する。
  const re =
    /<label(?![^>]*\bhtmlFor=)(\s+className="[^"]*")>([\s\S]*?)<\/label>(\s*)<(input|select|textarea)(?![^>]*\bid=)(\s[^>]*?)\bname="([\w]+)"/g

  const updated = src.replace(re, (m, cls, inner, gap, tag, attrs, name) => {
    const id = `${prefix}-${name}`
    return `<label htmlFor="${id}"${cls}>${inner}</label>${gap}<${tag}${attrs}id="${id}" name="${name}"`
  })

  if (updated === src) {
    console.log(`[skip] ${file} (no changes)`)
    continue
  }
  fs.writeFileSync(file, updated)
  console.log(`[done] ${file}`)
}
