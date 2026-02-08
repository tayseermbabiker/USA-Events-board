// Event Card Rendering

function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.onclick = () => openEventModal(event);

  // Image wrapper
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'event-card-image-wrapper';

  if (event.image_url) {
    const img = document.createElement('img');
    img.className = 'event-card-image';
    img.src = event.image_url;
    img.alt = event.title;
    img.loading = 'lazy';
    img.onerror = function() { this.parentElement.style.background = getRandomGradient(); this.remove(); };
    imageWrapper.appendChild(img);
  } else {
    imageWrapper.style.background = getRandomGradient();
  }

  // Industry badge
  if (event.industry) {
    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.textContent = event.industry;
    badge.style.borderLeft = `3px solid ${getIndustryColor(event.industry)}`;
    imageWrapper.appendChild(badge);
  }

  // Cost badge
  const costBadge = document.createElement('span');
  costBadge.className = 'cost-badge';
  costBadge.textContent = event.is_free ? 'FREE' : 'PAID';
  if (event.is_free) costBadge.style.background = '#10B981';
  imageWrapper.appendChild(costBadge);

  // Source badge
  if (event.source) {
    const srcBadge = document.createElement('span');
    srcBadge.className = 'source-badge';
    srcBadge.textContent = event.source;
    imageWrapper.appendChild(srcBadge);
  }

  card.appendChild(imageWrapper);

  // Content
  const content = document.createElement('div');
  content.className = 'event-card-content';

  const title = document.createElement('h3');
  title.className = 'event-title';
  title.textContent = truncateText(event.title, 80);
  content.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'event-meta';

  // Date
  const dateItem = document.createElement('div');
  dateItem.className = 'event-meta-item';
  let dateText = formatDate(event.start_date);
  if (event.end_date && event.end_date !== event.start_date) {
    dateText += ' - ' + formatDate(event.end_date);
  }
  dateItem.innerHTML = `<span class="icon">📅</span><span>${dateText}</span>`;
  meta.appendChild(dateItem);

  // City
  if (event.city) {
    const cityItem = document.createElement('div');
    cityItem.className = 'event-meta-item';
    cityItem.innerHTML = `<span class="icon">📍</span><span>${escapeHtml(event.city)}</span>`;
    meta.appendChild(cityItem);
  }

  // Venue
  if (event.venue_name) {
    const venueItem = document.createElement('div');
    venueItem.className = 'event-meta-item';
    venueItem.innerHTML = `<span class="icon">🏛️</span><span>${escapeHtml(truncateText(event.venue_name, 40))}</span>`;
    meta.appendChild(venueItem);
  }

  content.appendChild(meta);

  // Organizer
  if (event.organizer) {
    const org = document.createElement('p');
    org.className = 'event-organizer';
    org.textContent = 'By ' + event.organizer;
    content.appendChild(org);
  }

  // Register button
  const btn = document.createElement('button');
  btn.className = 'btn-primary btn-full';
  btn.textContent = event.is_free ? 'Register Free' : 'Book Now';
  btn.onclick = (e) => {
    e.stopPropagation();
    if (event.registration_url) {
      window.open(event.registration_url, '_blank', 'noopener,noreferrer');
    }
  };
  content.appendChild(btn);

  card.appendChild(content);
  return card;
}

function renderEventCards(events) {
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!events || events.length === 0) {
    showEmptyState();
    updateEventCount(0);
    return;
  }

  hideEmptyState();
  updateEventCount(events.length);

  events.forEach(event => {
    grid.appendChild(createEventCard(event));
  });
}

function updateEventCount(count) {
  const el = document.getElementById('event-count');
  if (el) {
    el.textContent = count === 0 ? 'No events found' : `${count} event${count !== 1 ? 's' : ''} found`;
  }
}
