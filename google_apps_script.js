/**
 * 國小段考模擬試題系統 - Google Sheets 後端資料庫儲存腳本
 *
 * 部署說明：
 * 1. 建立一個新的 Google 試算表 (Google Sheet)。
 * 2. 點選選單的「擴充功能」->「Apps Script」。
 * 3. 將此檔案的所有程式碼複製並貼入編輯器中，取代原有內容。
 * 4. 點選「儲存」按鈕 (磁碟圖示)。
 * 5. 點選右上角的「部署」->「新增部署」。
 * 6. 選取類型為「網頁應用程式」(Web App)。
 * 7. 設定如下：
 *    - 說明：模擬試題系統後端
 *    - 專案執行身分：我 (您的 Google 帳號)
 *    - 誰有權限存取：所有人 (Anyone) — 這是必要的，以便讓 Netlify 前端能發送請求
 * 8. 點選「部署」，並授予必要的權限（若有提示安全警告，點選「進階」並允許存取）。
 * 9. 複製產生的「網頁應用程式網址」(Web App URL)。
 * 10. 將該網址填入試題系統網頁的「設定」面板中，或設定為 Netlify 的 `GOOGLE_SCRIPT_URL` 環境變數。
 */

function doPost(e) {
  try {
    // 解析傳入的 JSON 資料
    var requestData = JSON.parse(e.postData.contents);
    
    // 取得或建立當前活動的試算表
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 如果試算表是空的，先建立標頭列
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "時間戳記", 
        "學生姓名", 
        "科目", 
        "年級學期", 
        "考試範圍", 
        "得分", 
        "總題數", 
        "錯誤題數", 
        "錯誤題目明細"
      ]);
      // 美化標頭
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e6f2ff").setHorizontalAlignment("center");
    }
    
    // 整理錯誤題目明細為文字格式
    var wrongQuestionsText = "";
    if (requestData.wrongQuestions && requestData.wrongQuestions.length > 0) {
      wrongQuestionsText = requestData.wrongQuestions.map(function(q, index) {
        return (index + 1) + ". [" + q.type + "] " + q.question + "\n" +
               "   學生答案: " + q.studentAnswer + "\n" +
               "   正確答案: " + q.correctAnswer + "\n" +
               "   解析: " + q.solution;
      }).join("\n\n");
    } else {
      wrongQuestionsText = "無錯誤題目！太棒了！";
    }
    
    // 新增一筆記錄
    sheet.appendRow([
      new Date(),
      requestData.studentName || "未填寫",
      requestData.subject || "未填寫",
      requestData.gradeSemester || "未填寫",
      requestData.scope || "未填寫",
      requestData.score !== undefined ? requestData.score : 0,
      requestData.totalQuestions || 0,
      requestData.wrongCount !== undefined ? requestData.wrongCount : 0,
      wrongQuestionsText
    ]);
    
    // 自動調整欄寬
    sheet.autoResizeColumns(1, 9);
    
    // 回傳成功訊息
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "成績與錯誤題型已成功記錄至 Google Sheets！"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // 發生錯誤時回傳錯誤訊息
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Sheets 後端伺服器運行中！請使用 POST 方法提交考卷資料。")
    .setMimeType(ContentService.MimeType.TEXT);
}
