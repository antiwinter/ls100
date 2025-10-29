import { describe, it, expect } from 'vitest'
import { scopeCSS } from './cssTools.js'

describe('scopeCSS', () => {
  it('should scope simple selectors as descendants', () => {
    const input = 'div { padding: 5px; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card div { padding: 5px; }')
  })

  it('should scope multiple selectors', () => {
    const input = 'div, span, img { margin: 10px; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card div, .anki-card span, .anki-card img { margin: 10px; }')
  })

  it('should replace .card with .anki-card (not scope as descendant)', () => {
    const input = '.card { font-size: 25px; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card { font-size: 25px; }')
  })

  it('should replace .card with pseudo-classes', () => {
    const input = '.card:hover { opacity: 0.8; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card:hover { opacity: 0.8; }')
  })

  it('should replace .card with additional classes', () => {
    const input = '.card.active { border: 1px solid red; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card.active { border: 1px solid red; }')
  })

  it('should scope other class selectors as descendants', () => {
    const input = '.other-class { color: blue; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card .other-class { color: blue; }')
  })

  it('should not double-scope already scoped selectors', () => {
    const input = '.anki-card div { padding: 5px; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card div { padding: 5px; }')
  })

  it('should preserve @-rules without scoping', () => {
    const input = '@font-face { font-family: "test"; src: url("test.woff"); }'
    const output = scopeCSS(input)
    expect(output).toBe('@font-face { font-family: "test"; src: url("test.woff"); }')
  })

  it('should handle :root, html, body as special cases', () => {
    const input = ':root { --color: red; } body { margin: 0; }'
    const output = scopeCSS(input)
    expect(output).toBe('.anki-card { --color: red; } .anki-card { margin: 0; }')
  })

  it('should handle complex real-world Anki CSS', () => {
    const input = `
      div { padding-top:5px; padding-bottom:5px; }
      img { max-height: 150px; margin: 10px; }
      a { color: turquoise; margin: 5px; }
      .card { font-family: 'localnoto', 'notosans'; font-size: 25px; background-color: Black; color: White; }
    `
    const output = scopeCSS(input)

    expect(output).toContain('.anki-card div {')
    expect(output).toContain('.anki-card img {')
    expect(output).toContain('.anki-card a {')
    expect(output).toContain('.anki-card { font-family')
    expect(output).not.toContain('.anki-card .card')
  })
})

