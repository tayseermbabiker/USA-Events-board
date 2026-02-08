// Main App - Conferix USA

// Mock data for local preview (used when API is not available)
const MOCK_EVENTS = [
  { id: '1', title: 'Austin Tech Summit 2026', description: 'The premier technology conference in Austin featuring keynotes from industry leaders.', start_date: '2026-03-15', end_date: '2026-03-16', venue_name: 'Austin Convention Center', city: 'Austin', organizer: 'Austin Tech Council', industry: 'Technology', is_free: false, registration_url: '#', source: 'Eventbrite', image_url: '' },
  { id: '2', title: 'SF AI & Machine Learning Meetup', description: 'Monthly meetup for AI practitioners and enthusiasts in the Bay Area.', start_date: '2026-02-20', venue_name: 'Galvanize SF', city: 'San Francisco', organizer: 'SF AI Group', industry: 'AI', is_free: true, registration_url: '#', source: 'Meetup', image_url: '' },
  { id: '3', title: 'NYC Startup Pitch Night', description: 'Pitch your startup to a panel of VCs and angel investors.', start_date: '2026-02-25', venue_name: 'WeWork Times Square', city: 'New York', organizer: 'NYC Founders Club', industry: 'Startup', is_free: true, registration_url: '#', source: 'Luma', image_url: '' },
  { id: '4', title: 'FinTech Innovation Forum', description: 'Exploring the future of financial technology and digital banking.', start_date: '2026-03-10', venue_name: 'Federal Reserve Bank of SF', city: 'San Francisco', organizer: 'FinTech Alliance', industry: 'Finance', is_free: false, registration_url: '#', source: 'Eventbrite', image_url: '' },
  { id: '5', title: 'Digital Marketing Masterclass', description: 'Learn cutting-edge digital marketing strategies from top practitioners.', start_date: '2026-03-05', venue_name: 'Google Austin', city: 'Austin', organizer: 'Marketing Pro Academy', industry: 'Marketing', is_free: false, registration_url: '#', source: 'Eventbrite', image_url: '' },
  { id: '6', title: 'American Neurology Summit 2026', description: 'Comprehensive CME conference covering latest advances in neurology.', start_date: '2026-04-20', end_date: '2026-04-22', venue_name: 'Hilton Midtown', city: 'New York', organizer: 'eMedEvents', industry: 'Healthcare', is_free: false, registration_url: '#', source: 'eMedEvents', image_url: '' },
  { id: '7', title: 'Pri-Med West CME Conference', description: 'Primary care CME/CE conference for physicians, NPs, and PAs.', start_date: '2026-04-09', end_date: '2026-04-11', venue_name: 'Anaheim Convention Center', city: 'Los Angeles', organizer: 'Pri-Med', industry: 'Healthcare', is_free: false, registration_url: '#', source: 'Pri-Med', image_url: '' },
  { id: '8', title: 'Legal Tech Innovation Summit', description: 'How AI is transforming the practice of law.', start_date: '2026-03-20', venue_name: 'Clio HQ', city: 'San Francisco', organizer: 'Clio', industry: 'Legal', is_free: true, registration_url: '#', source: 'Clio', image_url: '' },
  { id: '9', title: 'US Chamber Technology Leadership Summit', description: 'Business leaders discuss technology policy and innovation.', start_date: '2026-05-15', venue_name: 'US Chamber HQ', city: 'Washington DC', organizer: 'US Chamber of Commerce', industry: 'Technology', is_free: false, registration_url: '#', source: 'USChamber', image_url: '' },
  { id: '10', title: 'Internal Medicine CME Seminar', description: 'Board review and clinical updates for internal medicine physicians.', start_date: '2026-03-28', end_date: '2026-03-30', venue_name: 'Marriott Downtown', city: 'Austin', organizer: 'American Medical Seminars', industry: 'Healthcare', is_free: false, registration_url: '#', source: 'AMS', image_url: '' },
  { id: '11', title: 'AI Founders Breakfast', description: 'Networking breakfast for AI startup founders and investors.', start_date: '2026-02-18', venue_name: 'Capital Factory', city: 'Austin', organizer: 'Luma Austin AI', industry: 'AI', is_free: true, registration_url: '#', source: 'Luma', image_url: '' },
  { id: '12', title: 'Healthcare Data Analytics Conference', description: 'Leveraging data science for better patient outcomes.', start_date: '2026-04-05', venue_name: 'NYU Langone', city: 'New York', organizer: 'Health Data Institute', industry: 'Healthcare', is_free: false, registration_url: '#', source: 'Meetup', image_url: '' },
];

async function initApp() {
  // Init login state
  const user = getLoggedInUser();
  if (user) {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.textContent = 'Hi, ' + user.first_name;
  }

  // Login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn && !user) {
    loginBtn.addEventListener('click', openLoginModal);
  }

  // Initialize filters
  initializeFilters();

  // Load events
  await loadEvents();
}

async function loadEvents() {
  try {
    showLoading();

    const apiUrl = '/.netlify/functions/get-events';
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    if (data.success && data.events) {
      hideLoading();
      setAllEvents(data.events);
      return;
    }

    throw new Error('Invalid API response');

  } catch (error) {
    console.warn('API not available, loading mock data for preview:', error.message);
    hideLoading();
    setAllEvents(MOCK_EVENTS);
  }
}

// Newsletter form
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('newsletter-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = document.getElementById('newsletter-message');
      if (msg) {
        msg.className = 'newsletter-message success';
        msg.textContent = 'Thanks for subscribing! Check your inbox on Monday.';
        msg.style.display = 'block';
      }
      form.reset();
    });
  }
});

// Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
