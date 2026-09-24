# Mobility Data Sources Catalog

A static, filterable dashboard for browsing the human mobility data source
catalog assembled during the systematic literature review on mobility
representations and tractability in stochastic spatial epidemic models.

No build step: it's plain HTML/CSS/JS reading `data/entries.json` directly,
so it runs as-is on GitHub Pages.

## Local preview

Browsers block `fetch()` on files opened directly (`file://`), so serve the
folder over local HTTP:

```bash
cd mobility-dashboard
python3 -m http.server 8000
# then open http://localhost:8000
```

## Updating the data

Replace `data/entries.json` with a new export (same schema: `dataset_name`,
`section`, `description`, `accessibility_tag`, `accessibility_description`,
`tags`, `papers`, `bib_keys`, `year`, `region`) and refresh the page — the
filters rebuild themselves from whatever values are present.

## Structure

```
index.html        page shell
css/style.css     styling
js/app.js         data loading, filtering, rendering
data/entries.json the dataset catalog
```
