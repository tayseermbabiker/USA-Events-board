// Utility helper functions

function formatDate(dateString) {
  if (!dateString) return 'TBA';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFullDateTime(dateString) {
  if (!dateString) return 'TBA';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function getRandomGradient() {
  const gradients = [
    'linear-gradient(135deg, #0B1426 0%, #1E3A5F 100%)',
    'linear-gradient(135deg, #1C2333 0%, #2DD4BF 100%)',
    'linear-gradient(135deg, #2D3748 0%, #D4A853 100%)',
    'linear-gradient(135deg, #1E3A5F 0%, #1A9E8F 100%)',
    'linear-gradient(135deg, #0B1426 0%, #D4A853 100%)',
    'linear-gradient(135deg, #2D3748 0%, #5EEAD4 100%)',
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'block';
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}

function showEmptyState() {
  const el = document.getElementById('empty-state');
  if (el) el.style.display = 'block';
}

function hideEmptyState() {
  const el = document.getElementById('empty-state');
  if (el) el.style.display = 'none';
}

function showError(message) {
  const grid = document.getElementById('events-grid');
  if (grid) {
    grid.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--error);grid-column:1/-1;">
        <p>${message}</p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top:1rem;max-width:200px;">Try Again</button>
      </div>`;
  }
}

function getLoggedInUser() {
  const data = localStorage.getItem('user');
  return data ? JSON.parse(data) : null;
}

function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function getNext6Months() {
  const months = [];
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: `${names[d.getMonth()]} ${d.getFullYear()}`
    });
  }
  return months;
}

// Industry color map for badges
function getIndustryColor(industry) {
  const colors = {
    'Technology': '#1E3A5F',
    'AI': '#2DD4BF',
    'Startup': '#0D9488',
    'Finance': '#D4A853',
    'Marketing': '#B45309',
    'Healthcare': '#0E7490',
    'Legal': '#475569',
  };
  return colors[industry] || '#64748B';
}
