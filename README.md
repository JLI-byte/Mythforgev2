# MythForge

A local-first creative writing and worldbuilding tool for novelists, 
storytellers, and worldbuilders.

## What It Does

MythForge keeps your world bible inside your writing, not beside it. 
Type `[[` anywhere in your document to instantly create a world entry 
without leaving your writing flow. Characters, locations, factions, 
artifacts, and lore all live alongside your manuscript.

## Core Features

- **Inline entity creation** — type `[[` to create world entries at the point of inspiration
- **World Bible** — automatically populated as you write
- **AI Consistency Checker** — checks your manuscript against your world bible
- **Multi-provider AI** — supports Anthropic, OpenAI, Google Gemini, and Ollama
- **Export** — download your work as Markdown or Word (.docx)
- **Offline-first** — everything stored locally, no account required
- **Dark/light mode** — full theme support

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Zustand
- Tiptap

## Getting Started
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start writing.

## API Key (Optional)

The AI Consistency Checker requires an API key. Click the ⚙ settings 
icon in the toolbar and add your key. Supports:

- Anthropic: `sk-ant-...`
- OpenAI: `sk-...`
- Google Gemini: `AIza...`
- Ollama: no key needed (runs locally)
