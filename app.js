// app.js
const API_CONFIG = {
    URL: 'https://free.v36.cm/v1/chat/completions',
    KEY: 'sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827',
    MAX_TOKENS: 1000,
    TIMEOUT: 15000 // 15秒超時
};

const APP_CONFIG = {
    MAX_TEXT: 3000,
    MAX_FILE_SIZE: 50 * 1024 // 50KB
};

// DOM 元素引用
const dom = {
    fileInput: document.getElementById('fileInput'),
    inputText: document.getElementById('inputText'),
    sourceLang: document.getElementById('sourceLang'),
    targetLang: document.getElementById('targetLang'),
    tone: document.getElementById('tone'),
    translateBtn: document.getElementById('translateButton'),
    result: document.getElementById('result'),
    error: document.getElementById('error'),
    loader: document.querySelector('.loader'),
    statusText: document.getElementById('statusText')
};

// 初始化應用
function init() {
    dom.fileInput.addEventListener('change', handleFileUpload);
    dom.translateBtn.addEventListener('click', handleTranslation);
    dom.inputText.addEventListener('input', validateInput);
}

// 核心翻譯功能
async function handleTranslation() {
    clearError();
    const text = dom.inputText.value.trim();

    if (!validateInput(text)) return;

    try {
        setLoadingState(true);
        const response = await fetchWithTimeout(API_CONFIG.URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.KEY}`,
                'Content-Type': 'application/json'
            },
            body: buildRequestBody(text)
        });

        await handleApiResponse(response);
    } catch (error) {
        handleApiError(error);
    } finally {
        setLoadingState(false);
    }
}

// API 請求超時處理
function fetchWithTimeout(url, options) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('請求超時')), API_CONFIG.TIMEOUT)
    ]);
}

// 構建請求內容
function buildRequestBody(text) {
    return JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
            role: 'user',
            content: `請將以下${dom.sourceLang.value}翻譯成${dom.targetLang.value}，語氣為${dom.tone.value}：${text}`
        }],
        max_tokens: API_CONFIG.MAX_TOKENS
    });
}

// 處理API響應
async function handleApiResponse(response) {
    if (!response.ok) {
        const errorData = await parseErrorResponse(response);
        throw new Error(errorData.message || `API錯誤 (${response.status})`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
        throw new Error('無效的API響應格式');
    }

    dom.result.textContent = data.choices[0].message.content;
    updateStatus('翻譯完成');
}

// 解析錯誤信息
async function parseErrorResponse(response) {
    try {
        return await response.json();
    } catch {
        return { message: await response.text() };
    }
}

// 文件處理功能
async function handleFileUpload(event) {
    clearError();
    const file = event.target.files[0];
    
    if (!file) return;

    if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        showError(`文件大小超過限制 (最大 ${APP_CONFIG.MAX_FILE_SIZE/1024}KB)`);
        return resetFileInput();
    }

    try {
        const content = await readFile(file);
        dom.inputText.value = sanitizeInput(content);
        updateStatus(`已載入文件：${file.name}`);
    } catch (error) {
        showError(`文件讀取失敗：${error.message}`);
        resetFileInput();
    }
}

// 工具函數
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('無法讀取文件'));
        reader.readAsText(file);
    });
}

function sanitizeInput(text) {
    return text.slice(0, APP_CONFIG.MAX_TEXT)
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
}

// 狀態管理
function setLoadingState(isLoading) {
    dom.translateBtn.disabled = isLoading;
    dom.loader.style.display = isLoading ? 'block' : 'none';
    dom.statusText.textContent = isLoading ? '翻譯中...' : '';
}

function validateInput() {
    const text = dom.inputText.value;
    const isValid = text.length > 0 && text.length <= APP_CONFIG.MAX_TEXT;

    dom.translateBtn.disabled = !isValid;
    dom.error.style.display = isValid ? 'none' : 'block';

    if (!isValid) {
        showError(text.length > APP_CONFIG.MAX_TEXT ?
            `超過字數限制 (最多 ${APP_CONFIG.MAX_TEXT} 字)` :
            '請輸入要翻譯的文字'
        );
    }

    return isValid;
}

// 錯誤處理
function handleApiError(error) {
    console.error('API Error:', error);
    
    const errorMessages = {
        'Failed to fetch': '無法連接伺服器',
        '401': 'API 金鑰無效',
        'network timeout': '連線超時',
        'rate limit': '請求過於頻繁'
    };

    const message = Object.entries(errorMessages).find(([key]) => 
        error.message.includes(key)
    )?.[1] || `翻譯失敗：${error.message.replace(API_CONFIG.KEY, '***')}`;

    showError(message);
}

function showError(message) {
    dom.error.style.display = 'block';
    dom.error.textContent = message;
}

function clearError() {
    dom.error.style.display = 'none';
    dom.error.textContent = '';
}

function resetFileInput() {
    dom.fileInput.value = '';
    dom.inputText.value = '';
}

function updateStatus(message) {
    dom.statusText.textContent = message;
}

// 啟動應用
init();
