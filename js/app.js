(function () {
  "use strict";

  let ENTRIES = [];
  const state = {
    search: "",
    section: new Set(),
    accessibility_tag: new Set(),
    tags: new Set(),
    region: new Set(),
    yearFrom: null,
    yearTo: null,
    sort: "name",
  };

  const el = (id) => document.getElementById(id);

  function normalizeRegion(r) {
    return r.replace(/\s*\(.*?\)/g, "").trim();
  }

  function parseYearBounds(yearList) {
    const nums = [];
    yearList.forEach((y) => {
      (y.match(/\d{4}/g) || []).forEach((n) => nums.push(parseInt(n, 10)));
    });
    if (!nums.length) return { min: null, max: null };
    return { min: Math.min(...nums), max: Math.max(...nums) };
  }

  function init(data) {
    ENTRIES = data.map((d, i) => {
      const bounds = parseYearBounds(d.year);
      return {
        ...d,
        _id: i,
        _regionNorm: [...new Set(d.region.map(normalizeRegion))],
        _yearMin: bounds.min,
        _yearMax: bounds.max,
      };
    });
    buildFacet("section-filters", "section", uniqueSorted(ENTRIES, "section"));
    buildFacet("access-filters", "accessibility_tag", uniqueSorted(ENTRIES, "accessibility_tag"));
    buildFacet("tag-filters", "tags", uniqueSorted(ENTRIES, "tags", true));
    buildFacet("region-filters", "region", uniqueSorted(ENTRIES, "_regionNorm", true));

    const knownYears = ENTRIES.flatMap((e) => [e._yearMin, e._yearMax]).filter((y) => y !== null);
    if (knownYears.length) {
      el("year-from").placeholder = `From ${Math.min(...knownYears)}`;
      el("year-to").placeholder = `To ${Math.max(...knownYears)}`;
    }

    el("masthead-stats").textContent =
      `${ENTRIES.length} datasets \u00b7 ${uniqueSorted(ENTRIES, "section").length} categories`;

    el("search-input").addEventListener("input", (e) => {
      state.search = e.target.value.trim().toLowerCase();
      render();
    });
    el("sort-select").addEventListener("change", (e) => {
      state.sort = e.target.value;
      render();
    });
    el("reset-all").addEventListener("click", resetAll);
    el("empty-reset").addEventListener("click", resetAll);

    el("about-toggle").addEventListener("click", () => {
      const btn = el("about-toggle");
      const panel = el("about-panel");
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      btn.classList.toggle("active", !expanded);
      panel.hidden = expanded;
    });

    el("year-from").addEventListener("input", (e) => {
      state.yearFrom = e.target.value ? parseInt(e.target.value, 10) : null;
      render();
    });
    el("year-to").addEventListener("input", (e) => {
      state.yearTo = e.target.value ? parseInt(e.target.value, 10) : null;
      render();
    });
    el("clear-year").addEventListener("click", () => {
      state.yearFrom = null;
      state.yearTo = null;
      el("year-from").value = "";
      el("year-to").value = "";
      render();
    });

    document.querySelectorAll(".clear-btn[data-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.clear;
        state[key].clear();
        syncCheckboxes();
        render();
      });
    });

    el("modal-backdrop").addEventListener("click", (e) => {
      if (e.target.id === "modal-backdrop") closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    render();
  }

  function uniqueSorted(entries, field, isArray) {
    const set = new Set();
    entries.forEach((e) => {
      if (isArray) e[field].forEach((v) => set.add(v));
      else set.add(e[field]);
    });
    return [...set].sort();
  }

  function buildFacet(containerId, stateKey, values) {
    const container = el(containerId);
    container.innerHTML = "";
    values.forEach((val) => {
      const label = document.createElement("label");
      label.className = "checkbox-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = val;
      input.addEventListener("change", () => {
        if (input.checked) state[stateKey].add(val);
        else state[stateKey].delete(val);
        render();
      });
      const span = document.createElement("span");
      span.textContent = val;
      const count = document.createElement("span");
      count.className = "count";
      count.dataset.facetCount = val;
      label.appendChild(input);
      label.appendChild(span);
      label.appendChild(count);
      container.appendChild(label);
    });
  }

  function syncCheckboxes() {
    ["section", "accessibility_tag", "tags", "region"].forEach((key) => {
      document
        .querySelectorAll(`#${facetContainerId(key)} input`)
        .forEach((input) => {
          input.checked = state[key].has(input.value);
        });
    });
  }

  function facetContainerId(key) {
    return {
      section: "section-filters",
      accessibility_tag: "access-filters",
      tags: "tag-filters",
      region: "region-filters",
    }[key];
  }

  function resetAll() {
    state.search = "";
    state.section.clear();
    state.accessibility_tag.clear();
    state.tags.clear();
    state.region.clear();
    state.yearFrom = null;
    state.yearTo = null;
    el("search-input").value = "";
    el("year-from").value = "";
    el("year-to").value = "";
    document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach((i) => (i.checked = false));
    render();
  }

  function matches(entry, excludeKey) {
    if (excludeKey !== "section" && state.section.size && !state.section.has(entry.section)) return false;
    if (excludeKey !== "accessibility_tag" && state.accessibility_tag.size && !state.accessibility_tag.has(entry.accessibility_tag)) return false;
    if (excludeKey !== "tags" && state.tags.size && !entry.tags.some((t) => state.tags.has(t))) return false;
    if (excludeKey !== "region" && state.region.size && !entry._regionNorm.some((r) => state.region.has(r))) return false;
    if (state.yearFrom !== null && (entry._yearMax === null || entry._yearMax < state.yearFrom)) return false;
    if (state.yearTo !== null && (entry._yearMin === null || entry._yearMin > state.yearTo)) return false;
    if (state.search) {
      const hay = (entry.dataset_name + " " + entry.description).toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  }

  function sortEntries(list) {
    const sorted = [...list];
    if (state.sort === "name") sorted.sort((a, b) => a.dataset_name.localeCompare(b.dataset_name));
    else if (state.sort === "section") sorted.sort((a, b) => a.section.localeCompare(b.section) || a.dataset_name.localeCompare(b.dataset_name));
    else if (state.sort === "access") sorted.sort((a, b) => a.accessibility_tag.localeCompare(b.accessibility_tag) || a.dataset_name.localeCompare(b.dataset_name));
    return sorted;
  }

  function render() {
    const filtered = sortEntries(ENTRIES.filter((e) => matches(e)));

    updateFacetCounts();

    el("result-count").textContent = `${filtered.length} of ${ENTRIES.length} datasets`;

    const cardsEl = el("cards");
    cardsEl.innerHTML = "";
    el("empty-state").hidden = filtered.length !== 0;

    filtered.forEach((entry) => cardsEl.appendChild(renderCard(entry)));
  }

  function updateFacetCounts() {
    // Each facet's counts are computed against every OTHER active filter,
    // but ignore that facet's own current selections -- otherwise checking
    // a second box in the same group (an OR) inflates sibling counts to
    // reflect the widened result set instead of "how many total items have
    // this value."
    tallyFacet("section", "section-filters", (e) => [e.section]);
    tallyFacet("accessibility_tag", "access-filters", (e) => [e.accessibility_tag]);
    tallyFacet("tags", "tag-filters", (e) => e.tags);
    tallyFacet("region", "region-filters", (e) => e._regionNorm);
  }

  function tallyFacet(key, containerId, getValues) {
    const base = ENTRIES.filter((e) => matches(e, key));
    const counts = {};
    base.forEach((e) => getValues(e).forEach((v) => (counts[v] = (counts[v] || 0) + 1)));
    document.querySelectorAll(`#${containerId} .count`).forEach((c) => {
      c.textContent = counts[c.dataset.facetCount] || 0;
    });
  }

  function renderCard(entry) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.access = entry.accessibility_tag;
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const top = document.createElement("div");
    top.className = "card-top";
    const name = document.createElement("h3");
    name.className = "card-name";
    name.textContent = entry.dataset_name;
    const section = document.createElement("span");
    section.className = "card-section";
    section.textContent = entry.section;
    top.appendChild(name);
    top.appendChild(section);

    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = firstSentences(entry.description, 2);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.appendChild(pill(entry.accessibility_tag, "pill-access " + entry.accessibility_tag));
    entry.tags.slice(0, 4).forEach((t) => meta.appendChild(pill(t, "pill-tag")));
    if (entry.tags.length > 4) meta.appendChild(pill(`+${entry.tags.length - 4}`, "pill-tag"));

    card.appendChild(top);
    card.appendChild(desc);
    card.appendChild(meta);

    card.addEventListener("click", () => openModal(entry));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(entry);
      }
    });

    return card;
  }

  function pill(text, className) {
    const span = document.createElement("span");
    span.className = "pill " + className;
    span.textContent = text;
    return span;
  }

  function firstSentences(text, n) {
    const parts = text.split(/(?<=[.!?])\s+/).slice(0, n);
    return parts.join(" ");
  }

  function openModal(entry) {
    const modal = el("modal-content");
    modal.innerHTML = "";

    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", closeModal);

    const h2 = document.createElement("h2");
    h2.textContent = entry.dataset_name;

    const section = document.createElement("span");
    section.className = "card-section";
    section.textContent = entry.section;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.style.marginBottom = "1rem";
    meta.appendChild(pill(entry.accessibility_tag, "pill-access " + entry.accessibility_tag));
    entry.tags.forEach((t) => meta.appendChild(pill(t, "pill-tag")));

    const body = document.createElement("div");
    body.className = "modal-body";
    body.textContent = entry.description;

    const accessLabel = document.createElement("div");
    accessLabel.className = "modal-section-label";
    accessLabel.textContent = "Accessibility notes";
    const accessBody = document.createElement("div");
    accessBody.className = "modal-body";
    accessBody.textContent = entry.accessibility_description;

    const coverageLabel = document.createElement("div");
    coverageLabel.className = "modal-section-label";
    coverageLabel.textContent = "Coverage";
    const coverageBody = document.createElement("div");
    coverageBody.className = "card-meta";
    entry.region.forEach((r) => coverageBody.appendChild(pill(r, "pill-region")));
    entry.year.forEach((y) => coverageBody.appendChild(pill(y, "pill-region")));

    const papersLabel = document.createElement("div");
    papersLabel.className = "modal-section-label";
    papersLabel.textContent = `Cited in ${entry.bib_keys.length} paper(s)`;
    const links = document.createElement("div");
    links.className = "modal-links";
    entry.papers.forEach((doi, i) => {
      const a = document.createElement("a");
      a.href = doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = entry.bib_keys[i] || doi;
      links.appendChild(a);
    });

    modal.appendChild(closeBtn);
    modal.appendChild(h2);
    modal.appendChild(section);
    modal.appendChild(meta);
    modal.appendChild(body);
    modal.appendChild(accessLabel);
    modal.appendChild(accessBody);
    modal.appendChild(coverageLabel);
    modal.appendChild(coverageBody);
    modal.appendChild(papersLabel);
    modal.appendChild(links);

    el("modal-backdrop").hidden = false;
    closeBtn.focus();
  }

  function closeModal() {
    el("modal-backdrop").hidden = true;
  }

  fetch("data/entries.json")
    .then((r) => r.json())
    .then(init)
    .catch((err) => {
      el("cards").innerHTML = `<p style="color:#A23E3E">Couldn't load data/entries.json: ${err}</p>`;
    });
})();
