// Filters Logic

let allEvents = [];
let activeFilters = { month: '', industries: [], cost: '', cities: [] };

function initializeFilters() {
  // Month filter (custom single-select dropdown)
  setupSingleSelect('month', 'month', 'All Months', getNext6Months());

  // Cost filter (custom single-select dropdown)
  setupSingleSelect('cost', 'cost', 'All Costs');

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

function setupSingleSelect(name, filterKey, defaultLabel, options) {
  const btn = document.getElementById(`${name}-btn`);
  const dropdown = document.getElementById(`${name}-dropdown`);
  if (!btn || !dropdown) return;

  // Populate month options dynamically
  if (options) {
    options.forEach(opt => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `filter-${name}`;
      input.value = opt.value;
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + opt.label));
      dropdown.appendChild(label);
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.multi-select-dropdown').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });

  dropdown.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      activeFilters[filterKey] = radio.value;
      btn.textContent = radio.value ? radio.parentElement.textContent.trim() + ' ▾' : defaultLabel + ' ▾';
      dropdown.classList.remove('open');
      applyFilters();
    });
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
  renderEventCards(filtered);
  updateClearButtonVisibility();
}

function clearFilters() {
  activeFilters = { month: '', industries: [], cost: '', cities: [] };

  // Reset single-select radios
  document.querySelectorAll('.single-select input[type="radio"][value=""]').forEach(r => r.checked = true);

  // Reset multi-select checkboxes
  document.querySelectorAll('.multi-select-dropdown input[type="checkbox"]').forEach(cb => cb.checked = false);

  // Reset button labels
  const monthBtn = document.getElementById('month-btn');
  const costBtn = document.getElementById('cost-btn');
  const industryBtn = document.getElementById('industry-btn');
  const cityBtn = document.getElementById('city-btn');
  if (monthBtn) monthBtn.textContent = 'All Months ▾';
  if (costBtn) costBtn.textContent = 'All Costs ▾';
  if (industryBtn) industryBtn.textContent = 'All Industries ▾';
  if (cityBtn) cityBtn.textContent = 'All Cities ▾';

  renderEventCards(allEvents);
  updateClearButtonVisibility();
}

function updateClearButtonVisibility() {
  const btn = document.getElementById('clear-filters');
  if (!btn) return;
  const active = activeFilters.month || activeFilters.industries.length > 0 || activeFilters.cost || activeFilters.cities.length > 0;
  btn.style.display = active ? 'inline-block' : 'none';
}

function setAllEvents(events) {
  allEvents = events || [];
  renderEventCards(allEvents);
}
