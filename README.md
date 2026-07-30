<div align="center">
  <img src="public/favicon.svg" alt="CodeXRay Logo" width="120" />
  <h1>CodeXRay ⚡</h1>
  <p><strong>Look inside the heart of algorithms with AI-assisted, real-time code visualization and analysis.</strong></p>
</div>

---

## About

**CodeXRay** is a modern React and TypeScript web application that visualizes
complex algorithms and data structures step by step. Its built-in “Master
Coder” assistant explains how each step works, including time and space
complexity and the underlying reasoning.

### Features

- **Dynamic visualization:** Scenarios for graph algorithms such as DFS, BFS,
  Dijkstra, and A*, as well as sorting and string algorithms.
- **AI assistant:** Analyzes optimization opportunities and answers questions
  in either AI-backed or offline simulation mode.
- **Timeline controls:** Pause, rewind, advance, and change playback speed.
- **Input presets:** Run supported algorithms with ordered, clustered, or
  chaotic input scenarios (`i1`, `i2`, and `i3`).
- **Modern interface:** A dark, cyberpunk-inspired neon design.

## Getting started

CodeXRay uses Vite and React. Use a current Node.js LTS release.

```bash
git clone https://github.com/srknzl/CodeXRay.git
cd CodeXRay
npm ci
npm run dev
```

Open `http://localhost:5173` in your browser.

### Available commands

```bash
npm run dev      # Start the development server
npm run lint     # Run Oxlint
npm run build    # Type-check and create a production build
npm run preview  # Preview the production build
```

## Contributing

1. Fork the repository.
2. Create a branch (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -m "Add my feature"`).
4. Push the branch (`git push origin feature/my-feature`).
5. Open a pull request.
