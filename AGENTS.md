# SnapUML Agent Guide ⚡

This document provides high-signal, repo-specific facts and constraints to help AI agents understand and modify SnapUML correctly and safely.

## 🛠 Developer Commands

- **Run all tests:** `npm test` (uses Vitest, completes in <1s)
- **Run a single test file:** `npx vitest run test/sequence/SequenceAutonumber.test.ts`
- **Type-checking:** `npm run type-check` (runs `tsc --noEmit`)
- **Build production bundles:** `npm run build` (type-checks first, then compiles bundles into `dist/` via `esbuild`)
- **Preview local changes:** `npm run preview` (rebuilds and launches local `index.html` in browser)
- **Deploy to GitHub Pages:** `npm run deploy` (runs tests, builds, and deploys `build/` to the `gh-pages` branch)

---

## 🏗 Architecture & Codebase Design

SnapUML is a 100% client-side, dependency-free, serverless PlantUML compiler implemented in TypeScript. It has no runtime Java, Graphviz, or external API dependencies.

### Compiler Pipeline Symmetry
Both Sequence and Component diagrams follow an identical custom compiler pipeline:
`Lexer -> ASTParser -> ASTCompiler -> Diagram Data Model -> SVG Renderer`

### Shared Lexer Core
- **Critical Dependency:** `src/core/parser/Lexer.ts` tokenizes raw lines for **BOTH** sequence and component diagrams. Any modifications to the Lexer can break both parsers.
- **Case-Insensitivity:** Keywords are parsed case-insensitively. The Lexer normalizes words to uppercase when checking against `KEYWORDS`.
- **Ignored Patterns:** Line-start comments (`'`), pragmas (`!pragma`), and directives (`@startuml` / `@enduml` / `@`) are directly skipped by the Lexer.

### Automatic Diagram Detection
`src/index.ts` automatically routes input code to the correct parser using regex heuristics:
- **Sequence:** Detected via presence of sequence keywords (`participant`, `actor`, `boundary`, `control`, `entity`, `collections`, `queue`) or control flows (`alt`, `loop`, `group`, etc.).
- **Component:** Detected via component keywords (`component`, `interface`, `package`, `node`, `cloud`, `database`, `frame`, `folder`) or leading brackets `[...]` at line starts.
- **Fallback:** Defaults to Sequence Diagram rendering.

### Formatting & Rich Text
- **Rich Text Parsing:** `src/core/RichText.ts` converts PlantUML HTML-like tags (e.g., `<b>`, `<u>`, `<font color="...">`) and markdown shorthands (e.g., `**bold**`, `//italic//`) into inline SVG `<tspan>` nodes.
- **Unicode Decodes:** PlantUML Unicode escape sequences like `<U+XXXX>` are decoded to native string characters during post-lexing formatting using `decodeUnicode()`.

---

## ⚠️ Key Coding & Extension Constraints

- **Lifeline & Activation Alignment:** Sequence diagram activations (lifelines) calculate heights based on execution step indexing. If modifying the parser or renderer for activation states (`activate`, `deactivate`), check `SequenceLayout.ts` and `SequenceRenderer.ts` to prevent alignment offsets.
- **No External Imports:** Never introduce runtime Node.js modules or external browser packages. Ensure all logic remains fully native to TypeScript and runs natively in standard browser environments.
- **Verify Build Integrity:** Always run `npm run type-check && npm test` before committing any changes.
