document.addEventListener('DOMContentLoaded', () => {
    const API_CONFIG = {
        URL: 'https://free.v36.cm/v1/chat/completions',
        KEY: 'sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827', // 替換為你的 API Key
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
        swapLang: document.getElementById('swapLang'),
        tone: document.getElementById('tone'),
        translateBtn: document.getElementById('translateButton'),
        result: document.getElementById('result'),
        error: document.getElementById('error'),
        loader: document.getElementById('loader'),
        statusText: document.getElementById('statusText')
    };

    function init() {
        if (!dom.translateBtn) {
            console.error('錯誤：找不到按鈕元素 #translateButton');
            return;
        }

        dom.translateBtn.addEventListener('click', handleTranslation);
        dom.fileInput.addEventListener('change', handleFileUpload);
        dom.swapLang.addEventListener('click', swapLanguages);
        dom.inputText.addEventListener('input', handleInputValidation);
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
            dom.result.textContent = result; // 顯示翻譯結果
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API錯誤: ${errorData.error?.message || response.status}`);
            }

            return response.json();
        } catch (error) {
            throw new Error(`請求失敗: ${error.message}`);
        }
    }

    function buildPrompt() {
        return `將以下${dom.sourceLang.value}文本翻譯成${dom.targetLang.value}，只返回翻譯結果：\n\n${dom.inputText.value}`;
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
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
            showError(`文件大小超過限制 (最大 ${APP_CONFIG.MAX_FILE_SIZE / 1024} KB)`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            if (file.type === 'application/pdf') {
                extractTextFromPDF(file);
            } else {
                dom.inputText.value = text.slice(0, APP_CONFIG.MAX_TEXT);
            }
            handleInputValidation();
        };
        reader.readAsText(file, 'UTF-8');
    }

    async function extractTextFromPDF(file) {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.2.146/pdf.worker.min.js';
        const reader = new FileReader();
        reader.onload = async (event) => {
            const typedArray = new Uint8Array(event.target.result);
            const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ');
            }
            dom.inputText.value = text.slice(0, APP_CONFIG.MAX_TEXT);
            handleInputValidation();
        };
        reader.readAsArrayBuffer(file);
    }

    async function processResponse(response) {
        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('API回應格式錯誤');
        }
        return data.choices[0].message.content.trim();
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

    init();
});
