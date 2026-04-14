const axios = require('axios');
const https = require('https');

/**
 * Check cookie security for a domain
 * @param {string} domain - Domain to check
 * @returns {Promise<Object>} Cookie security information
 */
async function checkCookies(domain) {
    try {
        // Ensure domain has protocol
        let url = domain;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // Configure HTTPS agent for better compatibility with Vercel
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Allow self-signed certificates for testing
            keepAlive: true,
            timeout: 10000
        });

        const response = await axios.get(url, {
            maxRedirects: 5,
            timeout: 10000,
            validateStatus: () => true, // Accept any status code
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });

        // Get all Set-Cookie headers (case-insensitive)
        let cookieHeaders = [];

        // Check different variations of the header name
        const headerVariations = ['set-cookie', 'Set-Cookie', 'SET-COOKIE'];
        for (const variation of headerVariations) {
            if (response.headers[variation]) {
                const cookies = response.headers[variation];
                if (Array.isArray(cookies)) {
                    cookieHeaders = cookieHeaders.concat(cookies);
                } else {
                    cookieHeaders.push(cookies);
                }
            }
        }

        // Also check raw headers if available
        if (response.headers && typeof response.headers === 'object') {
            Object.keys(response.headers).forEach(key => {
                if (key.toLowerCase() === 'set-cookie') {
                    const value = response.headers[key];
                    if (Array.isArray(value)) {
                        cookieHeaders = cookieHeaders.concat(value);
                    } else if (typeof value === 'string' && !cookieHeaders.includes(value)) {
                        cookieHeaders.push(value);
                    }
                }
            });
        }

        // Remove duplicates
        cookieHeaders = [...new Set(cookieHeaders)];

        if (cookieHeaders.length === 0) {
            return {
                success: true,
                domain: domain,
                cookieCount: 0,
                issues: [],
                severity: 'ok',
                status: 'No Cookies Set',
                message: 'No cookies found on this domain'
            };
        }

        const issues = [];
        const cookies = [];

        cookieHeaders.forEach((cookieStr, index) => {
            const cookieParts = cookieStr.split(';').map(part => part.trim());
            const [nameValue] = cookieParts;
            const [name] = nameValue.split('=');

            // Check flags (case-insensitive)
            const hasSecure = cookieParts.some(part => part.toLowerCase() === 'secure');
            const hasHttpOnly = cookieParts.some(part => part.toLowerCase() === 'httponly');
            const hasSameSite = cookieParts.some(part => part.toLowerCase().startsWith('samesite'));

            const cookieIssues = [];

            if (!hasSecure) {
                cookieIssues.push('Missing Secure flag');
            }
            if (!hasHttpOnly) {
                cookieIssues.push('Missing HttpOnly flag');
            }
            if (!hasSameSite) {
                cookieIssues.push('Missing SameSite attribute');
            }

            if (cookieIssues.length > 0) {
                issues.push({
                    name: name || `Cookie ${index + 1}`,
                    issues: cookieIssues,
                    raw: cookieStr.substring(0, 100) + (cookieStr.length > 100 ? '...' : '')
                });
            }

            cookies.push({
                name: name || `Cookie ${index + 1}`,
                secure: hasSecure,
                httpOnly: hasHttpOnly,
                sameSite: hasSameSite
            });
        });

        let severity = 'ok';
        let status = 'All Cookies Secure';

        if (issues.length > 0) {
            severity = 'warning';
            status = 'Security Issues Found';

            // Check if critical issues (no secure flag on any cookie)
            const noSecureCookies = issues.filter(i => i.issues.includes('Missing Secure flag'));
            if (noSecureCookies.length === cookieHeaders.length) {
                severity = 'critical';
                status = 'Critical Security Issues';
            }
        }

        return {
            success: true,
            domain: domain,
            cookieCount: cookieHeaders.length,
            cookies: cookies,
            issues: issues,
            issueCount: issues.length,
            severity: severity,
            status: status,
            message: issues.length > 0
                ? `Found ${issues.length} cookie(s) with security issues out of ${cookieHeaders.length} total`
                : `All ${cookieHeaders.length} cookies are properly secured`
        };
    } catch (error) {
        return {
            success: false,
            domain: domain,
            error: error.message,
            severity: 'error',
            status: 'Error',
            message: `Failed to check cookies: ${error.message}`
        };
    }
}

module.exports = { checkCookies };
