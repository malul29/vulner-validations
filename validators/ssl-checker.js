const sslChecker = require('ssl-checker');

/**
 * Check SSL certificate status for a domain
 * @param {string} domain - Domain to check
 * @returns {Promise<Object>} SSL certificate information
 */
async function checkSSL(domain) {
  try {
    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    
    const result = await sslChecker(cleanDomain, {
      method: 'GET',
      port: 443,
      protocol: 'https:'
    });

    const daysRemaining = result.daysRemaining;
    let severity = 'ok';
    let status = 'Valid';

    if (daysRemaining < 0) {
      severity = 'critical';
      status = 'Expired';
    } else if (daysRemaining <= 7) {
      severity = 'critical';
      status = 'Expires Soon (Critical)';
    } else if (daysRemaining <= 30) {
      severity = 'warning';
      status = 'Expires Soon (Warning)';
    }

    return {
      success: true,
      domain: cleanDomain,
      valid: result.valid,
      daysRemaining: daysRemaining,
      validFrom: result.validFrom,
      validTo: result.validTo,
      issuer: result.issuer,
      severity: severity,
      status: status,
      message: `SSL certificate ${status.toLowerCase()} (${daysRemaining} days remaining)`
    };
  } catch (error) {
    return {
      success: false,
      domain: domain,
      error: error.message,
      severity: 'error',
      status: 'Error',
      message: `Failed to check SSL: ${error.message}`
    };
  }
}

module.exports = { checkSSL };
