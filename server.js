const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { checkSSL } = require('./validators/ssl-checker');
const { checkCookies } = require('./validators/cookie-checker');
const { checkHSTS } = require('./validators/hsts-checker');

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
        version: '1.1.0',
        validators: {
            ssl: 'enabled',
            cookies: 'enabled - case-insensitive detection',
            hsts: 'enabled - case-insensitive detection'
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
        const { domains } = req.body;

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an array of domains'
            });
        }

        const results = [];

        for (const domain of domains) {
            const [sslResult, cookieResult, hstsResult] = await Promise.all([
                checkSSL(domain),
                checkCookies(domain),
                checkHSTS(domain)
            ]);

            results.push({
                domain: domain,
                ssl: sslResult,
                cookies: cookieResult,
                hsts: hstsResult,
                timestamp: new Date().toISOString()
            });
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
