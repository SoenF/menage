const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(compression()); // Enable Gzip compression
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public', {
    maxAge: '1d', // Cache static assets for 1 day
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache'); // Don't cache HTML to ensure updates are seen
        }
    }
}));

// Data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// API Routes
app.use('/api', require('./routes/api'));

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Sweepy server running on http://localhost:${PORT}`);
});