# Category Theory Diagram Editor

An interactive diagram editor for category theory and homological algebra.

## Features

- **Objects** — place nodes anywhere on the canvas, label them with LaTeX (e.g. `\mathcal{C}`, `A \otimes B`)
- **Morphisms** — draw arrows between objects with full LaTeX labels
- **Morphism types**: morphism, mono (↪), epi (↠), iso (≅), equivalence (≃), dashed, dotted, natural transformation (⇒), exact
- **Curve control** — drag the control-point handle or use the slider to bend arrows (great for parallel morphisms)
- **Grid snapping** — toggle with `s` or the toolbar button
- **Commutativity checker** — open the "∘ Commutes" panel to detect all node pairs with multiple paths; mark diagrams as commutative (highlights edges in teal)
- **LaTeX rendering** — powered by KaTeX, fully offline
- **SVG export** — downloads a clean SVG of your diagram

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` | Select mode |
| `2` | Add Object mode |
| `3` | Draw mode |
| `s` | Toggle snap to grid |
| `g` | Toggle grid display |
| `Del` / `Backspace` | Delete selected object or morphism |
| `Esc` | Cancel / return to Select mode |

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Build for production

```bash
npm run build
npm run preview
```

## LaTeX label examples

In any label field, you can use standard LaTeX math:

- `f` → italic f
- `\circ` → composition symbol ∘
- `g \circ f` → g ∘ f
- `\eta_A` → η_A
- `\mathcal{F}` → script F
- `H^n(X, \mathbb{Z})` → cohomology group
- `\ker \phi` → kernel
- `\text{id}_A` → identity
