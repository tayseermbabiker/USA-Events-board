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
    'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
    'linear-gradient(135deg, #1E2A38 0%, #0EA5E9 100%)',
    'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
    'linear-gradient(135deg, #059669 0%, #0EA5E9 100%)',
    'linear-gradient(135deg, #D97706 0%, #DC2626 100%)',
    'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
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
    'Technology': '#3B82F6',
    'AI': '#8B5CF6',
    'Startup': '#10B981',
    'Finance': '#059669',
    'Marketing': '#F59E0B',
    'Healthcare': '#EF4444',
    'Legal': '#6366F1',
    'General': '#64748B',
  };
  return colors[industry] || '#64748B';
}
