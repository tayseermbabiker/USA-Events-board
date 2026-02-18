// Main App Initialization & Event Loading

async function initApp() {
  // Initialize login state
  const user = getLoggedInUser();
  updateAuthUI(user);

  // Initialize filters
  initializeFilters();

  // Load events from static JSON
  await loadEvents();
}

async function loadEvents() {
  try {
    showLoading();

    const response = await fetch('events.json');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.events) {
      setAllEvents(data.events);
      hideLoading();
    } else {
      throw new Error('Invalid API response');
    }

  } catch (error) {
    console.error('Failed to load events:', error);
    hideLoading();
    showError('Failed to load events. Please try again.');
  }
}

async function reloadEvents() {
  await loadEvents();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

window.initApp = initApp;
window.loadEvents = loadEvents;
window.reloadEvents = reloadEvents;
