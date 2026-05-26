# SnapUML ⚡

A lightning-fast, 100% client-side, and local-first PlantUML-like diagram generator for the web.

**[✨ Try it Live!](https://funap.github.io/snapuml/)**

---

## 🌟 Why SnapUML?

PlantUML is a fantastic, industry-standard tool loved by developers worldwide for defining diagrams as code. 

**SnapUML brings that same intuitive, PlantUML-like writing experience directly to modern web browsers.** It is a lightweight, dependency-free compiler designed to parse and render diagrams entirely client-side, making it incredibly easy to integrate interactive diagrams into web applications, personal blogs, or internal wikis.

### Key Benefits:

- **✍️ Intuitive PlantUML-like Syntax**: Write your sequence and component diagrams using the clean, expressive syntax you already know and love.
- **🔒 Private & Secure by Design**: Since the entire parsing and rendering process happens locally in the user's browser, your architecture data and code never leave your machine.
- **⚡ Real-time, Local Rendering**: Experience instant preview generation as you type, with zero network latency or server roundtrips.
- **📦 Zero External Dependencies**: No Java runtime, no Graphviz installation, and no backend servers required. It's a pure, lightweight TypeScript/JavaScript solution.
- **📶 Works Offline**: Because it runs 100% client-side, you can generate and view diagrams anytime, anywhere, without an internet connection.

---

## 🚀 Features

- **PlantUML-like Syntax**: Use familiar PlantUML-inspired declarations for rapid diagramming.
- **Supported Diagrams**:
  - **Sequence Diagrams** (with actors, participants, boundaries, and control flows)
  - **Component Diagrams** (with components, interfaces, database, package structures)
- **Automatic Inline Rendering**: Easily embed and auto-render diagram code blocks on any webpage.
- **Ultra-Portable**: Easily packageable as a lightweight ES Module or IIFE script.

---

## 🛠️ Quick Start

### 1. In the Browser (HTML Integration)

Simply include the built script and initialize it. SnapUML will scan and auto-convert all `<pre class="snapuml">` blocks into interactive SVG diagrams instantly!

```html
<!-- Load SnapUML -->
<script src="dist/snapuml.min.js"></script>

<!-- Initialize auto-rendering -->
<script>
  snapuml.initialize();
</script>

<!-- Write your diagrams in plain text -->
<pre class="snapuml">
participant User
participant API
database DB

User -> API: GET /users
API -> DB: Query User
DB --> API: User Data
API --> User: 200 OK (JSON)
</pre>
```

### 2. NPM / ES Module Integration

```typescript
import snapuml from 'snapuml';

const code = `
[Component A] -> [Component B] : API Request
`;

// Render to SVG string
const svgString = snapuml.render(code);
```

---

## 💻 Development & Build

### Prerequisites
- **Node.js** (v18.0.0 or later recommended)
- **npm**

### Installation

```bash
npm install
```

### Build Distribution Bundles

Generate browser bundles, minified versions, and ES Modules in the `dist/` directory:

```bash
npm run build
```

This compiles:
- `dist/snapuml.js` - Browser IIFE bundle
- `dist/snapuml.min.js` - Minified Browser IIFE bundle
- `dist/snapuml.esm.mjs` - ES Module bundle
- `dist/snapuml.esm.min.mjs` - Minified ES Module bundle

### Type Check

```bash
npm run type-check
```

### Run Tests

Ensure everything is solid before deploying:

```bash
npm run test
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.