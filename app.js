// app.js
const API_CONFIG = {
    URL: 'https://free.v36.cm/v1/chat/completions',
    KEY: 'sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827',
    MAX_TOKENS: 1000
};

const APP_CONFIG = {
    MAX_TEXT: 3000,
    MAX_FILE_SIZE: 50 * 1024 // 50KB
};

// DOM 元素
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

// 初始化事件監聽
function init() {
    dom.fileInput.addEventListener('change', handleFileUpload);
    dom.translateBtn.addEventListener('click', handleTranslation);
    dom.inputText.addEventListener('input', validateInput);
}

// 文件上傳處理
async function handleFileUpload(e) {
    clearError();
    const file = e.target.files[0];
    
    if (!file) return;

    if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        showError(`文件大小超過限制 (${APP_CONFIG.MAX_FILE_SIZE/1024}KB)`);
        return;
    }

    try {
        const text = await readFile(file);
        dom.inputText.value = text.slice(0, APP_CONFIG.MAX_TEXT);
        updateStatus(`已載入文件：${file.name}`);
    } catch (error) {
        showError(`文件讀取失敗：${error.message}`);
    }
}

// 翻譯處理
async function handleTranslation() {
    clearError();
    const text = dom.inputText.value.trim();

    if (!validateInput()) return;

    try {
        setLoading(true);
        const response = await callTranslateAPI(text);
        const data = await parseResponse(response);
        showResult(data);
    } catch (error) {
        handleAPIError(error);
    } finally {
        setLoading(false);
    }
}

// API 呼叫
async function callTranslateAPI(text) {
    const prompt = buildPrompt(text);
    
    const response = await fetch(API_CONFIG.URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_CONFIG.KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: API_CONFIG.MAX_TOKENS
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API 錯誤 (${response.status})`);
    }

    return response;
}

// 工具函數
function buildPrompt(text) {
    return `請將以下${dom.sourceLang.value}翻譯成${dom.targetLang.value}，語氣為${dom.tone.value}：${text}`;
}

async function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('無法讀取文件'));
        reader.readAsText(file);
    });
}

function validateInput() {
    const text = dom.inputText.value;
    const isValid = text.length > 0 && text.length <= APP_CONFIG.MAX_TEXT;

    if (!isValid) {
        showError(text.length > APP_CONFIG.MAX_TEXT 
            ? `超過字數限制 (最多 ${APP_CONFIG.MAX_TEXT} 字)`
            : '請輸入要翻譯的文字');
    }

    dom.translateBtn.disabled = !isValid;
    return isValid;
}

// 狀態管理
function setLoading(isLoading) {
    dom.translateBtn.disabled = isLoading;
    dom.loader.style.display = isLoading ? 'block' : 'none';
    dom.statusText.textContent = isLoading ? '翻譯中...' : '';
}

function showResult(text) {
    dom.result.textContent = text;
    updateStatus('翻譯完成');
}

function updateStatus(message) {
    dom.statusText.textContent = message;
}

function showError(message) {
    dom.error.style.display = 'block';
    dom.error.textContent = message;
}

function clearError() {
    dom.error.style.display = 'none';
    dom.error.textContent = '';
}

// 錯誤處理
function handleAPIError(error) {
    console.error('API Error:', error);
    
    const errorMessages = {
        'Failed to fetch': '無法連接伺服器',
        '401': 'API 金鑰無效',
        'rate limit': '請求過於頻繁',
        'network timeout': '連線超時'
    };

    const message = Object.entries(errorMessages).find(([key]) => 
        error.message.includes(key)
    )?.[1] || `翻譯失敗：${error.message}`;

    showError(message);
}

// 啟動應用
init();
