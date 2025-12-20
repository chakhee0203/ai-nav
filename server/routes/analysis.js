const express = require('express');
const router = express.Router();
const { openai } = require('../config/ai');
const XLSX = require('xlsx');
const vm = require('vm');

// Data Analysis API
router.post('/', async (req, res) => {
  const { file, requirements, lang = 'en' } = req.body;

  if (!file) {
    return res.status(400).json({ error: 'Missing file content' });
  }

  if (!openai) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  try {
    // 1. Parse Excel/CSV
    let workbook;
    try {
      // Handle base64 string (remove prefix if present)
      const base64Data = file.includes('base64,') ? file.split('base64,')[1] : file;
      workbook = XLSX.read(base64Data, { type: 'base64' });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid file format. Please upload a valid Excel or CSV file.' });
    }

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(sheet);

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'The file appears to be empty.' });
    }

    // 2. Prepare Data Context for LLM (Schema + Preview)
    const totalRows = rawData.length;
    // Provide a small preview to understand the structure/values
    const previewData = rawData.slice(0, 5); 
    const columns = Object.keys(previewData[0] || {}).join(', ');

    // 3. Construct Prompt for Intent Analysis & Code Generation
    const systemPrompt = `
    You are an expert Data Analyst and JavaScript Developer.
    
    Your goal is to:
    1. Analyze the User's Intent based on their requirements and the data schema.
    2. Generate a JavaScript function body to process the FULL dataset and produce the analysis results.

    INPUT CONTEXT:
    - Total Rows: ${totalRows}
    - Columns: ${columns}
    - Data Preview: ${JSON.stringify(previewData)}
    - User Requirements: "${requirements || 'Analyze this data and show interesting trends.'}"
    - Output Language: ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}

    TASK:
    Write valid JavaScript code (ES6) to process the input variable \`data\` (array of objects).
    
    The code must return an object with this structure:
    {
      chartData: [ ... ], // Array of objects optimized for Recharts
      analysis: "...",    // A markdown string summarizing the findings (calculated from the data)
    }

    OUTPUT FORMAT (JSON ONLY):
    {
      "intent": "Brief description of the identified user intent",
      "code": "The JavaScript function body (string). Do NOT wrap in markdown.",
      "chartConfig": {
        "type": "bar" | "line" | "pie" | "area" | "scatter",
        "title": "Chart Title",
        "xAxisKey": "key_for_x_axis",
        "seriesKey": "key_for_series (string) or array of strings",
        "labelKey": "key_for_labels (pie chart only)"
      }
    }

    CODE CONSTRAINTS:
    - Use vanilla JavaScript (Math, Date, Array methods: map, filter, reduce, sort).
    - NO external libraries (no _, moment, etc.).
    - \`data\` is available in the scope.
    - Handle potential type conversion (e.g., \`Number(row['Sales'])\`).
    - The \`analysis\` string should explicitly state key statistics (sums, averages, max/min) calculated in the code.
    `;

    // 4. Call LLM to generate code
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze user intent and generate code." }
      ],
      model: "deepseek-chat", 
      temperature: 0.1, // Lower temperature for code generation
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse LLM response:', content);
      return res.status(500).json({ error: 'AI returned invalid JSON' });
    }

    // 5. Execute the Generated Code
    const { code, chartConfig, intent } = result;
    
    if (!code) {
      return res.status(500).json({ error: 'AI failed to generate analysis code' });
    }

    // Sandbox execution
    const sandbox = { 
      data: rawData, 
      result: null, 
      console: { log: () => {} } // Mute console
    };

    try {
      // Wrap code in a function and call it
      const script = new vm.Script(`
        (function() {
          try {
            ${code}
          } catch(e) {
            return { error: e.message };
          }
        })()
      `);
      
      const executionResult = script.runInNewContext(sandbox, { timeout: 2000 }); // 2s timeout
      
      if (!executionResult || executionResult.error) {
        throw new Error(executionResult ? executionResult.error : 'No result returned');
      }

      const { chartData, analysis } = executionResult;

      // 6. Return Response
      res.json({
        analysis: analysis || 'No analysis text generated.',
        intent: intent,
        chart: {
          ...chartConfig,
          data: chartData
        }
      });

    } catch (execError) {
      console.error('Code Execution Error:', execError);
      console.error('Generated Code:', code);
      return res.status(500).json({ 
        error: 'Analysis execution failed. The AI generated invalid code.',
        details: execError.message
      });
    }

  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze data' });
  }
});

module.exports = router;
