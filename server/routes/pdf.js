const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper to check API Key
const checkApiKey = (req, res, next) => {
  const apiKey = process.env.PDF_CO_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'PDF.co API Key not configured (Missing PDF_CO_API_KEY)' });
  }
  next();
};

// Helper to upload base64 file to PDF.co temp storage
async function uploadBase64(base64File) {
  const apiKey = process.env.PDF_CO_API_KEY;
  try {
    const response = await axios.post(
      'https://api.pdf.co/v1/file/upload/base64',
      { file: base64File },
      { headers: { 'x-api-key': apiKey } }
    );
    return response.data.url;
  } catch (error) {
    console.error('PDF.co Upload Error:', error.response?.data || error.message);
    throw new Error('Failed to upload file to PDF.co');
  }
}

// Convert PDF to Text
router.post('/convert/text', checkApiKey, async (req, res) => {
  const apiKey = process.env.PDF_CO_API_KEY;
  const { url, file, inline = true } = req.body;

  try {
    let fileUrl = url;
    if (file) {
      fileUrl = await uploadBase64(file);
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Missing file URL or base64 file' });
    }

    const response = await axios.post(
      'https://api.pdf.co/v1/pdf/convert/to/text',
      {
        url: fileUrl,
        inline: inline,
        async: false
      },
      { headers: { 'x-api-key': apiKey } }
    );

    if (response.data.error) {
      throw new Error(response.data.message);
    }

    res.json({ result: response.data.body || response.data.url });

  } catch (error) {
    console.error('PDF to Text Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Merge PDFs
router.post('/merge', checkApiKey, async (req, res) => {
  const apiKey = process.env.PDF_CO_API_KEY;
  const { urls, files } = req.body; // files is array of base64 strings

  try {
    let fileUrls = urls || [];
    
    if (files && Array.isArray(files)) {
      const uploadPromises = files.map(file => uploadBase64(file));
      const uploadedUrls = await Promise.all(uploadPromises);
      fileUrls = [...fileUrls, ...uploadedUrls];
    }

    if (fileUrls.length < 2) {
      return res.status(400).json({ error: 'At least two files are required for merging' });
    }

    const response = await axios.post(
      'https://api.pdf.co/v1/pdf/merge',
      {
        url: fileUrls.join(','),
        async: false
      },
      { headers: { 'x-api-key': apiKey } }
    );

    if (response.data.error) {
      throw new Error(response.data.message);
    }

    res.json({ result: response.data.url });

  } catch (error) {
    console.error('PDF Merge Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Split PDF
router.post('/split', checkApiKey, async (req, res) => {
  const apiKey = process.env.PDF_CO_API_KEY;
  const { url, file, pages } = req.body;

  try {
    let fileUrl = url;
    if (file) {
      fileUrl = await uploadBase64(file);
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Missing file URL or base64 file' });
    }

    if (!pages) {
      return res.status(400).json({ error: 'Missing pages parameter (e.g. "1-2,5")' });
    }

    const response = await axios.post(
      'https://api.pdf.co/v1/pdf/split',
      {
        url: fileUrl,
        pages: pages,
        async: false
      },
      { headers: { 'x-api-key': apiKey } }
    );

    if (response.data.error) {
      throw new Error(response.data.message);
    }

    // PDF.co split returns a list of URLs
    res.json({ result: response.data.urls || response.data.url });

  } catch (error) {
    console.error('PDF Split Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

module.exports = router;
