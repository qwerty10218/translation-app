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
    }
};

const API_CONFIG = {
    URL: 'https://free.v36.cm/v1/chat/completions',
    KEY: atob('c2stVHZuZElwQlVOaVJzb3cyZjg5Mjk0OUY1NTBCNzQxQ2JCYzE2QTA5OEZjQ2M3ODI3'),
    TIMEOUT: 15000
};

const dom = {
    inputText: document.getElementById('inputText'),
    sourceLang: document.getElementById('sourceLang'),
    targetLang: document.getElementById('targetLang'),
    swapLang: document.getElementById('swapLang'),
    tone: document.getElementById('tone'),
    translateBtn: document.getElementById('translateButton'),
    result: document.getElementById('result'),
    copyBtn: document.getElementById('copyButton')
};

function init() {
    dom.translateBtn.addEventListener('click', handleTranslation);
    dom.swapLang.addEventListener('click', swapLanguages);
    dom.inputText.addEventListener('input', handleInputValidation);
    
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
}

function swapLanguages() {
    [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
    handleInputValidation();
}

async function handleTranslation(e) {
    e.preventDefault();
    dom.result.textContent = '';
    dom.copyBtn.style.display = 'none';
    
    if (!validateInput()) return;
    
    try {
        const response = await fetchAPI();
        if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
        
        const result = await response.json();
        if (result.choices && result.choices.length > 0) {
            dom.result.textContent = result.choices[0].message.content;
            dom.copyBtn.style.display = 'block';
        } else {
            throw new Error('無法獲取翻譯結果');
        }
    } catch (error) {
        console.error('翻譯錯誤:', error);
    }
}

function copyTranslation() {
    const text = dom.result.textContent;
    if (!text) return;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            dom.copyBtn.textContent = '已複製！';
            setTimeout(() => {
                dom.copyBtn.textContent = '複製譯文';
            }, 2000);
        })
        .catch(err => {
            console.error(`複製失敗: ${err.message}`);
        });
}

async function fetchAPI() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(API_CONFIG.URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_CONFIG.KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: buildPrompt()
            }]
        }),
        signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
}

function buildPrompt() {
    return `將以下${dom.sourceLang.value}文本翻譯成${dom.targetLang.value}，使用${dom.tone.value}語氣。只返回翻譯結果：\n\n${dom.inputText.value}`;
}

function handleInputValidation() {
    dom.translateBtn.disabled = !validateInput(true);
}

function validateInput(silent = false) {
    const hasText = dom.inputText.value.trim().length > 0;
    const isValidLength = dom.inputText.value.length <= APP_CONFIG.MAX_TEXT;
    return hasText && isValidLength;
}

document.addEventListener('DOMContentLoaded', init);
