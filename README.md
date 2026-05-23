# SnapUML ⚡

A lightning-fast, 100% serverless, and local-first PlantUML-compatible diagram generator for the web.

**[✨ Try it Live!](https://funap.github.io/snapuml/)**

---

## 🌟 Why SnapUML?

Traditional PlantUML tools often require either a backend Java server (along with Graphviz installation) or sending your sensitive diagram data to public/third-party servers. 

**SnapUML changes that.** It is built to run entirely inside the user's browser, processing text and rendering high-quality SVGs locally. 

### Key Benefits:
- **🔒 Maximum Privacy & Security**: Your code and software architecture diagrams never leave your machine. No external servers, no privacy leaks. Perfect for enterprise internal use and private repositories.
- **☁️ Zero-Server, 100% Serverless**: No backend servers to maintain, no Java runtime to install, and no network dependencies. It runs completely client-side.
- **⚡ Real-time, Local Rendering**: Experience instant rendering with zero network latency. As fast as you type, your SVGs are generated.
- **📶 Offline Support**: Work anywhere, anytime. Since there are no server roundtrips, it works perfectly without an internet connection.

---

## 🚀 Features

- **PlantUML-Compatible**: Use the intuitive and clean PlantUML syntax you already know.
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

const plantumlCode = `
[Component A] -> [Component B] : API Request
`;

// Render to SVG string
const svgString = snapuml.render(plantumlCode);
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