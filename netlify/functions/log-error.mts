import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // 僅允許 POST 請求
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-google-script-url"
      }
    });
  }

  try {
    const body = await req.json();
    
    // 取得 Google Apps Script Web App URL。優先從環境變數讀取，其次從 Header 讀取
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL || req.headers.get("x-google-script-url");

    if (!scriptUrl) {
      return new Response(JSON.stringify({ error: "Missing Google Apps Script URL. Please configure it in your environment or settings." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // 發送 POST 到 Google Apps Script Web App
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Google Script returned error: ${errorText}` }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });

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
  path: "/api/log-error"
};
