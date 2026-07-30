# CoAction (React)

React + Vite port of the static HTML prototype.

## Run it

```
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build for production

```
npm run build
npm run preview
```

## Structure

- `src/App.jsx` — top-level page router (simple useState switch, no react-router)
- `src/components/TopNav.jsx` — top navigation bar
- `src/pages/` — one component per page (Dashboard, ApiLibrary, Upload, Download, Tags, Access, Usage)
- `src/data/apis.js` — shared mock data for the 7 APIs, consumed by Dashboard, ApiLibrary, Download, and Usage
- `src/App.css` — all styling (ported 1:1 from the original prototype's inline `<style>` block)
