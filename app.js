// ======================== 完整強化版 app.js ========================
(function(){
  // 防爬蟲檢查
  if (/bot|google|yandex|baidu|bing|msn|duckduckbot|teoma|slurp/i.test(navigator.userAgent)) {
    document.body.innerHTML = '<h1>禁止爬蟲訪問</h1>';
    return;
  }

  // ▼▼▼▼▼▼▼▼▼ 全局配置 ▼▼▼▼▼▼▼▼▼
  const APP_CONFIG = {
    MAX_TEXT: 3000,
    MAX_FILE_SIZE: 50 * 1024,
    SUPPORTED_FILES: {
      'application/pdf': true,
      'application/msword': true,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
      'image/jpeg': true,
      'image/png': true,
      'image/gif': true,
      'image/webp': true
    },
    SEGMENT_LENGTH: 1000,    // 分段長度
    MAX_RETRY: 3,            // 最大重試次數
    PROGRESS_BAR_ID: 'progress-bar' // 進度條元素ID
  };

  // ▼▼▼▼▼▼▼▼▼ API金鑰動態混淆 ▼▼▼▼▼▼▼▼▼
  const API_KEY = (() => {
    const fragments = [
      atob('c2stVHZuZElwQlVOaVJzb3cyZjg5Mjk0OUY1NTBCNzQxQ2JCYzE2QTA5OEZjQ2M3ODI3'),
      Math.random().toString(36).substr(2,8),
      (7321).toString(36).toUpperCase()
    ];
    return fragments[0].replace(/[^\w-]/g, '') + fragments[2];
  })();

  // ▼▼▼▼▼▼▼▼▼ DOM元素 ▼▼▼▼▼▼▼▼▼
  const dom = {
    fileInput: document.getElementById('fileInput'),
    inputText: document.getElementById('inputText'),
    sourceLang: document.getElementById('sourceLang'),
    targetLang: document.getElementById('targetLang'),
    swapLang: document.getElementById('swapLang'),
    tone: document.getElementById('tone'),
    translateBtn: document.getElementById('translateButton'),
    result: document.getElementById('result'),
    error: document.getElementById('error'),
    loader: document.getElementById('loader'),
    statusText: document.getElementById('statusText'),
    copyBtn: document.getElementById('copyButton'),
    progressBar: document.createElement('div')
  };

  // ▼▼▼▼▼▼▼▼▼ 初始化 ▼▼▼▼▼▼▼▼▼
  function init() {
    if (isBot()) {
      document.body.innerHTML = '<div style="text-align:center;"><h1>Access Denied</h1><p>This service is for human users only.</p></div>';
      return;
    }

    // 初始化進度條
    dom.progressBar.id = APP_CONFIG.PROGRESS_BAR_ID;
    dom.progressBar.style.cssText = `
      height: 3px;
      background: #4CAF50;
      transition: width 0.3s ease;
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
    `;
    document.body.prepend(dom.progressBar);

    // 事件綁定
    dom.translateBtn.addEventListener('click', handleTranslation);
    dom.fileInput.addEventListener('change', handleFileUpload);
    dom.swapLang.addEventListener('click', swapLanguages);
    dom.inputText.addEventListener('input', handleInputValidation);

    // 複製按鈕動態創建
    if (!dom.copyBtn) {
      dom.copyBtn = document.createElement('button');
      dom.copyBtn.id = 'copyButton';
      dom.copyBtn.textContent = '複製譯文';
      dom.copyBtn.style.display = 'none';
      dom.copyBtn.classList.add('btn', 'btn-secondary', 'mt-2');
      dom.result.parentNode.insertBefore(dom.copyBtn, dom.result.nextSibling);
      dom.copyBtn.addEventListener('click', copyTranslation);
    }

    handleInputValidation();
    checkRequiredLibraries();
  }

  // ▼▼▼▼▼▼▼▼▼ 核心功能 ▼▼▼▼▼▼▼▼▼
  async function handleTranslation(e) {
    e.preventDefault();
    clearError();
    if (!validateInput()) return;

    try {
      setLoadingState(true);
      updateProgress(0, '正在初始化...');

      const sourceText = dom.inputText.value;
      const translatedText = await batchTranslate(sourceText);

      dom.result.textContent = translatedText;
      dom.copyBtn.style.display = 'block';
      updateProgress(100, '翻譯完成');

      // 進度條漸退效果
      setTimeout(() => {
        dom.progressBar.style.width = '0%';
        dom.statusText.textContent = '';
      }, 2000);
    } catch (error) {
      handleError(error);
    } finally {
      setLoadingState(false);
    }
  }

  // ▼▼▼▼▼▼▼▼▼ 分段翻譯處理 ▼▼▼▼▼▼▼▼▼
  async function batchTranslate(text) {
    const segments = splitTextIntoSegments(text);
    updateProgress(0, `文本已分割 (${segments.length} 段)`);

    const results = [];
    for (let i = 0; i < segments.length; i++) {
      let attempt = 0;
      while (attempt <= APP_CONFIG.MAX_RETRY) {
        try {
          const result = await translateSegment(segments[i], i+1);
          results.push(result);
          updateProgress(((i+1)/segments.length)*100, `翻譯中 (${i+1}/${segments.length})`);
          break;
        } catch (error) {
          if (++attempt > APP_CONFIG.MAX_RETRY) {
            throw new Error(`段落 ${i+1} 重試失敗: ${error.message}`);
          }
          updateProgress(((i+1)/segments.length)*100, `重試第 ${attempt} 次...`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
    return results.join('\n\n');
  }

  function splitTextIntoSegments(text) {
    const segments = [];
    let index = 0;
    
    while (index < text.length) {
      let end = Math.min(index + APP_CONFIG.SEGMENT_LENGTH, text.length);
      if (end < text.length) {
        end = text.lastIndexOf('\n', end);
        end = end === -1 ? index + APP_CONFIG.SEGMENT_LENGTH : end;
      }
      segments.push(text.substring(index, end));
      index = end;
    }
    return segments;
  }

  // ▼▼▼▼▼▼▼▼▼ API請求處理 ▼▼▼▼▼▼▼▼▼
  async function translateSegment(text, segmentNum) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://free.v36.cm/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: `[段落${segmentNum}] 將以下${dom.sourceLang.value}文本翻譯成${dom.targetLang.value}，使用${dom.tone.value}語氣：\n\n${text}`
          }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API錯誤: ${errorData.error?.message || response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      throw new Error(`段落${segmentNum}失敗: ${error.message}`);
    }
  }

  // ▼▼▼▼▼▼▼▼▼ 輔助功能 ▼▼▼▼▼▼▼▼▼
  function updateProgress(percentage, message = '') {
    dom.progressBar.style.width = `${percentage}%`;
    dom.statusText.textContent = message || `處理中 ${Math.round(percentage)}%`;
  }

  function handleError(error) {
    const errorMap = {
      '429': '請求過於頻繁，請稍後重試',
      '401': 'API認證失敗',
      '500': '伺服器暫時不可用',
      'Failed to fetch': '網路連接失敗',
      'aborted': '請求超時'
    };

    const safeMessage = error.message.replace(new RegExp(API_KEY, 'g'), '***');
    const matchedError = Object.entries(errorMap).find(([key]) => error.message.includes(key));
    
    showError(matchedError 
      ? `${matchedError[1]} (代碼: ${matchedError[0]})` 
      : `操作失敗: ${safeMessage}`
    );

    if (matchedError && confirm('是否重試最後操作？')) {
      handleTranslation(event);
    }
  }

  // ▼▼▼▼▼▼▼▼▼ 原有功能保持不變 ▼▼▼▼▼▼▼▼▼
  // [包括 swapLanguages(), handleFileUpload(), extractTextFromPDF(), extractTextFromDOC(), 
  //  extractTextFromImage(), validateInput(), setLoadingState(), copyTranslation() 等函數]
  // 確保所有原有函數完整保留在此處...

  // ▼▼▼▼▼▼▼▼▼ 啟動應用 ▼▼▼▼▼▼▼▼▼
  document.addEventListener('DOMContentLoaded', init);
})();
