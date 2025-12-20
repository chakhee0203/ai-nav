const express = require('express');
const router = express.Router();
const { openai, zhipuClient } = require('../config/ai');

// DeepSeek Prompt Generation API
router.post('/generate-prompt', async (req, res) => {
  const { input, type = 'general' } = req.body;

  if (!input) {
    return res.status(400).json({ error: 'Missing input' });
  }

  if (!openai) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  try {
    const systemPrompt = `
    You are an expert Prompt Engineer. Your goal is to rewrite the user's raw idea into a high-quality, professional prompt optimized for Large Language Models (LLMs) or AI Image Generators depending on the context.
    
    Context: ${type === 'image' ? 'Midjourney/Stable Diffusion Image Generation' : 'ChatGPT/Claude General Task'}

    If Context is Image Generation:
    - Focus on visual descriptors, lighting, style, composition, and artists.
    - Format: "Subject, details, style, lighting, aspect ratio parameters".
    - English output is preferred for image generators.

    If Context is General Task:
    - Use the CO-STAR framework (Context, Objective, Style, Tone, Audience, Response).
    - Be clear, specific, and structured.
    - If the input is Chinese, output optimized Chinese. If English, output English.

    Input: "${input}"

    Return ONLY the optimized prompt text, no explanations.
    `;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input }
      ],
      model: "deepseek-chat",
      temperature: 0.7,
    });

    const optimizedPrompt = completion.choices[0].message.content;
    res.json({ result: optimizedPrompt });

  } catch (error) {
    console.error('Prompt Generation Error:', error);
    // Return detailed error message if available
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate prompt';
    res.status(500).json({ error: errorMessage });
  }
});

// Zhipu OCR & Translation API
router.post('/ocr-translate', async (req, res) => {
  const { image, targetLang = 'English' } = req.body; // image is base64 string

  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  if (!zhipuClient) {
    return res.status(503).json({ error: 'Vision AI service not configured (Missing ZHIPU_API_KEY)' });
  }

  // Map simple language names to more specific instructions
  let langInstruction = targetLang;
  if (targetLang === 'Chinese') {
    langInstruction = 'Simplified Chinese (简体中文)';
  } else if (targetLang === 'Japanese') {
    langInstruction = 'Japanese (日本語)';
  }

  console.log(`[OCR] Target Lang: ${targetLang}, Instruction: ${langInstruction}`);

  try {
    const systemPrompt = `
    You are a professional translator and OCR expert.
    
    TASK:
    1. OCR: Identify ALL text in the provided image.
    2. TRANSLATION: Translate the identified text into ${langInstruction}.
    
    CONSTRAINTS:
    - Target Language: ${langInstruction}
    - If the target language is Chinese, the result MUST be in Chinese.
    - If the target language is Japanese, the result MUST be in Japanese.
    - Do NOT provide the translation in English unless the target language is explicitly English.
    
    OUTPUT FORMAT (Strictly follow this):
    [[ORIGINAL_TEXT_START]]
    {Original text}
    [[ORIGINAL_TEXT_END]]
    
    [[TRANSLATED_TEXT_START]]
    {Translated text in ${langInstruction}}
    [[TRANSLATED_TEXT_END]]
    `;

    const response = await zhipuClient.chat.completions.create({
      model: "glm-4v",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image_url",
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      max_tokens: 2048,
      temperature: 0.1
    });

    const content = response.choices[0].message.content;
    console.log('Zhipu Raw Response:', content);
    
    let result = {
      originalText: "",
      translatedText: ""
    };

    try {
      // Extract content using delimiters
      const originalMatch = content.match(/\[\[ORIGINAL_TEXT_START\]\]([\s\S]*?)\[\[ORIGINAL_TEXT_END\]\]/);
      const translatedMatch = content.match(/\[\[TRANSLATED_TEXT_START\]\]([\s\S]*?)\[\[TRANSLATED_TEXT_END\]\]/);

      if (originalMatch) {
        result.originalText = originalMatch[1].trim();
      }
      if (translatedMatch) {
        result.translatedText = translatedMatch[1].trim();
      }

      // If extraction failed completely, return raw content
      if (!result.originalText && !result.translatedText) {
         // Try legacy JSON parsing just in case the model ignored instructions (unlikely with this prompt)
         try {
            const jsonRes = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
            result.originalText = jsonRes.originalText || content;
            result.translatedText = jsonRes.translatedText || "";
         } catch(e) {
            result.originalText = "Raw output (Parsing failed): " + content;
         }
      }

    } catch (e) {
      console.error('Parsing Error:', e);
      result.originalText = "Error parsing output: " + content;
    }

    res.json(result);

  } catch (error) {
    console.error('OCR/Translate Error:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to process image';
    res.status(500).json({ error: errorMessage });
  }
});

module.exports = router;
