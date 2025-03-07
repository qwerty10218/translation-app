// app.js (修复版)
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

function init() {
    if (!dom.translateBtn) {
        console.error('无法找到翻译按钮');
        return;
    }
    dom.translateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleTranslation();
    });
    dom.fileInput.addEventListener('change', handleFileUpload);
    dom.inputText.addEventListener('input', handleInputValidation);
}

async function handleTranslation() {
    try {
        clearError();
        if (!validateInput()) return;
        setLoadingState(true);
        const response = await fetchAPI();
        const data = await processResponse(response);
        
        // 简化输出，只显示翻译结果
        dom.result.textContent = data;
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
    // 简化翻译提示，避免多余解释
    return `将下面${dom.sourceLang.value}文本翻译成${dom.targetLang.value}，使用${dom.tone.value}语气。只返回翻译结果，不要添加任何解释或原文：\n\n${dom.inputText.value}`;
}

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

function setLoadingState(isLoading) {
    dom.translateBtn.disabled = isLoading;
    dom.loader.style.display = isLoading ? 'block' : 'none';
    dom.statusText.textContent = isLoading ? '翻译中...' : '';
}

// 修复文件上传处理，解决乱码问题
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        showError(`文件大小超过限制 (最大 ${APP_CONFIG.MAX_FILE_SIZE / 1024} KB)`);
        dom.fileInput.value = ''; // 清除文件选择
        return;
    }
    
    const reader = new FileReader();
    // 检测文件类型
    if (file.type.includes('text')) {
        reader.readAsText(file, 'UTF-8'); // 指定UTF-8编码
    } else {
        // 对于非文本文件，作为二进制读取然后转换
        reader.readAsArrayBuffer(file);
    }
    
    reader.onload = function(e) {
        try {
            let text;
            if (typeof e.target.result === 'string') {
                // 直接获取文本结果
                text = e.target.result;
            } else {
                // 处理二进制数据，尝试多种编码
                const buffer = e.target.result;
                const decoder = new TextDecoder('UTF-8'); // 首先尝试UTF-8
                text = decoder.decode(buffer);
                
                // 如果检测到乱码，尝试其他编码
                if (containsGarbledText(text)) {
                    const gbkDecoder = new TextDecoder('gbk'); // 尝试GBK
                    try {
                        text = gbkDecoder.decode(buffer);
                    } catch (error) {
                        // GBK失败，尝试其他方法
                        console.warn('GBK解码失败，继续使用UTF-8结果');
                    }
                }
            }
            
            // 截断过长文本
            dom.inputText.value = text.length > APP_CONFIG.MAX_TEXT 
                ? text.substring(0, APP_CONFIG.MAX_TEXT) 
                : text;
            handleInputValidation();
        } catch (error) {
            console.error('文件读取错误:', error);
            showError('无法读取文件内容');
        }
    };
    
    reader.onerror = function() {
        showError('读取文件时出错');
    };
}

// 简单的乱码检测
function containsGarbledText(text) {
    // 检查特殊乱码字符比例是否较高
    const garbledChars = text.match(/[\uFFFD\u2026\u25A1\u25CF]/g) || [];
    return (garbledChars.length / text.length) > 0.1;
}

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

function showError(message) {
    if (!dom.error) return;
    dom.error.textContent = message;
    dom.error.style.display = 'block';
}

function clearError() {
    if (!dom.error) return;
    dom.error.textContent = '';
    dom.error.style.display = 'none';
}

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

document.addEventListener('DOMContentLoaded', init);
