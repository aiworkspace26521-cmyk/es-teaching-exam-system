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
    const { subject: rawSubject, grade, publisher, wrongQuestion } = body;

    // Normalize subject to Chinese term robustly
    let subject = rawSubject;
    if (rawSubject === "math" || rawSubject === "數學") subject = "數學";
    else if (rawSubject === "chinese" || rawSubject === "國語") subject = "國語";
    else if (rawSubject === "english" || rawSubject === "英語") subject = "英語";
    else if (rawSubject === "science" || rawSubject === "自然") subject = "自然";
    else if (rawSubject === "social" || rawSubject === "社會") subject = "社會";

    // 取得 Gemini API Key
    const apiKey = req.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing Gemini API Key. Please configure it." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const randomSeed = Math.random().toString(36).substring(2, 10);
    const systemPrompt = `你是一位臺灣國小 ${grade} ${subject} 科目的專業教師。
    學生在做以下題目時答錯了。請出一題與原錯題「概念相同、情境或數值不同」的「擴充練習題（類題）」，讓學生能進一步練習該知識點。
    
    隨機種子：${randomSeed}
    請務必結合此隨機種子，重新設計新出的類題主角姓名、日常情境與具體數值，確保多次生成此題目時均具備隨機性與多樣性。
    
    原錯題資訊：
    - 單元/章節：${wrongQuestion.section || "未指定"}
    - 認知層次：${wrongQuestion.bloom_level || "未指定"}
    - 題型：${wrongQuestion.type === "mc" ? "選擇題" : wrongQuestion.type === "blank" ? "填充題" : "非選擇題/應用題"}
    - 原題目：${wrongQuestion.question}
    ${wrongQuestion.options ? `- 原選項：A: ${wrongQuestion.options.A}, B: ${wrongQuestion.options.B}, C: ${wrongQuestion.options.C}, D: ${wrongQuestion.options.D}` : ""}
    - 原正確答案：${wrongQuestion.answer}
    - 原解析：${wrongQuestion.solution}
    ${wrongQuestion.graphic ? `- 原圖形示意圖：${JSON.stringify(wrongQuestion.graphic)}` : ""}
    
    出題規則：
    1. 必須與原題目的「題型」完全一致（如果是選擇題，必須提供四個選項；若是填充或應用題，請出對應題型）。
    2. 核心考點不變，但請更換裡面的數值、姓名或日常情境（例如將購買蘋果改成購買橘子，或者將速率的數值進行替換，確保可整除或符合邏輯）。
    3. 題目與選項、解析均使用繁體中文。
    4. 如果原題目包含 \`graphic\` 欄位，請在您新出的題目中，也附上結構相同但數值參數（params）符合您新題目的 \`graphic\` 欄位（例如：若原題圖形是 prism，新題若長寬高不同，請填入新長寬高）。
    5. 回傳格式為嚴格的 JSON：
       {
         "type": "${wrongQuestion.type}",
         "question": "新出題目的內容",
         "options": ${wrongQuestion.type === "mc" ? '{"A": "新選項A", "B": "新選項B", "C": "新選項C", "D": "新選項D"}' : "null"},
         "answer": "新答案",
         "solution": "新題目的詳細解題過程與步驟說明",
         "graphic": ${wrongQuestion.graphic ? '{"type": "原圖形類型", "params": { "新圖形參數" }}' : "null"}
       }
    
    注意：請只回傳符合 JSON 的字串，不要加上 markdown 標示！解析 (solution) 必須簡短，限 1 句話（20 字）內。`;

    try {
      const parsedQuestion = await callGemini(apiKey, systemPrompt);
      return new Response(JSON.stringify(parsedQuestion), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: `Gemini failed or did not return valid JSON: ${e.message}` }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};

export const config: Config = {
  path: "/api/generate-extension"
};
