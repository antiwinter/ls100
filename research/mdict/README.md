# MDict Dictionary Research

Tools and findings for converting MDict dictionaries (`.mdx` files) to structured JSON.

## Quick Start

```bash
# Install
yarn install

# Convert
./convert-v2.js /path/to/dictionary.mdx -c 100
```

## Documentation

- **[CONVERTER.md](./CONVERTER.md)** - Tool usage, architecture, output format
- **[DICT_FINDINGS.md](./DICT_FINDINGS.md)** - Dictionary research, statistics, issues

## Files

- `convert-v2.js` - Main converter (parser-agnostic)
- `parser-ece.js` - Collins ECE parser (has bugs, see DICT_FINDINGS.md)
- `1/` - Output directory (samples & extracts)

## Dictionary Files

Actual `.mdx` files are in `/server/lib/collins/`:
- `Collins-Advanced-ECE.mdx` - English-Chinese (36k entries) ✅ Parser ready
- `Collins-Advanced-EE-3th.mdx` - English-English (35k entries) ❌ No parser
- `Collins-Thesaurus.mdx` - Thesaurus (12k entries) ❌ No parser
- `Collins-Usage.mdx` - Usage guide (500 entries) ❌ No parser
- `Collins English Dictionary and Thesaurus, 2015.mdx` - Combined (80k entries) ❌ No parser
