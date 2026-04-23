const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { checkSSL } = require('./validators/ssl-checker');
const { checkCookies } = require('./validators/cookie-checker');
const { checkHSTS } = require('./validators/hsts-checker');
const { checkCSP } = require('./validators/csp-checker');

const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for development
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Vulnerability Validator API is running',
        version: '1.2.0',
        validators: {
            ssl: 'enabled',
            cookies: 'enabled - case-insensitive detection',
            hsts: 'enabled - case-insensitive detection',
            csp: 'enabled - detecting weak directives'
        }
    });
});

// Check SSL certificate for a single domain
app.get('/api/check-ssl/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const result = await checkSSL(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check cookies for a single domain
app.get('/api/check-cookies/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const result = await checkCookies(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check HSTS for a single domain
app.get('/api/check-hsts/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const result = await checkHSTS(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check CSP for a single domain
app.get('/api/check-csp/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        const result = await checkCSP(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint to check raw response headers
app.get('/api/debug/:domain', async (req, res) => {
    try {
        const axios = require('axios');
        const https = require('https');
        const domain = req.params.domain;

        let url = domain;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            keepAlive: true,
            timeout: 10000
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

        res.json({
            domain: domain,
            status: response.status,
            headers: response.headers,
            environment: process.env.VERCEL ? 'Vercel' : 'Local',
            nodeVersion: process.version
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Validate multiple domains (batch processing)
app.post('/api/validate', async (req, res) => {
    try {
        const { domains, checks } = req.body;

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an array of domains'
            });
        }

        const runChecks = checks || ['ssl', 'cookies', 'hsts', 'csp'];
        const results = [];
        const https = require('https');

        for (const domain of domains) {
            const checksToRun = [];
            
            // Get HTTP Status Code
            let statusCode = 'Unknown';
            try {
                let url = domain.startsWith('http') ? domain : `https://${domain}`;
                const response = await axios.get(url, {
                    timeout: 5000,
                    validateStatus: () => true,
                    maxRedirects: 3,
                    httpsAgent: new https.Agent({ rejectUnauthorized: false })
                });
                statusCode = response.status;
            } catch (err) {
                statusCode = err.code || 'Error';
            }
            
            if (runChecks.includes('ssl')) {
                checksToRun.push(checkSSL(domain).then(res => ({ type: 'ssl', data: res })));
            }
            if (runChecks.includes('cookies')) {
                checksToRun.push(checkCookies(domain).then(res => ({ type: 'cookies', data: res })));
            }
            if (runChecks.includes('hsts')) {
                checksToRun.push(checkHSTS(domain).then(res => ({ type: 'hsts', data: res })));
            }
            if (runChecks.includes('csp')) {
                checksToRun.push(checkCSP(domain).then(res => ({ type: 'csp', data: res })));
            }

            const checkResults = await Promise.all(checksToRun);
            
            const domainResult = {
                domain: domain,
                statusCode: statusCode,
                timestamp: new Date().toISOString()
            };
            
            checkResults.forEach(res => {
                domainResult[res.type] = res.data;
            });
            
            if (!runChecks.includes('ssl')) domainResult.ssl = { success: null, skipped: true };
            if (!runChecks.includes('cookies')) domainResult.cookies = { success: null, skipped: true };
            if (!runChecks.includes('hsts')) domainResult.hsts = { success: null, skipped: true };
            if (!runChecks.includes('csp')) domainResult.csp = { success: null, skipped: true };

            results.push(domainResult);
        }

        res.json({
            success: true,
            count: results.length,
            results: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Acunetix Vulnerability Validator running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
});
