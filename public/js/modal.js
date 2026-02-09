// Modal System

function openEventModal(event) {
  const modal = document.getElementById('event-modal');
  const body = document.getElementById('modal-body');
  if (!modal || !body) return;

  body.innerHTML = buildEventModalContent(event);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleEscapeKey);
}

function closeEventModal() {
  const modal = document.getElementById('event-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleEscapeKey);
  }
}

function buildEventModalContent(event) {
  const imageHtml = event.image_url
    ? `<img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.title)}" class="modal-image">`
    : `<div class="modal-image" style="background: ${getRandomGradient()};"></div>`;

  const startDate = formatFullDateTime(event.start_date);
  const endDate = event.end_date && event.end_date !== event.start_date ? formatFullDateTime(event.end_date) : '';

  const venueHtml = event.venue_name ? `
    <div class="meta-block">
      <strong>Venue</strong>
      <p>${escapeHtml(event.venue_name)}</p>
      ${event.venue_address ? `<p style="font-size:14px;color:var(--grey-dark);">${escapeHtml(event.venue_address)}</p>` : ''}
    </div>` : '';

  const organizerHtml = event.organizer ? `
    <div class="meta-block">
      <strong>Organized by</strong>
      <p>${escapeHtml(event.organizer)}</p>
    </div>` : '';

  const descriptionHtml = event.description ? `
    <div class="description">
      <strong>About this event</strong>
      <p>${escapeHtml(event.description)}</p>
    </div>` : '';

  const regUrl = event.registration_url || '#';

  return `
    ${imageHtml}
    <h2 style="margin-bottom:var(--space-md);color:var(--navy-dark);font-family:var(--font-serif);font-weight:400;">${escapeHtml(event.title)}</h2>
    <p class="modal-subtitle">
      ${event.is_free ? '<strong style="color:var(--success);">FREE EVENT</strong>' : '<strong style="color:var(--gold);">PAID EVENT</strong>'}
      ${event.source ? `&nbsp;&middot;&nbsp;<span style="color:var(--grey-dark);">via ${escapeHtml(event.source)}</span>` : ''}
    </p>
    <div class="modal-event-meta">
      <div class="meta-block">
        <strong>Date</strong>
        <p>${startDate}</p>
        ${endDate ? `<p>to ${endDate}</p>` : ''}
      </div>
      <div class="meta-block">
        <strong>City</strong>
        <p>${escapeHtml(event.city || 'United States')}</p>
      </div>
      ${venueHtml}
      ${organizerHtml}
      <div class="meta-block">
        <strong>Industry</strong>
        <p style="color:${getIndustryColor(event.industry)};font-weight:600;">${escapeHtml(event.industry || 'Other')}</p>
      </div>
    </div>
    ${descriptionHtml}
    <button class="btn-primary btn-full" onclick="window.open('${escapeHtml(regUrl)}','_blank','noopener,noreferrer')" style="margin-top:var(--space-lg);">
      ${event.is_free ? 'Register for Free' : 'Book Now'}
    </button>
    <div style="margin-top:var(--space-lg);text-align:center;">
      <p style="font-size:14px;color:var(--grey-dark);margin-bottom:var(--space-sm);">Share this event</p>
      <div style="display:flex;gap:var(--space-sm);justify-content:center;flex-wrap:wrap;">
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(regUrl)}" target="_blank" rel="noopener" style="padding:8px 16px;background:#0077B5;color:white;border-radius:6px;font-size:14px;font-weight:500;">LinkedIn</a>
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(event.title)}&url=${encodeURIComponent(regUrl)}" target="_blank" rel="noopener" style="padding:8px 16px;background:#1DA1F2;color:white;border-radius:6px;font-size:14px;font-weight:500;">Twitter</a>
        <a href="https://wa.me/?text=${encodeURIComponent(event.title + ' - ' + regUrl)}" target="_blank" rel="noopener" style="padding:8px 16px;background:#25D366;color:white;border-radius:6px;font-size:14px;font-weight:500;">WhatsApp</a>
      </div>
    </div>
    <p class="privacy-note" style="margin-top:var(--space-md);">You'll be redirected to the organizer's registration page</p>
  `;
}

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.style.display = 'block';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setupChipToggle('modal-city-prefs', 'modal-city');
    setupChipToggle('modal-industry-prefs', 'modal-industry');
  }
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Chip toggle: selecting specific chips unchecks "All", unchecking all re-checks "All"
function setupChipToggle(containerId, inputName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const checkboxes = container.querySelectorAll(`input[name="${inputName}"]`);
  const allChip = container.querySelector(`input[name="${inputName}"][value=""]`);

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb === allChip) {
        // "All" was clicked — uncheck all specifics
        if (cb.checked) {
          checkboxes.forEach(c => { if (c !== allChip) c.checked = false; });
        } else {
          // Can't uncheck "All" by itself — re-check it
          cb.checked = true;
        }
      } else {
        // A specific chip was toggled
        const anySpecific = Array.from(checkboxes).some(c => c !== allChip && c.checked);
        if (anySpecific) {
          allChip.checked = false;
        } else {
          allChip.checked = true;
        }
      }
    });
  });
}

// Gather checked chip values as comma-separated string (empty = all)
function getChipValues(inputName) {
  const checkboxes = document.querySelectorAll(`input[name="${inputName}"]:checked`);
  const values = Array.from(checkboxes).map(cb => cb.value).filter(v => v !== '');
  return values.join(', ');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('login-name').value.trim();
  const email = document.getElementById('login-email').value.trim();
  const cities = getChipValues('modal-city');
  const industries = getChipValues('modal-industry');
  const msgEl = document.getElementById('login-message');

  // Save locally
  saveUser({ first_name: name, email: email });
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.textContent = 'Hi, ' + name;

  // POST to subscribe endpoint
  try {
    const res = await fetch('/.netlify/functions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, first_name: name, cities, industries }),
    });
    const data = await res.json();
    if (data.success) {
      if (msgEl) {
        msgEl.className = 'message success';
        msgEl.textContent = data.message;
      }
      setTimeout(closeLoginModal, 1500);
    } else {
      throw new Error(data.error || 'Subscription failed');
    }
  } catch (err) {
    console.warn('Subscribe API not available:', err.message);
    // Still close modal — local save succeeded
    if (msgEl) {
      msgEl.className = 'message success';
      msgEl.textContent = 'Welcome! Alerts will activate once deployed.';
    }
    setTimeout(closeLoginModal, 1500);
  }
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeEventModal();
    closeLoginModal();
  }
}
