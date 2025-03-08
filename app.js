document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827", // 这里不要暴露真实 API Key
        TIMEOUT: 15000
    };

    const APP_CONFIG = {
        MAX_TEXT: 3000,
        MAX_FILE_SIZE: 50 * 1024 // 50KB
    };

    // 获取 DOM 元素
    const dom = {
        fileInput: document.getElementById("fileInput"),
        inputText: document.getElementById("inputText"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        swapLang: document.getElementById("swapLang"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        error: document.getElementById("error"),
        loader: document.getElementById("loader"),
        statusText: document.getElementById("statusText")
    };

    // 初始化事件监听
    function init() {
        if (!dom.translateBtn) {
            console.error("錯誤：找不到按鈕 #translateButton");
            return;
        }

        dom.translateBtn.addEventListener("click", handleTranslation);
        dom.fileInput.addEventListener("change", handleFileUpload);
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", handleInputValidation);
    }

    // 交换语言
    function swapLanguages() {
        [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
        handleInputValidation();
    }

    // 处理翻译
    async function handleTranslation(e) {
        e.preventDefault();
        clearError();
        if (!validateInput()) return;

        setLoadingState(true);
        try {
            const response = await fetchAPI();
            const resultText = processResponse(response);
            dom.result.textContent = resultText; // 显示翻译结果
        } catch (error) {
            handleError(error);
        } finally {
            setLoadingState(false);
        }
    }

    // 发送 API 请求
    async function fetchAPI() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

        try {
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{
                        role: "user",
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

    // 生成翻译请求的内容
    function buildPrompt() {
        return `請將以下${dom.sourceLang.value}文本翻譯成${dom.targetLang.value}，只返回翻譯結果：\n\n${dom.inputText.value}`;
    }

    // 输入框验证
    function handleInputValidation() {
        dom.translateBtn.disabled = !validateInput(true);
        if (dom.sourceLang.value === "中文" && dom.targetLang.value === "中文") {
            dom.targetLang.disabled = true;
            dom.targetLang.value = "英文";
        } else {
            dom.targetLang.disabled = false;
        }
    }

    // 验证输入是否合法
    function validateInput(silent = false) {
        const hasText = dom.inputText.value.trim().length > 0;
        const isValidLength = dom.inputText.value.length <= APP_CONFIG.MAX_TEXT;

        if (!silent) {
            if (!hasText) showError("請輸入翻譯內容");
            if (!isValidLength) showError(`字數超過限制 (最多 ${APP_CONFIG.MAX_TEXT} 字)`);
        }
        return hasText && isValidLength;
    }

    // 处理文件上传
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
            showError(`文件大小超過限制 (最大 ${APP_CONFIG.MAX_FILE_SIZE / 1024} KB)`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            dom.inputText.value = e.target.result.slice(0, APP_CONFIG.MAX_TEXT);
            handleInputValidation();
        };
        reader.readAsText(file, "UTF-8");
    }

    // 处理 API 响应
    function processResponse(data) {
        if (!data.choices?.[0]?.message?.content) {
            throw new Error("API回應格式錯誤");
        }
        return data.choices[0].message.content.trim();
    }

    // 设置加载状态
    function setLoadingState(isLoading) {
        dom.translateBtn.disabled = isLoading;
        dom.loader.style.display = isLoading ? "block" : "none";
        dom.statusText.textContent = isLoading ? "翻譯中..." : "";
    }

    // 处理错误
    function handleError(error) {
        showError(`錯誤: ${error.message}`);
    }

    // 显示错误信息
    function showError(message) {
        dom.error.textContent = message;
        dom.error.style.display = "block";
    }

    // 清除错误信息
    function clearError() {
        dom.error.textContent = "";
        dom.error.style.display = "none";
    }

    init();
});
