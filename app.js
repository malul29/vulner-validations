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

  const checks = [];
  if (document.getElementById('checkSsl').checked) checks.push('ssl');
  if (document.getElementById('checkCookies').checked) checks.push('cookies');
  if (document.getElementById('checkHsts').checked) checks.push('hsts');
  if (document.getElementById('checkCsp').checked) checks.push('csp');

  if (checks.length === 0) {
      showNotification('Please select at least one check to perform', 'warning');
      state.isValidating = false;
      validateBtn.disabled = false;
      validateBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Validate';
      progressContainer.classList.remove('active');
      return;
  }

  try {
    let completed = 0;
    
    for (const domain of state.domains) {
      progressText.textContent = `Validating ${escapeHtml(domain)}... (${completed + 1}/${state.domains.length})`;
      
      try {
        const response = await fetch('/api/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ domains: [domain], checks })
        });

        const data = await response.json();

        if (data.success && data.results.length > 0) {
          const result = data.results[0];
          state.results.push(result);
          
          // Determine if the domain was successfully reached
          const isDown = 
            (result.ssl.skipped || !result.ssl.success) && 
            (result.cookies.skipped || !result.cookies.success) && 
            (!result.hsts || result.hsts.skipped || !result.hsts.success) &&
            (!result.csp || result.csp.skipped || !result.csp.success) &&
            (!result.ssl.skipped || !result.cookies.skipped || !result.hsts.skipped || !result.csp.skipped); // Make sure we didn't just skip everything
          
          if (isDown) {
            showNotification(`[Failed] Cannot access ${domain}`, 'error');
          } else {
            showNotification(`[Success] Validated ${domain}`, 'success');
          }
          
          renderResults();
        } else {
          throw new Error(data.error || `Validation failed for ${domain}`);
        }
      } catch (domainError) {
        console.error(`Error for ${domain}:`, domainError);
        showNotification(`[Error] Failed to process ${domain}`, 'error');
      }
      
      completed++;
      const percent = (completed / state.domains.length) * 100;
      progressFill.style.width = `${percent}%`;
    }
    
    setTimeout(() => {
      progressContainer.classList.remove('active');
    }, 1000);
    
  } catch (error) {
    console.error('Validation error:', error);
    showNotification(`Error: ${error.message}`, 'error');
    progressContainer.classList.remove('active');
  } finally {
    state.isValidating = false;
    validateBtn.disabled = false;
    validateBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Validate';
  }
}

// Render results
function renderResults() {
  if (state.results.length === 0) {
    resultsGrid.innerHTML = '<div class="empty-state">No results to display</div>';
    return;
  }

  resultsGrid.innerHTML = state.results.map(result => {
    // Check if the domain is completely unreachable
    const isDown = 
      (result.ssl.skipped || !result.ssl.success) && 
      (result.cookies.skipped || !result.cookies.success) && 
      (!result.hsts || result.hsts.skipped || !result.hsts.success) &&
      (!result.csp || result.csp.skipped || !result.csp.success) &&
      (!result.ssl.skipped || !result.cookies.skipped || (!result.hsts || !result.hsts.skipped) || (!result.csp || !result.csp.skipped));
    
    if (isDown) {
      const errorMsg = result.ssl.error || result.cookies.error || (result.hsts && result.hsts.error) || 'Failed to connect to the domain.';
      return `
    <div class="result-card collapsed" style="border-color: var(--accent-danger, #8b0000); box-shadow: 6px 6px 0px var(--accent-danger, #8b0000);">
      <div class="result-header" onclick="toggleDomain(this)" style="border-bottom-color: var(--accent-danger, #8b0000);">
        <div class="result-header-content">
          <div class="result-domain" style="color: var(--accent-danger, #8b0000);">
            <i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(result.domain)} 
            <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; background: var(--accent-danger, #8b0000); color: var(--bg-secondary, #ffffff); padding: 0.2rem 0.5rem; margin-left: 0.5rem; border: 2px solid var(--border-color, #1a1a1a);">Offline</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="result-timestamp">Checked: ${new Date(result.timestamp).toLocaleString()}</div>
          <span class="result-toggle" style="color: var(--accent-danger, #8b0000);"><i class="fa-solid fa-chevron-down"></i></span>
        </div>
      </div>
      <div class="result-body">
        <div class="check-section" style="padding: 1.5rem; color: var(--text-primary); background: var(--bg-secondary); border: 3px solid var(--accent-danger, #8b0000); border-radius: 0px; box-shadow: 4px 4px 0px var(--accent-danger, #8b0000); margin-top: 1rem; margin-bottom: 0.5rem;">
            <div style="font-weight: 800; text-transform: uppercase; font-size: 1.25rem; color: var(--accent-danger, #8b0000); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-ban"></i> Connection Failed
            </div>
            <div style="font-weight: 600; font-family: monospace; background: var(--bg-tertiary); padding: 0.75rem; border: 2px solid var(--border-color); margin-bottom: 1rem; word-break: break-all;">
                > ${escapeHtml(errorMsg)}
            </div>
            <p style="font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); border-top: 2px dashed var(--accent-danger, #8b0000); padding-top: 0.75rem;">
                The target domain might be offline, requires a DNS fix, or you are facing network connectivity issues.
            </p>
        </div>
      </div>
    </div>
      `;
    }

    return `
    <div class="result-card collapsed">
      <div class="result-header" onclick="toggleDomain(this)">
        <div class="result-header-content">
          <div class="result-domain">
            <i class="fa-solid fa-globe"></i> ${escapeHtml(result.domain)}
            <span style="font-size: 0.75rem; font-weight: 800; background: ${result.statusCode >= 200 && result.statusCode < 400 ? 'var(--accent-success, #006400)' : (result.statusCode >= 400 && result.statusCode < 500 ? 'var(--accent-warning, #b8860b)' : 'var(--accent-danger, #8b0000)')}; color: #fff; padding: 0.2rem 0.5rem; margin-left: 0.5rem; border: 2px solid var(--border-color); border-radius: 4px;">HTTP ${result.statusCode}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="result-timestamp">Checked: ${new Date(result.timestamp).toLocaleString()}</div>
          <span class="result-toggle"><i class="fa-solid fa-chevron-down"></i></span>
        </div>
      </div>
      <div class="result-body">
        ${result.ssl && !result.ssl.skipped ? renderSSLSection(result.ssl) : ''}
        ${result.cookies && !result.cookies.skipped ? renderCookieSection(result.cookies) : ''}
        ${result.hsts && !result.hsts.skipped ? renderHSTSSection(result.hsts) : ''}
        ${result.csp && !result.csp.skipped ? renderCSPSection(result.csp) : ''}
      </div>
    </div>
    `;
  }).join('');

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
          <i class="fa-solid fa-lock"></i> SSL Certificate
          <span class="status-badge ${severityClass}">${ssl.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle"><i class="fa-solid fa-chevron-down"></i></span>
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
          <i class="fa-solid fa-cookie-bite"></i> Cookie Security
          <span class="status-badge ${severityClass}">${cookies.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle"><i class="fa-solid fa-chevron-down"></i></span>
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
                  <div class="issue-cookie"><i class="fa-solid fa-circle-exclamation" style="color: #ef4444;"></i> ${escapeHtml(issue.name)}</div>
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
          <i class="fa-solid fa-shield-halved"></i> HSTS Policy
          <span class="status-badge ${severityClass}">${hsts.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle"><i class="fa-solid fa-chevron-down"></i></span>
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
                  <div class="issue-cookie"><i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> ${escapeHtml(issue)}</div>
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

// Render CSP section
function renderCSPSection(csp) {
  const severityClass = csp.severity || 'error';

  return `
    <div class="check-section collapsed">
      <div class="check-title" onclick="toggleSection(this)">
        <div class="check-title-content">
          <i class="fa-solid fa-shield-virus"></i> Content-Security-Policy
          <span class="status-badge ${severityClass}">${csp.status || 'Unknown'}</span>
        </div>
        <span class="check-toggle"><i class="fa-solid fa-chevron-down"></i></span>
      </div>
      <div class="check-details-wrapper">
        ${csp.success ? `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Enabled</span>
              <span class="detail-value">${csp.enabled ? 'Yes' : 'No'}</span>
            </div>
            ${csp.details && csp.details.raw ? `
              <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 0.5rem; text-align: left;">
                <span class="detail-label">Raw Policy</span>
                <span class="detail-value" style="display: block; text-align: left; background: var(--bg-primary); padding: 0.5rem; word-break: break-all; width: 100%; border: 1px solid var(--border-color-subtle); border-radius: var(--border-radius); margin-top: 0.5rem; font-size: 0.75rem;">${escapeHtml(csp.details.raw)}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Message</span>
              <span class="detail-value">${escapeHtml(csp.message)}</span>
            </div>
          </div>
          ${csp.details && csp.details.issues && csp.details.issues.length > 0 ? `
            <div class="issue-list">
              ${csp.details.issues.map(issue => `
                <div class="issue-item">
                  <div class="issue-cookie"><i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> ${escapeHtml(issue)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        ` : `
          <div class="check-details">
            <div class="detail-row">
              <span class="detail-label">Error</span>
              <span class="detail-value">${escapeHtml(csp.message || csp.error || 'Unknown error')}</span>
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
  // Use retro neo-brutalism styling consistently
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? 'var(--bg-secondary, #ffffff)' : type === 'warning' ? 'var(--bg-secondary, #ffffff)' : 'var(--bg-secondary, #ffffff)'};
    color: var(--text-primary, #1a1a1a);
    padding: 1rem 1.5rem;
    border: 3px solid var(--border-color, #1a1a1a);
    border-radius: 0px;
    box-shadow: 4px 4px 0px rgba(0, 0, 0, 1);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: slideInRight 0.3s ease;
  `;

  // Add icon based on type
  const icon = document.createElement('i');
  if (type === 'error') {
    icon.className = 'fa-solid fa-circle-xmark';
    icon.style.color = 'var(--accent-danger, #8b0000)';
    icon.style.fontSize = '1.25rem';
  } else if (type === 'warning') {
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.style.color = 'var(--accent-warning, #8b4513)';
    icon.style.fontSize = '1.25rem';
  } else {
    icon.className = 'fa-solid fa-circle-check';
    icon.style.color = 'var(--accent-success, #2d5016)';
    icon.style.fontSize = '1.25rem';
  }

  const textNode = document.createElement('span');
  textNode.textContent = message;

  notification.appendChild(icon);
  notification.appendChild(textNode);
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
