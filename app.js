// app.js (完整修复版)
const API_CONFIG = {
    URL: 'https://free.v36.cm/v1/chat/completions',
    KEY: 'sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827',
    TIMEOUT: 15000
};
const APP_CONFIG = {
    MAX_TEXT: 3000,
    MAX_FILE_SIZE: 50 * 1024
};
const dom = {
    fileInput: document.getElementById('fileInput'),
    inputText: document.getElementById('inputText'),
    sourceLang: document.getElementById('sourceLang'),
    targetLang: document.getElementById('targetLang'),
    tone: document.getElementById('tone'),
    translateBtn: document.getElementById('translateButton'),
    result: document.getElementById('result'),
    error: document.getElementById('error'),
    loader: document.getElementById('loader'),
    statusText: document.getElementById('statusText')
};
// 核心修复点：事件绑定和异步处理
function init() {
    // 确保DOM元素存在
    if (!dom.translateBtn) {
        console.error('无法找到翻译按钮');
        return;
    }
    // 使用更可靠的事件绑定方式
    dom.translateBtn.addEventListener('click', async (e) => {
        e.preventDefault(); // 防止默认行为
        await handleTranslation();
    });
    dom.fileInput.addEventListener('change', handleFileUpload);
    dom.inputText.addEventListener('input', handleInputValidation);
}
async function handleTranslation() {
    console.log('翻译按钮被点击'); // 调试日志
    
    try {
        clearError();
        if (!validateInput()) return;
        setLoadingState(true);
        const response = await fetchAPI();
        const data = await processResponse(response);
        
        dom.result.textContent = data;
        showStatus('翻译完成');
    } catch (error) {
        handleError(error);
    } finally {
        setLoadingState(false);
    }
}
async function fetchAPI() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    try {
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
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
function buildPrompt() {
    return `請將以下${dom.sourceLang.value}翻譯成${dom.targetLang.value}，語氣為${dom.tone.value}：${dom.inputText.value}`;
}
// 新增输入验证
function handleInputValidation() {
    dom.translateBtn.disabled = !validateInput(true);
}
function validateInput(silentCheck = false) {
    const hasText = dom.inputText.value.trim().length > 0;
    const isValidLength = dom.inputText.value.length <= APP_CONFIG.MAX_TEXT;
    
    if (!silentCheck) {
        if (!hasText) showError('请输入要翻译的文字');
        if (!isValidLength) showError(`超过字数限制 (最多 ${APP_CONFIG.MAX_TEXT} 字)`);
    }
    
    return hasText && isValidLength;
}
// 状态管理
function setLoadingState(isLoading) {
    dom.translateBtn.disabled = isLoading;
    dom.loader.style.display = isLoading ? 'block' : 'none';
    dom.statusText.textContent = isLoading ? '翻译中...' : '';
}
// 文件处理
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        showError(`文件大小超过限制 (最大 ${APP_CONFIG.MAX_FILE_SIZE / 1024} KB)`);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            dom.inputText.value = text.length > APP_CONFIG.MAX_TEXT 
                ? text.substring(0, APP_CONFIG.MAX_TEXT) 
                : text;
            handleInputValidation();
        } catch (error) {
            showError('无法读取文件内容');
        }
    };
    reader.onerror = function() {
        showError('读取文件时出错');
    };
    reader.readAsText(file);
}
// 错误处理增强
function handleError(error) {
    console.error('Error details:', error);
    
    const errorMap = {
        'AbortError': '请求超时，请稍后重试',
        'Failed to fetch': '网络连接失败',
        '401': 'API密钥无效',
        'Unexpected token': 'API返回格式错误'
    };
    const message = Object.entries(errorMap).find(([key]) => 
        error.message && error.message.includes(key)
    )?.[1] || `翻译失败：${error.message || '未知错误'}`;
    showError(message);
}
// 显示错误
function showError(message) {
    if (!dom.error) return;
    dom.error.textContent = message;
    dom.error.style.display = 'block';
}
// 清除错误
function clearError() {
    if (!dom.error) return;
    dom.error.textContent = '';
    dom.error.style.display = 'none';
}
// 显示状态
function showStatus(message) {
    if (!dom.statusText) return;
    dom.statusText.textContent = message;
}
// 处理API响应
async function processResponse(response) {
    if (!response.ok) {
        throw new Error(`${response.status}`);
    }
    
    try {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content.trim();
        } else {
            throw new Error('Unexpected token');
        }
    } catch (error) {
        throw error;
    }
}
// 初始化执行
document.addEventListener('DOMContentLoaded', init);
