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

const _p1 = 'c2stVHZu';
const _p2 = 'ZElwQlVO';
const _p3 = 'aVJzb3cy';
const _p4 = 'Zjg5Mjk0';
const _p5 = 'OUY1NTBC';
const _p6 = 'NzQxQ2JC';
const _p7 = 'YzE2QTA5';
const _p8 = 'OEZjQ2M3';
const _p9 = 'ODI3';

function getApiConfig() {
    return {
        URL: 'https://free.v36.cm/v1/chat/completions',
        KEY: atob(_p1 + _p2 + _p3 + _p4 + _p5 + _p6 + _p7 + _p8 + _p9),
        TIMEOUT: 15000
    };
}

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
    copyBtn: document.getElementById('copyButton')
};

function init() {
    if (isBot()) {
        document.body.innerHTML = '<div style="text-align:center;"><h1>Access Denied</h1><p>This service is for human users only.</p></div>';
        return;
    }

    dom.translateBtn.addEventListener('click', handleTranslation);
    dom.fileInput.addEventListener('change', handleFileUpload);
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

function isBot() {
    const botPatterns = [
        /bot/i, /crawl/i, /spider/i, /slurp/i, /scrape/i, 
        /python/i, /request/i, /axios/i, /http/i, /fetch/i
    ];
    const userAgent = navigator.userAgent;
    return botPatterns.some(pattern => pattern.test(userAgent));
}

function swapLanguages() {
    [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
    handleInputValidation();
}

async function handleTranslation(e) {
    e.preventDefault();
    clearError();
    if (!validateInput()) return;
    setLoadingState(true);
    try {
        const response = await fetchAPI();
        const result = await processResponse(response);
        dom.result.textContent = result;
        dom.copyBtn.style.display = 'block';
    } catch (error) {
        handleError(error);
    } finally {
        setLoadingState(false);
    }
}

function copyTranslation() {
    const text = dom.result.textContent;
    if (!text) return;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            const originalText = dom.copyBtn.textContent;
            dom.copyBtn.textContent = '已複製！';
            setTimeout(() => {
                dom.copyBtn.textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            showError(`複製失敗: ${err.message}`);
        });
}

async function fetchAPI() {
    const apiConfig = getApiConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), apiConfig.TIMEOUT);

    const response = await fetch(apiConfig.URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiConfig.KEY}`,
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
    if (dom.sourceLang.value === '中文' && dom.targetLang.value === '中文') {
        dom.targetLang.disabled = true;
        dom.targetLang.value = '英文';
    } else {
        dom.targetLang.disabled = false;
    }
}

function validateInput(silent = false) {
    const hasText = dom.inputText.value.trim().length > 0;
    const isValidLength = dom.inputText.value.length <= APP_CONFIG.MAX_TEXT;

    if (!silent) {
        if (!hasText) showError('請輸入翻譯內容');
        if (!isValidLength) showError(`字數超過限制 (最多 ${APP_CONFIG.MAX_TEXT} 字)`);
    }
    return hasText && isValidLength;
}

function setLoadingState(isLoading) {
    dom.translateBtn.disabled = isLoading;
    dom.loader.style.display = isLoading ? 'block' : 'none';
    dom.statusText.textContent = isLoading ? '翻譯中...' : '';
    if (isLoading) {
        dom.copyBtn.style.display = 'none';
    }
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
        showError(`文件大小超過限制 (最大 ${APP_CONFIG.MAX_FILE_SIZE / 1024} KB)`);
        return;
    }

    if (!APP_CONFIG.SUPPORTED_FILES[file.type]) {
        showError(`不支援的檔案類型: ${file.type}`);
        return;
    }

    dom.statusText.textContent = '處理文件中...';
    dom.loader.style.display = 'block';

    try {
        if (file.type === 'application/pdf') {
            extractTextFromPDF(file);
        } else if (file.type.includes('word')) {
            extractTextFromDOC(file);
        } else if (file.type.includes('image')) {
            extractTextFromImage(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                dom.inputText.value = e.target.result.slice(0, APP_CONFIG.MAX_TEXT);
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
                handleInputValidation();
            };
            reader.readAsText(file, 'UTF-8');
        }
    } catch (error) {
        showError(`文件處理錯誤: ${error.message}`);
        dom.loader.style.display = 'none';
        dom.statusText.textContent = '';
    }
}

async function extractTextFromPDF(file) {
    try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const typedArray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ');
                }
                dom.inputText.value = text.slice(0, APP_CONFIG.MAX_TEXT);
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
                handleInputValidation();
            } catch (error) {
                showError(`PDF解析錯誤: ${error.message}`);
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        showError(`PDF庫加載失敗: ${error.message}，請確保已引入PDF.js庫`);
        dom.loader.style.display = 'none';
        dom.statusText.textContent = '';
    }
}

async function extractTextFromDOC(file) {
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                if (typeof mammoth === 'undefined') {
                    throw new Error('請引入mammoth.js庫以支援DOC/DOCX格式');
                }
                
                const result = await mammoth.extractRawText({ arrayBuffer });
                dom.inputText.value = result.value.slice(0, APP_CONFIG.MAX_TEXT);
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
                handleInputValidation();
            } catch (error) {
                showError(`Word文檔解析錯誤: ${error.message}`);
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        showError(`Word處理錯誤: ${error.message}`);
        dom.loader.style.display = 'none';
        dom.statusText.textContent = '';
    }
}

async function extractTextFromImage(file) {
    try {
        if (typeof Tesseract === 'undefined') {
            throw new Error('請引入Tesseract.js庫以支援OCR功能');
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const img = new Image();
            img.onload = async () => {
                dom.statusText.textContent = 'OCR處理中...';
                
                const result = await Tesseract.recognize(
                    img,
                    'chi_tra+eng',
                    { 
                        logger: status => {
                            dom.statusText.textContent = `OCR處理中: ${status.status} (${Math.round(status.progress * 100)}%)`;
                        }
                    }
                );
                
                dom.inputText.value = result.data.text.slice(0, APP_CONFIG.MAX_TEXT);
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
                handleInputValidation();
            };
            
            img.onerror = () => {
                showError('圖片載入失敗');
                dom.loader.style.display = 'none';
                dom.statusText.textContent = '';
            };
            
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    } catch (error) {
        showError(`OCR處理錯誤: ${error.message}`);
        dom.loader.style.display = 'none';
        dom.statusText.textContent = '';
    }
}

async function processResponse(response) {
    if (!response.ok) throw new Error(response.status);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '翻譯失敗';
}

function handleError(error) {
    showError(`錯誤: ${error.message}`);
}

function showError(message) {
    dom.error.textContent = message;
    dom.error.style.display = 'block';
}

function clearError() {
    dom.error.textContent = '';
    dom.error.style.display = 'none';
}

function checkRequiredLibraries() {
    const libraries = {
        'PDF.js': typeof window['pdfjs-dist/build/pdf'] !== 'undefined',
        'Mammoth.js': typeof mammoth !== 'undefined',
        'Tesseract.js': typeof Tesseract !== 'undefined'
    };
    
    const missing = Object.entries(libraries)
        .filter(([_, loaded]) => !loaded)
        .map(([name]) => name);
    
    if (missing.length > 0) {
        console.warn(`警告: 以下庫未加載 (某些功能可能不可用): ${missing.join(', ')}`);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    init();
    checkRequiredLibraries();
});
