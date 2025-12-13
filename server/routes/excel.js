const express = require('express');
const router = express.Router();
const axios = require('axios');
const XLSX = require('xlsx');

// Helper to check API Key (duplicated from pdf.js to keep modules independent)
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

// PDF to Excel (XLSX)
router.post('/pdf-to-excel', checkApiKey, async (req, res) => {
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

    const response = await axios.post(
      'https://api.pdf.co/v1/pdf/convert/to/xlsx',
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

    res.json({ result: response.data.url });

  } catch (error) {
    console.error('PDF to Excel Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Excel to PDF
router.post('/to-pdf', checkApiKey, async (req, res) => {
  const apiKey = process.env.PDF_CO_API_KEY;
  const { url, file } = req.body;

  try {
    let fileUrl = url;
    if (file) {
      fileUrl = await uploadBase64(file);
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Missing file URL or base64 file' });
    }

    const response = await axios.post(
      'https://api.pdf.co/v1/xls/convert/to/pdf',
      {
        url: fileUrl,
        async: false
      },
      { headers: { 'x-api-key': apiKey } }
    );

    if (response.data.error) {
      throw new Error(response.data.message);
    }

    res.json({ result: response.data.url });

  } catch (error) {
    console.error('Excel to PDF Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// Excel to JSON
router.post('/to-json', checkApiKey, async (req, res) => {
  const apiKey = process.env.PDF_CO_API_KEY;
  const { url, file } = req.body;

  try {
    let fileUrl = url;
    if (file) {
      fileUrl = await uploadBase64(file);
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Missing file URL or base64 file' });
    }

    const response = await axios.post(
      'https://api.pdf.co/v1/xls/convert/to/json',
      {
        url: fileUrl,
        async: false
      },
      { headers: { 'x-api-key': apiKey } }
    );

    if (response.data.error) {
      throw new Error(response.data.message);
    }

    // JSON endpoint usually returns the JSON body directly or a URL to JSON file
    // We'll return the URL if provided, or the body if it's inline (though PDF.co usually returns URL for large files)
    res.json({ result: response.data.url || response.data.body });

  } catch (error) {
    console.error('Excel to JSON Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

// JSON to Excel (Local)
router.post('/json-to-excel', async (req, res) => {
  const { file } = req.body;

  try {
    if (!file) {
      return res.status(400).json({ error: 'Missing file content' });
    }

    let jsonContent;
    // Remove Data URI prefix if present
    const base64Data = file.includes('base64,') ? file.split('base64,')[1] : file;
    
    try {
      const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
      jsonContent = JSON.parse(jsonStr);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON file' });
    }

    if (!Array.isArray(jsonContent)) {
       // If it's a single object, wrap in array
       jsonContent = [jsonContent];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jsonContent);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Write to base64 string
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    
    // Construct Data URI
    const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;

    res.json({ result: dataUri });

  } catch (error) {
    console.error('JSON to Excel Error:', error);
    res.status(500).json({ error: 'Failed to convert JSON to Excel: ' + error.message });
  }
});

module.exports = router;
