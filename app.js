// State management
const state = {
  domains: [],
  results: [],
  isValidating: false
};

// DOM Elements
const domainInput = document.getElementById('domainInput');
const addDomainBtn = document.getElementById('addDomainBtn');
const domainList = document.getElementById('domainList');
const validateBtn = document.getElementById('validateBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultsGrid = document.getElementById('resultsGrid');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const totalDomainsEl = document.getElementById('totalDomains');
const totalScannedEl = document.getElementById('totalScanned');

// Update stats display
function updateStats() {
  if (totalDomainsEl) totalDomainsEl.textContent = state.domains.length;
  if (totalScannedEl) totalScannedEl.textContent = state.results.length;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  renderDomainList();
  updateStats();

  // Event listeners
  addDomainBtn.addEventListener('click', addDomain);
  validateBtn.addEventListener('click', validateDomains);
  clearBtn.addEventListener('click', clearDomains);
  exportJsonBtn.addEventListener('click', exportToJson);
});

// Add domain(s) - handles both single and multiple domains
function addDomain() {
  const inputText = domainInput.value.trim();

  if (!inputText) {
    showNotification('Please enter domain(s)', 'warning');
    return;
  }

  // Split by newlines and filter out empty lines
  const domains = inputText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (domains.length === 0) {
    showNotification('No valid domains found', 'warning');
    return;
  }

  let addedCount = 0;
  let duplicateCount = 0;

  domains.forEach(domain => {
    // Remove common prefixes/suffixes
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')  // Remove http:// or https://
      .replace(/\/$/, '')            // Remove trailing slash
      .split('/')[0];                // Take only domain part

    if (cleanDomain && !state.domains.includes(cleanDomain)) {
      state.domains.push(cleanDomain);
      addedCount++;
    } else if (cleanDomain) {
      duplicateCount++;
    }
  });

  if (addedCount > 0) {
    renderDomainList();
    saveToLocalStorage();
    domainInput.value = '';

    const message = addedCount === 1
      ? `Added 1 domain`
      : `Added ${addedCount} domain(s)${duplicateCount > 0 ? `, ${duplicateCount} duplicate(s) skipped` : ''}`;
    showNotification(message, 'success');
  } else {
    showNotification('All domains were duplicates or invalid', 'warning');
  }
}

// Remove domain from list
function removeDomain(domain) {
  state.domains = state.domains.filter(d => d !== domain);
  renderDomainList();
  saveToLocalStorage();
  updateStats();
}

// Render domain list
function renderDomainList() {
  if (state.domains.length === 0) {
    domainList.innerHTML = '<div class="empty-state">No domains added yet. Add domains to validate.</div>';
    validateBtn.disabled = true;
    clearBtn.disabled = true;
    return;
  }

  validateBtn.disabled = false;
  clearBtn.disabled = false;

  domainList.innerHTML = state.domains.map(domain => `
    <div class="domain-tag">
      <span>${escapeHtml(domain)}</span>
      <button class="remove-btn" onclick="removeDomain('${escapeHtml(domain)}')" title="Remove domain">×</button>
    </div>
  `).join('');
}

// Clear all domains
function clearDomains() {
  if (confirm('Are you sure you want to clear all domains?')) {
    state.domains = [];
    state.results = [];
    renderDomainList();
    resultsGrid.innerHTML = '<div class="empty-state">Run validation to see results here</div>';
    saveToLocalStorage();
    updateStats();
  }
}

// Validate domains
async function validateDomains() {
  if (state.isValidating) return;

  state.isValidating = true;
  state.results = [];
  resultsGrid.innerHTML = '';

  validateBtn.disabled = true;
  validateBtn.innerHTML = '<span class="spinner"></span> Validating...';

  progressContainer.classList.add('active');
  progressFill.style.width = '0%';

  try {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domains: state.domains })
    });

    const data = await response.json();

    if (data.success) {
      state.results = data.results;

      // Animate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 2;
        progressFill.style.width = `${Math.min(progress, 100)}%`;
        progressText.textContent = `Processing ${state.domains.length} domain(s)...`;

        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            progressContainer.classList.remove('active');
            renderResults();
          }, 500);
        }
      }, 20);
    } else {
      throw new Error(data.error || 'Validation failed');
    }
  } catch (error) {
    console.error('Validation error:', error);
    showNotification(`Error: ${error.message}`, 'error');
    progressContainer.classList.remove('active');
  } finally {
    state.isValidating = false;
    validateBtn.disabled = false;
    validateBtn.innerHTML = '🔍 Validate All Domains';
  }
}

// Render results
function renderResults() {
  if (state.results.length === 0) {
    resultsGrid.innerHTML = '<div class="empty-state">No results to display</div>';
    return;
  }

  resultsGrid.innerHTML = state.results.map(result => `
    <div class="result-card collapsed">
      <div class="result-header" onclick="toggleDomain(this)">
        <div class="result-header-content">
          <div class="result-domain">🌐 ${escapeHtml(result.domain)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="result-timestamp">Checked: ${new Date(result.timestamp).toLocaleString()}</div>
          <span class="result-toggle">▼</span>
        </div>
      </div>
      <div class="result-body">
        ${renderSSLSection(result.ssl)}
        ${renderCookieSection(result.cookies)}
        ${result.hsts ? renderHSTSSection(result.hsts) : ''}
      </div>
    </div>
  `).join('');

  exportJsonBtn.style.display = 'inline-flex';
  updateStats();
  initializeToggleListeners();
}

// Render SSL section
function renderSSLSection(ssl) {
  const severityClass = ssl.severity || 'error';

  return `
    <div class="check-section collapsed">
      <div class="check-title" onclick="toggleSection(this)">
        <div class="check-title-content">
          🔒 SSL Certificate
          <span class="status-badge ${severityClass}">${ssl.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle">▼</span>
      </div>
      <div class="check-details-wrapper">
        ${ssl.success ? `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Days Remaining</span>
              <span class="detail-value ${ssl.daysRemaining < 30 ? 'text-warning' : ''}">${ssl.daysRemaining} days</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Valid From</span>
              <span class="detail-value">${new Date(ssl.validFrom).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Valid To</span>
              <span class="detail-value">${new Date(ssl.validTo).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Issuer</span>
              <span class="detail-value">${escapeHtml(ssl.issuer || 'N/A')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Message</span>
              <span class="detail-value">${escapeHtml(ssl.message)}</span>
            </div>
          </div>
        ` : `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Error</span>
              <span class="detail-value">${escapeHtml(ssl.message || ssl.error || 'Unknown error')}</span>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

// Render Cookie section
function renderCookieSection(cookies) {
  const severityClass = cookies.severity || 'error';

  return `
    <div class="check-section collapsed">
      <div class="check-title" onclick="toggleSection(this)">
        <div class="check-title-content">
          🍪 Cookie Security
          <span class="status-badge ${severityClass}">${cookies.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle">▼</span>
      </div>
      <div class="check-details-wrapper">
        ${cookies.success ? `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Total Cookies</span>
              <span class="detail-value">${cookies.cookieCount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Issues Found</span>
              <span class="detail-value">${cookies.issueCount || 0}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Message</span>
              <span class="detail-value">${escapeHtml(cookies.message)}</span>
            </div>
          </div>
          ${cookies.issues && cookies.issues.length > 0 ? `
            <div class="issue-list">
              ${cookies.issues.map(issue => `
                <div class="issue-item">
                  <div class="issue-cookie">🔴 ${escapeHtml(issue.name)}</div>
                  <div class="issue-problems">
                    ${issue.issues.map(i => `<span>${escapeHtml(i)}</span>`).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Error</span>
              <span class="detail-value">${escapeHtml(cookies.message || cookies.error || 'Unknown error')}</span>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

// Render HSTS section
function renderHSTSSection(hsts) {
  const severityClass = hsts.severity || 'error';

  return `
    <div class="check-section collapsed">
      <div class="check-title" onclick="toggleSection(this)">
        <div class="check-title-content">
          🛡️ HSTS Policy
          <span class="status-badge ${severityClass}">${hsts.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle">▼</span>
      </div>
      <div class="check-details-wrapper">
        ${hsts.success ? `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Enabled</span>
              <span class="detail-value">${hsts.enabled ? 'Yes' : 'No'}</span>
            </div>
            ${hsts.details.maxAge !== null ? `
              <div class="detail-row">
                <span class="detail-label">Max Age</span>
                <span class="detail-value">${hsts.details.maxAgeDays} days</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Include Subdomains</span>
                <span class="detail-value">${hsts.details.includeSubDomains ? 'Yes' : 'No'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Preload</span>
                <span class="detail-value">${hsts.details.preload ? 'Yes' : 'No'}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Message</span>
              <span class="detail-value">${escapeHtml(hsts.message)}</span>
            </div>
          </div>
          ${hsts.details.issues && hsts.details.issues.length > 0 ? `
            <div class="issue-list">
              ${hsts.details.issues.map(issue => `
                <div class="issue-item">
                  <div class="issue-cookie">⚠️ ${escapeHtml(issue)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Error</span>
              <span class="detail-value">${escapeHtml(hsts.message || hsts.error || 'Unknown error')}</span>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

// Export to JSON
function exportToJson() {
  const dataStr = JSON.stringify(state.results, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vulnerability-scan-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showNotification('Results exported successfully!', 'success');
}

// Local storage
function saveToLocalStorage() {
  localStorage.setItem('acunetix_domains', JSON.stringify(state.domains));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem('acunetix_domains');
  if (saved) {
    try {
      state.domains = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }
}

// Notification system
function showNotification(message, type = 'info') {
  // Simple console log for now - could be enhanced with toast notifications
  console.log(`[${type.toUpperCase()}] ${message}`);

  // Optionally, you could create a toast notification element here
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: slideInRight 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Toggle section collapse/expand
function toggleSection(titleElement) {
  const section = titleElement.closest('.check-section');
  section.classList.toggle('collapsed');
}

// Toggle domain card collapse/expand
function toggleDomain(headerElement) {
  const card = headerElement.closest('.result-card');
  card.classList.toggle('collapsed');
}

// Initialize toggle listeners (called after rendering results)
function initializeToggleListeners() {
  // All toggle functionality is handled via onclick in HTML
  // This function exists for future enhancements if needed
}
