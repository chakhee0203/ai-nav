const express = require('express');
const cors = require('cors');
const requestIp = require('request-ip');
const fs = require('fs');
const path = require('path');

// Try to load .env from server directory first, then root
const serverEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '../.env');

if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
  console.log('Loaded .env from server directory');
} else if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
  console.log('Loaded .env from root directory');
} else {
  require('dotenv').config(); // Fallback to default
  console.log('Loaded .env from default location');
}

const navRoutes = require('./routes/nav');
const toolRoutes = require('./routes/tools');
const pdfRoutes = require('./routes/pdf');
const excelRoutes = require('./routes/excel');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 3001;
const LOGO_DIR = process.env.VERCEL ? '/tmp/logos' : path.join(__dirname, 'public/logos');

// Ensure directories exist
if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

// 使用 request-ip 中间件
app.use(requestIp.mw());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/logos', express.static(LOGO_DIR));

// 挂载路由
app.use('/api/nav', navRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/analysis', analysisRoutes);

// Serve static files from the React client
// Strategy: Find where index.html is located
const localPublicPath = path.join(__dirname, 'public');
const rootPublicPath = path.join(__dirname, '../public');
const clientDistPath = path.join(__dirname, '../client/dist');

let staticDir = null;

if (fs.existsSync(path.join(localPublicPath, 'index.html'))) {
  console.log('Found React app in ./public (Docker/Merged)');
  staticDir = localPublicPath;
} else if (fs.existsSync(path.join(rootPublicPath, 'index.html'))) {
  console.log('Found React app in ../public (Vercel/Local)');
  staticDir = rootPublicPath;
} else if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  console.log('Found React app in ../client/dist (Legacy)');
  staticDir = clientDistPath;
}

if (staticDir) {
  app.use(express.static(staticDir));
  app.get('*', (req, res) => {
    // Exclude API routes and logos from wildcard match (handled by express router order, but good to be safe)
    if (req.path.startsWith('/api') || req.path.startsWith('/logos')) {
      return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
} else {
  console.log('Warning: No React app build found. API only mode.');
}

// Export for Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true'; // Vercel sets this to '1'

if (!isVercel) {
  const host = '0.0.0.0';
  console.log('Starting server...');
  try {
    const server = app.listen(PORT, host, () => {
      console.log(`Server is running on http://${host}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Static Directory: ${staticDir || 'None'}`);
    });

    server.on('error', (e) => {
      console.error('Server startup error:', e);
      process.exit(1);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

module.exports = app;
