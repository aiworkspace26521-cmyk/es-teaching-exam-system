import type { Context, Config } from "@netlify/functions";

async function callGemini(apiKey: string, prompt: string, retries = 4, delayMs = 2000): Promise<any> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        })
      });

      if (response.status === 429) {
        const errorText = await response.text();
        let retryAfterMs = delayMs;
        try {
          const errJson = JSON.parse(errorText);
          const retryInfo = errJson.error?.details?.find((d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo");
          if (retryInfo && retryInfo.retryDelay) {
            const match = retryInfo.retryDelay.match(/^(\d+)s$/);
            if (match) {
              retryAfterMs = (parseInt(match[1]) + 1) * 1000;
            }
          }
        } catch (parseErr) {
          // Fall back to default exponential delay if parsing fails
        }

        // If Google requires us to wait more than 2.5 seconds, throw immediately to prevent Netlify 10s timeout
        if (retryAfterMs > 2500) {
          throw new Error(`Gemini API 頻率限制 (429)。請稍候再試。Google 要求等待時間：${Math.ceil(retryAfterMs / 1000)} 秒。`);
        }

        console.warn(`[callGemini] Rate limited (429). Retrying in ${retryAfterMs}ms... (Attempt ${i + 1}/${retries}). Details: ${errorText}`);
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        delayMs *= 2; // Exponential backoff
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from Gemini");
      }

      return JSON.parse(text.trim());
    } catch (error: any) {
      if (i === retries - 1 || error.message.includes("頻率限制")) throw error;
      console.warn(`[callGemini] Error encountered: ${error.message}. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  throw new Error("Failed to call Gemini after multiple retries due to rate limits or other issues");
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-gemini-api-key",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-gemini-api-key"
      }
    });
  }

  try {
    const body = await req.json();
    const { subject: rawSubject, grade, semester, publisher, scope, customPrompt } = body;

    // Normalize subject to Chinese term robustly
    let subject = rawSubject;
    if (rawSubject === "math" || rawSubject === "數學") subject = "數學";
    else if (rawSubject === "chinese" || rawSubject === "國語") subject = "國語";
    else if (rawSubject === "english" || rawSubject === "英語") subject = "英語";
    else if (rawSubject === "science" || rawSubject === "自然") subject = "自然";
    else if (rawSubject === "social" || rawSubject === "社會") subject = "社會";

    const apiKey = req.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing Gemini API Key. Please provide it." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const randomSeed = Math.random().toString(36).substring(2, 10);
    const commonHeader = `你是一位臺灣國小 ${grade} ${subject} 科目的專業資深命題教師。
請為學生出一份符合「臺灣教育部國小課綱」與下述設定的 ${publisher} 版 模擬段考試卷題目。

考卷設定：
- 年級：${grade}
- 學期：第 ${semester} 學期
- 科目：${subject}
- 版本：${publisher}
- 範圍：${scope}
- 隨機種子 (隨機因子)：${randomSeed}

⚠️隨機性與多樣性要求（每次測驗務必產生新考題）：
- 請務必結合隨機種子進行命題。
- 為了確保「每次測驗都能產生新的考題」，請務必隨機替換題目情境中的主角姓名（如小明、小華、小娟、Neil、Emma等，以及本土化的故事主角）、日常情境設定（如不同的購物場景、不同的量測或實驗器材）與具體數值（如長度、重量、價格、百分率等）。
- 嚴格禁止直接重複產出常見的範例庫題目。即使是相同的範圍與科目，也要確保每題的故事背景與數據都是重新構思生成的。

⚠️重要且關鍵（攸關網路連線是否逾時）：
- ⚠️為避免連線逾時，所有的題目文字、選項文字、解析文字都必須極度精簡！
- ⚠️解析（solution）欄位：請嚴格限制在 1 句話（20 字）以內，只寫出關鍵概念或核心公式，絕對不可囉唆！
- 所有的題目、解析及選項文字，都必須是繁體中文 (Traditional Chinese)。
- 請嚴格確保回傳合法的 JSON 字串，不可包含 markdown \`\`\`json 標籤或任何引言，只需輸出純 JSON 字串。
- 若有其他自訂要求，請遵循：${customPrompt || "無"}
`;

    // Decide question counts for each part
    let mcCount = 10;
    let blankCount = 6;
    let openCount = 4;

    if (subject === "數學") {
      mcCount = 8; blankCount = 6; openCount = 4;
    } else if (subject === "國語") {
      mcCount = 10; blankCount = 6; openCount = 4;
    } else if (subject === "英語") {
      mcCount = 15; blankCount = 5; openCount = 5;
    } else if (subject === "自然") {
      mcCount = 10; blankCount = 6; openCount = 4;
    } else if (subject === "社會") {
      mcCount = 10; blankCount = 6; openCount = 4;
    }

    // Split MC and Open into two parts to speed up generation and prevent timeouts
    const mc1Count = Math.floor(mcCount / 2);
    const mc2Count = mcCount - mc1Count;
    
    const open1Count = Math.floor(openCount / 2);
    const open2Count = openCount - open1Count;

    // Build the 5 parallel prompts
    const mcPrompt1 = commonHeader + getMcPromptDetails(subject, mc1Count);
    const mcPrompt2 = commonHeader + getMcPromptDetails(subject, mc2Count);
    const blankPrompt = commonHeader + getBlankPromptDetails(subject, blankCount);
    const openPrompt1 = commonHeader + getOpenPromptDetails(subject, open1Count);
    const openPrompt2 = commonHeader + getOpenPromptDetails(subject, open2Count);

    console.log(`[generate-exam] Generating subject: ${subject}, grade: ${grade}, scope: ${scope}`);
    console.log(`[generate-exam] Parallel split counts - MC: ${mc1Count}+${mc2Count}, Blank: ${blankCount}, Open: ${open1Count}+${open2Count}`);
    const startTime = Date.now();

    // Stagger the parallel requests to avoid concurrent rate-limiting (429) on Google's side
    let isCancelled = false;
    const callWithDelay = async (prompt: string, delay: number) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      if (isCancelled) {
        throw new Error("Request cancelled due to previous failure");
      }
      try {
        return await callGemini(apiKey, prompt);
      } catch (err) {
        isCancelled = true;
        throw err;
      }
    };

    // Call Gemini API in parallel with a staggered start (5 smaller requests to stay under 10s timeout)
    const [mc1Data, mc2Data, blankData, open1Data, open2Data] = await Promise.all([
      callWithDelay(mcPrompt1, 0),
      callWithDelay(mcPrompt2, 600),
      callWithDelay(blankPrompt, 1200),
      callWithDelay(openPrompt1, 1800),
      callWithDelay(openPrompt2, 2400)
    ]);

    console.log(`[generate-exam] Parallel generation completed in ${Date.now() - startTime}ms`);

    const questions: any[] = [];
    let currentId = 1;

    // Combine MC Part 1 questions
    if (mc1Data && Array.isArray(mc1Data.questions)) {
      mc1Data.questions.forEach((q: any) => {
        q.id = currentId++;
        questions.push(q);
      });
    }

    // Combine MC Part 2 questions
    if (mc2Data && Array.isArray(mc2Data.questions)) {
      mc2Data.questions.forEach((q: any) => {
        q.id = currentId++;
        questions.push(q);
      });
    }

    // Combine Blank questions
    if (blankData && Array.isArray(blankData.questions)) {
      blankData.questions.forEach((q: any) => {
        q.id = currentId++;
        questions.push(q);
      });
    }

    // Combine Open Part 1 questions
    if (open1Data && Array.isArray(open1Data.questions)) {
      open1Data.questions.forEach((q: any) => {
        q.id = currentId++;
        questions.push(q);
      });
    }

    // Combine Open Part 2 questions
    if (open2Data && Array.isArray(open2Data.questions)) {
      open2Data.questions.forEach((q: any) => {
        q.id = currentId++;
        questions.push(q);
      });
    }

    const parsedExam = {
      school_year: "114",
      semester,
      exam_number: "1",
      grade,
      subject,
      scope: `${publisher}版第 ${semester} 學期 - ${scope}`,
      total_time: 40,
      total_points: 100,
      questions
    };

    return new Response(JSON.stringify(parsedExam), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });

  } catch (error: any) {
    console.error("[generate-exam] Error in serverless function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};

// --- Prompt details helpers for different subjects and types ---

function getMcPromptDetails(subject: string, count: number): string {
  if (subject === "數學") {
    return `
請生成 ${count} 題選擇題 (mc)，每題 5 分。
規則：
- 四選一，必須提供完整 A, B, C, D 選項。正確選項必須儘量平均分佈，且嚴格禁止連續兩題答案相同。
- 認知層次：包含記憶 (第1級)、理解 (第2級)、應用/分析 (第3-4級)。
- 請確保題目中數字合理、可整除。在題目文字中，若有數學符號（如分數、平方或根號），使用大括號 {} 標記，例如 {frac(3,4)} 代表 3/4 分數，{x^2} 代表平方。
- ⚠️必須包含至少 1 題具有 "graphic" 欄位以利前端渲染。圖形題類型：
  - 長方體表面積："graphic": { "type": "prism", "params": { "length": "10cm", "width": "6cm", "height": "5cm" } }
  - 正方體表面積："graphic": { "type": "cube", "params": { "edge": "8cm" } }
  - 折線圖讀圖題："graphic": { "type": "lineChart", "params": {} }
  - 定價與折扣應用題："graphic": { "type": "tag", "params": { "price": "1200" } }

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "mc",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 5,
      "question": "題目文字",
      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },
      "answer": "A",
      "solution": "極簡解析",
      "graphic": { "type": "prism", "params": { "length": "10cm", "width": "6cm", "height": "5cm" } } // 選填
    }
  ]
}
`;
  } else if (subject === "國語") {
    return `
請生成 ${count} 題選擇題 (mc)，每題 3 分。
規則：
- 包含字音字形辨析、詞義理解、修辭判定。四選一，必須有完整 A, B, C, D，正確答案儘量均勻分佈，嚴格禁止連續兩題答案相同。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "mc",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 3,
      "question": "題目文字",
      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },
      "answer": "A",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else if (subject === "英語") {
    return `
請生成 ${count} 題選擇題 (mc)，每題 2 分。
規則：
- 包含發音辨析 (phonics)、字彙 (vocabulary)、文法 (grammar)、日常對話 (dialogue) 等類型。四選一，答案分佈平衡，嚴格禁止連續兩題答案相同。
- 若題目是有關於社區場所 (hospital, post office, bakery)，可以加上對應的 "graphic" 欄位，例如： "graphic": { "type": "hospital", "params": {} }

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "mc",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 2,
      "question": "題目文字",
      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },
      "answer": "A",
      "solution": "極簡解析",
      "graphic": { "type": "hospital", "params": {} } // 選填
    }
  ]
}
`;
  } else if (subject === "自然") {
    return `
請生成 ${count} 題選擇題 (mc)，每題 4 分。
規則：
- 基礎概念判定、實驗數據與控制變因。四選一，答案分佈平衡，嚴格禁止連續兩題答案相同。
- 若題目是有關於聲音或電路/實驗，可加上對應的 "graphic" 欄位，例如： "graphic": { "type": "circuit", "params": { "lit": true, "closed": true } }

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "mc",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 4,
      "question": "題目文字",
      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },
      "answer": "A",
      "solution": "極簡解析",
      "graphic": { "type": "circuit", "params": { "lit": true, "closed": true } } // 選填
    }
  ]
}
`;
  } else { // 社會
    return `
請生成 ${count} 題選擇題 (mc)，每題 4 分。
規則：
- 歷史事件、地理環境、公民民主與法律常識。四選一，答案分佈平衡，嚴格禁止連續兩題答案相同。
- 若題目是有關於臺灣地理/位置/圓餅統計圖，可加上對應的 "graphic" 欄位，例如： "graphic": { "type": "taiwanMap", "params": { "spots": [{"x": 90, "y": 40, "label": "台北地區"}], "title": "台灣地圖位置判讀" } }

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "mc",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 4,
      "question": "題目文字",
      "options": { "A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D" },
      "answer": "A",
      "solution": "極簡解析",
      "graphic": { "type": "taiwanMap", "params": { "spots": [{"x": 90, "y": 40, "label": "台北地區"}], "title": "台灣地圖位置判讀" } } // 選填
    }
  ]
}
`;
  }
}

function getBlankPromptDetails(subject: string, count: number): string {
  if (subject === "數學") {
    return `
請生成 ${count} 題填充題 (blank)，每題 5 分。
規則：
- 答案需簡短明確 (數字或特定名稱)。
- 若有數學符號（如分數、平方或根號），使用大括號 {} 標記，例如 {frac(3,4)} 代表 3/4 分數，{x^2} 代表平方。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "blank",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 5,
      "question": "題目文字（以 ______ 標示填空處）",
      "answer": "答案內容",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else if (subject === "國語") {
    return `
請生成 ${count} 題填充題 (blank)，每題 5 分。
規則：
- 代表國字注音與改錯字。例如：「在繁複的功課壓力下，我們依然要保持開朗的心境，不要因為挫折而自爆自棄。」錯字為（ 爆 ），應改正為（ 暴 ）。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "blank",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 5,
      "question": "題目文字（以 ______ 標示填空處，或寫出錯字及改正的敘述）",
      "answer": "答案內容",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else if (subject === "英語") {
    return `
請生成 ${count} 題填充題 (blank)，每題 6 分。
規則：
- 看圖填單字題型。請以文字描述情境代替圖片，例如：「(Look at the picture: a girl is studying in the study room) Where is she? She is in the s_ _ _ _ (blank answer: study)」。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "blank",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 6,
      "question": "題目文字（以文字描述圖片情境，並以底線或提示字元標示填空處，例如 s_ _ _ _）",
      "answer": "答案內容",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else if (subject === "自然") {
    return `
請生成 ${count} 題填充題 (blank)，每題 5 分。
規則：
- 器材名稱填寫、實驗變因分類或填空。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "blank",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 5,
      "question": "題目文字（以 ______ 標示填空處）",
      "answer": "答案內容",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else { // 社會
    return `
請生成 ${count} 題配合/填充題 (blank)，每題 5 分。
規則：
- 人物與事蹟配合、地方政府職責填寫。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "blank",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 5,
      "question": "題目文字（以 ______ 標示填空處，或設計人物/事蹟配合題的描述）",
      "answer": "答案內容",
      "solution": "極簡解析"
    }
  ]
}
`;
  }
}

function getOpenPromptDetails(subject: string, count: number): string {
  if (subject === "數學") {
    return `
請生成 ${count} 題應用題 (open)，每題 7.5 分。
規則：
- 每一題必須拆分為兩個子題 (1) 佔 3 分，(2) 佔 4.5 分。
- 在題目文字中，若有數學符號（如分數、平方或根號），使用大括號 {} 標記。
- ⚠️必須包含至少 1 題具有 "graphic" 欄位以利前端渲染。圖形題類型：
  - 長方體表面積："graphic": { "type": "prism", "params": { "length": "10cm", "width": "6cm", "height": "5cm" } }
  - 正方體表面積："graphic": { "type": "cube", "params": { "edge": "8cm" } }
  - 定價與折扣應用題："graphic": { "type": "tag", "params": { "price": "4500" } }
  - 長方體倉庫四周油漆題："graphic": { "type": "warehouse", "params": { "length": "12m", "width": "8m", "height": "4m" } }

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "open",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 7.5,
      "question": "應用題/簡答題題目，包含 (1) 子題和 (2) 子題的敘述與配分",
      "answer": "簡短標準答案",
      "solution": "極簡解析與計算步驟",
      "graphic": { "type": "warehouse", "params": { "length": "12m", "width": "8m", "height": "4m" } } // 選填
    }
  ]
}
`;
  } else if (subject === "國語") {
    return `
請生成 ${count} 題非選擇題 (open)，每題 10 分。
規則：
- 代表閱讀測驗。你必須在第一題前面附加一篇 150-300 字的繁體中文白話文故事（並在文字中明顯標記為「閱讀測驗文章：[文章內容]」），然後針對該文章內容設計 ${count} 題簡答題/理解題，讓學生寫出思考解析。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "open",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 10,
      "question": "題目內容（第 1 題必須附上閱讀測驗文章，例如：閱讀測驗文章：[文章] ... \n\n 題目：請問...）",
      "answer": "簡短標準答案",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else if (subject === "英語") {
    return `
請生成 ${count} 題非選擇題 (open)，每題 8 分。
規則：
- 包含句型重組 (Sentence Unscramble) 或閱讀測驗引導簡答（若為閱讀測驗，請附上一篇 50-100 字簡單英文短文，並提出問答題）。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "open",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 8,
      "question": "題目內容（如重組題目「is / She / study / in / study room / the .」，或英文短文與閱讀問答題）",
      "answer": "正確英文句子或簡答",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else if (subject === "自然") {
    return `
請生成 ${count} 題應用/非選擇題 (open)，每題 7.5 分。
規則：
- 代表實驗申論題。每一題必須包含 (1) 佔 3 分，(2) 佔 4.5 分。涉及具體實驗情境（如：熱對流、空氣與燃燒、防鏽實驗等）。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "open",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 7.5,
      "question": "實驗題目，包含 (1) 子題和 (2) 子題的敘述與配分",
      "answer": "簡短答案",
      "solution": "極簡解析"
    }
  ]
}
`;
  } else { // 社會
    return `
請生成 ${count} 題非選擇/簡答題 (open)，每題 7.5 分。
規則：
- 地圖判讀與統計圖表題。每一題必須包含 (1) 佔 3 分，(2) 佔 4.5 分。例如：讀取經緯度、人口統計圖、臺灣水資源分配圖等。
- 若題目是有關於臺灣地理/位置，可加上對應的 "graphic" 欄位。

回傳格式 JSON Schema：
{
  "questions": [
    {
      "type": "open",
      "section": "單元名稱",
      "bloom_level": "認知層次",
      "points": 7.5,
      "question": "題目內容，包含 (1) 子題 and (2) 子題的敘述與配分",
      "answer": "簡短答案",
      "solution": "極簡解析",
      "graphic": { "type": "pieChart", "params": { "labels": ["農業", "工業", "服務業"] } } // 選填
    }
  ]
}
`;
  }
}

export const config: Config = {
  path: "/api/generate-exam"
};
