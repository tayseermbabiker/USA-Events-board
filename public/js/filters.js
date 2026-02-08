// Filters Logic

let allEvents = [];
let activeFilters = { month: '', industries: [], cost: '', cities: [], source: '' };

function initializeFilters() {
  // Month filter
  const monthFilter = document.getElementById('filter-month');
  if (monthFilter) {
    getNext6Months().forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      monthFilter.appendChild(opt);
    });
    monthFilter.addEventListener('change', (e) => { activeFilters.month = e.target.value; applyFilters(); });
  }

  // Cost filter
  const costFilter = document.getElementById('filter-cost');
  if (costFilter) {
    costFilter.addEventListener('change', (e) => { activeFilters.cost = e.target.value; applyFilters(); });
  }

  // Source filter
  const sourceFilter = document.getElementById('filter-source');
  if (sourceFilter) {
    sourceFilter.addEventListener('change', (e) => { activeFilters.source = e.target.value; applyFilters(); });
  }

  // Multi-selects
  setupMultiSelect('industry', 'industries', 'All Industries');
  setupMultiSelect('city', 'cities', 'All Cities');

  // Clear filters
  const clearBtn = document.getElementById('clear-filters');
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);

  // Reset from empty state
  const resetBtn = document.getElementById('reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', clearFilters);

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select')) {
      document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('open'));
    }
  });
}

function setupMultiSelect(name, filterKey, defaultLabel) {
  const btn = document.getElementById(`${name}-btn`);
  const dropdown = document.getElementById(`${name}-dropdown`);
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.multi-select-dropdown').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });

  dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const values = Array.from(dropdown.querySelectorAll('input:checked')).map(c => c.value);
      activeFilters[filterKey] = values;
      btn.textContent = values.length === 0 ? defaultLabel + ' ▾' :
                         values.length === 1 ? values[0] + ' ▾' :
                         values.length + ' selected ▾';
      applyFilters();
    });
  });
}

function applyFilters() {
  let filtered = [...allEvents];

  if (activeFilters.month) {
    filtered = filtered.filter(e => e.start_date && e.start_date.substring(0, 7) === activeFilters.month);
  }
  if (activeFilters.industries.length > 0) {
    filtered = filtered.filter(e => activeFilters.industries.includes(e.industry));
  }
  if (activeFilters.cost) {
    filtered = filtered.filter(e => activeFilters.cost === 'free' ? e.is_free === true : e.is_free === false);
  }
  if (activeFilters.cities.length > 0) {
    filtered = filtered.filter(e => activeFilters.cities.includes(e.city));
  }
  if (activeFilters.source) {
    filtered = filtered.filter(e => e.source === activeFilters.source);
  }

  renderEventCards(filtered);
  updateClearButtonVisibility();
}

function clearFilters() {
  activeFilters = { month: '', industries: [], cost: '', cities: [], source: '' };

  ['filter-month', 'filter-cost', 'filter-source'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.querySelectorAll('.multi-select-dropdown input').forEach(cb => cb.checked = false);

  const industryBtn = document.getElementById('industry-btn');
  const cityBtn = document.getElementById('city-btn');
  if (industryBtn) industryBtn.textContent = 'All Industries ▾';
  if (cityBtn) cityBtn.textContent = 'All Cities ▾';

  renderEventCards(allEvents);
  updateClearButtonVisibility();
}

function updateClearButtonVisibility() {
  const btn = document.getElementById('clear-filters');
  if (!btn) return;
  const active = activeFilters.month || activeFilters.industries.length > 0 || activeFilters.cost || activeFilters.cities.length > 0 || activeFilters.source;
  btn.style.display = active ? 'inline-block' : 'none';
}

function setAllEvents(events) {
  allEvents = events || [];
  renderEventCards(allEvents);
}
