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

    const results = [];
    
    // Process sheets in parallel to save time
    const sheetPromises = workbook.SheetNames.map(async (sheetName) => {
      try {
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet);

        if (rawData.length === 0) {
          return null; // Skip empty sheets
        }

        // 2. Prepare Data Context for LLM (Schema + Preview)
        const totalRows = rawData.length;
        const previewData = rawData.slice(0, 5); 
        const columns = Object.keys(previewData[0] || {}).join(', ');

        // 3. Construct Prompt
        const systemPrompt = `
        You are an expert Data Analyst and JavaScript Developer.
        
        Your task is to analyze the dataset provided in the context of the user's general requirements.
        Since the user uploaded a file with multiple sheets, this specific request is for the sheet named "${sheetName}".
        
        Your goal is to:
        1. Analyze the specific data schema and content of THIS sheet ("${sheetName}").
        2. Determine the most relevant analysis intent for THIS specific sheet, considering the user's high-level requirements: "${requirements || 'Analyze this data and show interesting trends.'}".
        3. Generate a JavaScript function body to process the FULL dataset of this sheet and produce the analysis results.

        INPUT CONTEXT:
        - Sheet Name: ${sheetName}
        - Total Rows: ${totalRows}
        - Columns: ${columns}
        - Data Preview: ${JSON.stringify(previewData)}
        - User Requirements: "${requirements || 'Analyze this data and show interesting trends.'}"
        - Output Language: ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}

        TASK:
        Write valid JavaScript code (ES6) to process the input variable \`data\` (array of objects).
        
        CRITICAL: The code MUST end with a \`return\` statement that returns the result object.
        Example:
        \`\`\`javascript
        // ... calculations ...
        return {
          chartData: [ ... ],
          analysis: "..."
        };
        \`\`\`
        
        The code must return an object with this structure:
        {
          chartData: [ ... ], // Array of objects optimized for Recharts
          analysis: "...",    // A markdown string summarizing the findings
        }

        OUTPUT FORMAT (JSON ONLY):
        {
          "intent": "Brief description of the specific analysis intent for this sheet",
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
        - NO external libraries.
        - \`data\` is available in the scope.
        - Handle potential type conversion.
        `;

        // 4. Call LLM
        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Analyze user intent and generate code." }
          ],
          model: "deepseek-chat", 
          temperature: 0.1, 
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        let result;
        try {
          result = JSON.parse(content);
        } catch (e) {
          console.error(`Failed to parse LLM response for sheet ${sheetName}`);
          return { sheetName, error: 'AI response parsing failed' };
        }

        // 5. Execute Code
        const { code, chartConfig, intent } = result;
        
        if (!code) {
           return { sheetName, error: 'AI failed to generate code' };
        }

        const sandbox = { 
          data: rawData, 
          result: null, 
          console: { log: () => {} } 
        };

        const script = new vm.Script(`
          (function() {
            try {
              ${code}
            } catch(e) {
              return { error: e.message, stack: e.stack };
            }
          })()
        `);
        
        const executionResult = script.runInNewContext(sandbox, { timeout: 5000 });
        
        if (!executionResult || executionResult.error) {
           console.error(`Execution failed for sheet ${sheetName}. Error: ${executionResult?.error}`);
           if (executionResult?.stack) console.error(executionResult.stack);
           console.error('Generated Code:', code);
           return { sheetName, error: executionResult?.error || 'Execution failed (No result returned from AI code)' };
        }

        const { chartData, analysis } = executionResult;

        return {
          sheetName,
          analysis: analysis || 'No analysis text generated.',
          intent: intent,
          chart: {
            ...chartConfig,
            data: chartData
          }
        };

      } catch (err) {
        console.error(`Error processing sheet ${sheetName}:`, err);
        return { sheetName, error: err.message || 'Processing failed' };
      }
    });

    const resultsArray = await Promise.all(sheetPromises);
    
    // Filter out nulls (skipped sheets) and keep errors to show user
    const validResults = resultsArray.filter(r => r !== null);

    if (validResults.length === 0) {
      return res.status(500).json({ error: 'Failed to analyze any sheets.' });
    }

    // 6. Return Response
    res.json({ results: validResults });

  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze data' });
  }
});

module.exports = router;
