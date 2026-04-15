const axios = require('axios');
const https = require('https');

async function checkCSP(domain) {
    try {
        let url = domain;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            keepAlive: true
        });

        const response = await axios.get(url, {
            maxRedirects: 5,
            timeout: 10000,
            validateStatus: () => true,
            httpsAgent: httpsAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const headers = response.headers;
        const cspHeader = headers['content-security-policy'] || headers['x-content-security-policy'] || headers['x-webkit-csp'];

        if (!cspHeader) {
            return {
                success: true,
                enabled: false,
                severity: 'critical',
                status: 'Missing',
                message: 'Content-Security-Policy header is missing. The site may be vulnerable to XSS attacks.',
                details: {
                    raw: null,
                    directives: {},
                    issues: ["No CSP header found"]
                }
            };
        }

        // Basic parsing of directives
        const directives = {};
        const policyParts = cspHeader.split(';').map(part => part.trim()).filter(part => part);
        
        policyParts.forEach(part => {
            const [directive, ...values] = part.split(/\s+/);
            if (directive) {
                directives[directive] = values.join(' ');
            }
        });

        let severity = 'ok';
        let status = 'Secure';
        const issues = [];

        // Simple security evaluation of CSP
        if (directives['default-src'] && directives['default-src'].includes("*")) {
            severity = 'warning';
            status = 'Weak';
            issues.push("default-src allows '*'. This is overly permissive.");
        }
        if (directives['script-src'] && directives['script-src'].includes("'unsafe-inline'")) {
            severity = 'warning';
            status = 'Weak';
            issues.push("script-src allows 'unsafe-inline'. This enables XSS execution.");
        }
        if (directives['script-src'] && directives['script-src'].includes("'unsafe-eval'")) {
            severity = 'warning';
            status = 'Weak';
            issues.push("script-src allows 'unsafe-eval'. This can lead to code injection.");
        }

        return {
            success: true,
            enabled: true,
            severity: severity,
            status: status,
            message: issues.length > 0 ? 'CSP is enabled but has weak directives.' : 'CSP is properly configured.',
            details: {
                raw: cspHeader,
                directives: directives,
                issues: issues
            }
        };

    } catch (error) {
        return {
            success: false,
            enabled: false,
            severity: 'error',
            status: 'Error',
            message: `Failed to check CSP: ${error.message}`,
            error: error.message
        };
    }
}

module.exports = { checkCSP };
