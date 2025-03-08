document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
        TIMEOUT: 15000
    };

    const APP_CONFIG = {
        MAX_TEXT: 3000,
        MAX_FILE_SIZE: 50 * 1024, // 50KB
        SUPPORTED_LANGS: ["中文", "英文", "日文", "韓文", "法文", "德文", "西班牙文", "俄文"]
    };

    // 获取 DOM 元素
    const dom = {
        // 公共元素
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        
        // 文本翻译相關元素
        inputText: document.getElementById("inputText"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        
        // 图片翻译相關元素
        imageInput: document.getElementById("imageInput"),
        imageDropArea: document.getElementById("imageDropArea"),
        imageCanvas: document.getElementById("imageCanvas"),
        extractTextBtn: document.getElementById("extractTextButton"),
        translateExtractedBtn: document.getElementById("translateExtractedButton"),
        extractedText: document.getElementById("extractedText"),
        
        // 状态和错误
        error: document.createElement("div"), // 创建错误元素
        loader: document.createElement("div"), // 创建加载指示器
        statusText: document.createElement("div") // 创建状态文本
    };

    // 初始化
    function init() {
        // 设置错误显示和加载指示器
        setupUIElements();
        
        // 初始化标签页切换
        initTabs();
        
        // 初始化文本翻译功能
        initTextTranslation();
        
        // 初始化图片翻译功能
        initImageTranslation();
    }

    // 设置UI元素
    function setupUIElements() {
        // 添加错误显示元素
        dom.error.id = "error";
        dom.error.className = "error-message";
        dom.error.style.display = "none";
        dom.error.style.color = "#d9534f";
        dom.error.style.marginTop = "10px";
        dom.error.style.padding = "10px";
        dom.error.style.backgroundColor = "#f9f2f2";
        dom.error.style.borderRadius = "6px";
        document.querySelector(".container").appendChild(dom.error);
        
        // 添加加载指示器
        dom.loader.id = "loader";
        dom.loader.className = "loader";
        dom.loader.style.display = "none";
        dom.loader.style.width = "20px";
        dom.loader.style.height = "20px";
        dom.loader.style.border = "3px solid #f3f3f3";
        dom.loader.style.borderTop = "3px solid #8d6c61";
        dom.loader.style.borderRadius = "50%";
        dom.loader.style.animation = "spin 1s linear infinite";
        document.querySelector(".container").appendChild(dom.loader);
        
        // 添加状态文本
        dom.statusText.id = "statusText";
        dom.statusText.style.textAlign = "center";
        dom.statusText.style.margin = "10px 0";
        document.querySelector(".container").appendChild(dom.statusText);
        
        // 添加动画样式
        const style = document.createElement("style");
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // 初始化标签页切换
    function initTabs() {
        dom.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                // 移除所有标签页和内容的活动状态
                dom.tabs.forEach(t => t.classList.remove("active"));
                dom.tabContents.forEach(c => c.classList.remove("active"));
                
                // 设置当前标签页和内容为活动状态
                tab.classList.add("active");
                const tabId = tab.getAttribute("data-tab");
                document.getElementById(tabId).classList.add("active");
                
                // 清除错误和结果
                clearError();
                dom.result.textContent = "";
                dom.extractedText.textContent = "";
            });
        });
    }

    // 初始化文本翻译功能
    function initTextTranslation() {
        // 添加语言选择器
        const langContainer = document.createElement("div");
        langContainer.className = "language-selectors";
        langContainer.style.display = "flex";
        langContainer.style.gap = "10px";
        langContainer.style.alignItems = "center";
        langContainer.style.marginBottom = "10px";
        
        const sourceLang = createLanguageSelect("sourceLang", "從");
        const targetLang = createLanguageSelect("targetLang", "到");
        
        // 添加语言交换按钮
        const swapLang = document.createElement("button");
        swapLang.id = "swapLang";
        swapLang.innerHTML = "&#8644;";
        swapLang.title = "交換語言";
        swapLang.style.width = "40px";
        swapLang.style.padding = "7px";
        swapLang.style.margin = "0";
        
        langContainer.appendChild(sourceLang);
        langContainer.appendChild(swapLang);
        langContainer.appendChild(targetLang);
        
        // 添加文件上传按钮
        const fileInputContainer = document.createElement("div");
        fileInputContainer.style.marginBottom = "10px";
        
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "fileInput";
        fileInput.style.display = "none";
        
        const fileButton = document.createElement("button");
        fileButton.textContent = "上傳文件";
        fileButton.style.backgroundColor = "#a18778";
        fileButton.style.width = "auto";
        fileButton.onclick = () => fileInput.click();
        
        fileInputContainer.appendChild(fileInput);
        fileInputContainer.appendChild(fileButton);
        
        // 插入到DOM树
        const textTab = document.getElementById("textTab");
        textTab.insertBefore(langContainer, dom.inputText);
        textTab.insertBefore(fileInputContainer, dom.inputText);
        
        // 更新DOM元素引用
        dom.sourceLang = document.getElementById("sourceLang");
        dom.targetLang = document.getElementById("targetLang");
        dom.swapLang = document.getElementById("swapLang");
        dom.fileInput = document.getElementById("fileInput");
        
        // 添加事件监听器
        dom.translateBtn.addEventListener("click", handleTranslation);
        dom.fileInput.addEventListener("change", handleFileUpload);
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", handleInputValidation);
        
        // 初始化表单验证
        handleInputValidation();
    }
    
    // 创建语言选择下拉框
    function createLanguageSelect(id, label) {
        const container = document.createElement("div");
        container.style.flex = "1";
        
        const lbl = document.createElement("label");
        lbl.for = id;
        lbl.textContent = label;
        lbl.style.marginRight = "5px";
        
        const select = document.createElement("select");
        select.id = id;
        select.style.width = "100%";
        
        // 添加语言选项
        APP_CONFIG.SUPPORTED_LANGS.forEach(lang => {
            const option = document.createElement("option");
            option.value = lang;
            option.textContent = lang;
            select.appendChild(option);
        });
        
        // 设置默认值
        if (id === "sourceLang") {
            select.value = "中文";
        } else if (id === "targetLang") {
            select.value = "英文";
        }
        
        select.addEventListener("change", handleInputValidation);
        
        container.appendChild(lbl);
        container.appendChild(select);
        
        return container;
    }

    // 初始化图片翻译功能
    function initImageTranslation() {
        // 添加语言选择器
        const langContainer = document.createElement("div");
        langContainer.className = "language-selectors";
        langContainer.style.display = "flex";
        langContainer.style.gap = "10px";
        langContainer.style.alignItems = "center";
        langContainer.style.marginBottom = "10px";
        
        const imgSourceLang = createLanguageSelect("imgSourceLang", "識別語言");
        const imgTargetLang = createLanguageSelect("imgTargetLang", "翻譯到");
        
        langContainer.appendChild(imgSourceLang);
        langContainer.appendChild(imgTargetLang);
        
        // 插入到DOM树
        const imageTab = document.getElementById("imageTab");
        imageTab.insertBefore(langContainer, dom.imageInput);
        
        // 更新DOM元素引用
        dom.imgSourceLang = document.getElementById("imgSourceLang");
        dom.imgTargetLang = document.getElementById("imgTargetLang");
        
        // 设置图片拖放区域
        setupImageDropArea();
        
        // 添加事件监听器
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        dom.translateExtractedBtn.addEventListener("click", translateExtractedText);
    }
    
    // 设置图片拖放区域
    function setupImageDropArea() {
        dom.imageDropArea.addEventListener("click", () => dom.imageInput.click());
        
        dom.imageDropArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            dom.imageDropArea.classList.add("dragover");
        });
        
        dom.imageDropArea.addEventListener("dragleave", () => {
            dom.imageDropArea.classList.remove("dragover");
        });
        
        dom.imageDropArea.addEventListener("drop", (e) => {
            e.preventDefault();
            dom.imageDropArea.classList.remove("dragover");
            
            if (e.dataTransfer.files.length) {
                dom.imageInput.files = e.dataTransfer.files;
                handleImageUpload({target: {files: e.dataTransfer.files}});
            }
        });
        
        // 添加样式
        dom.imageDropArea.style.border = "2px dashed #b89b8c";
        dom.imageDropArea.style.borderRadius = "12px";
        dom.imageDropArea.style.padding = "40px 20px";
        dom.imageDropArea.style.textAlign = "center";
        dom.imageDropArea.style.backgroundColor = "#fdf7f0";
        dom.imageDropArea.style.cursor = "pointer";
        dom.imageDropArea.style.transition = "all 0.3s";
        dom.imageDropArea.style.marginBottom = "15px";
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
            const response = await fetchAPI(buildPrompt());
            const resultText = processResponse(response);
            dom.result.textContent = resultText; // 显示翻译结果
        } catch (error) {
            handleError(error);
        } finally {
            setLoadingState(false);
        }
    }

    // 发送 API 请求
    async function fetchAPI(prompt) {
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
                        content: prompt
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
        if (dom.sourceLang.value === dom.targetLang.value) {
            if (dom.sourceLang.value === "中文") {
                dom.targetLang.value = "英文";
            } else {
                dom.targetLang.value = "中文";
            }
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

    // 处理图片上传
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            showError("請上傳圖片文件");
            return;
        }
        
        // 清除已提取的文本
        dom.extractedText.textContent = "";
        dom.translateExtractedBtn.disabled = true;
        
        // 读取和显示图片
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 设置画布大小
                const canvas = dom.imageCanvas;
                const ctx = canvas.getContext('2d');
                
                // 计算适当的尺寸
                const maxWidth = 500;
                const maxHeight = 300;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }
                
                if (height > maxHeight) {
                    width = width * (maxHeight / height);
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                canvas.style.display = "block";
                canvas.style.margin = "15px auto";
                canvas.style.border = "1px solid #b89b8c";
                canvas.style.borderRadius = "8px";
                
                // 绘制图片
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // 启用提取按钮
                dom.extractTextBtn.disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // 从图片中提取文字
    async function extractTextFromImage() {
        clearError();
        setLoadingState(true, "正在識別文字...");
        
        try {
            // 设置 Tesseract 语言
            let tesseractLang = 'eng';
            switch (dom.imgSourceLang.value) {
                case '中文': tesseractLang = 'chi_tra'; break;
                case '日文': tesseractLang = 'jpn'; break;
                case '韓文': tesseractLang = 'kor'; break;
                case '德文': tesseractLang = 'deu'; break;
                case '法文': tesseractLang = 'fra'; break;
                case '西班牙文': tesseractLang = 'spa'; break;
                case '俄文': tesseractLang = 'rus'; break;
            }
            
            const result = await Tesseract.recognize(
                dom.imageCanvas,
                tesseractLang,
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            dom.statusText.textContent = `辨識中: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );
            
            const extractedText = result.data.text.trim();
            
            if (extractedText.length === 0) {
                throw new Error("未能識別出文字，請嘗試其他圖片或調整圖片清晰度");
            }
            
            dom.extractedText.textContent = extractedText;
            dom.translateExtractedBtn.disabled = false;
        } catch (error) {
            handleError(error);
            dom.translateExtractedBtn.disabled = true;
        } finally {
            setLoadingState(false);
        }
    }
    
    // 翻译提取的文字
    async function translateExtractedText() {
        clearError();
        
        const extractedText = dom.extractedText.textContent.trim();
        if (!extractedText) {
            showError("沒有可翻譯的文字");
            return;
        }
        
        setLoadingState(true, "翻譯中...");
        try {
            const prompt = `請將以下${dom.imgSourceLang.value}文本翻譯成${dom.imgTargetLang.value}，只返回翻譯結果：\n\n${extractedText}`;
            const response = await fetchAPI(prompt);
            const resultText = processResponse(response);
            
            // 显示翻译结果
            dom.extractedText.textContent = resultText;
        } catch (error) {
            handleError(error);
        } finally {
            setLoadingState(false);
        }
    }

    // 处理 API 响应
    function processResponse(data) {
        if (!data.choices?.[0]?.message?.content) {
            throw new Error("API回應格式錯誤");
        }
        return data.choices[0].message.content.trim();
    }

    // 设置加载状态
    function setLoadingState(isLoading, statusMessage = "處理中...") {
        dom.translateBtn.disabled = isLoading;
        dom.extractTextBtn.disabled = isLoading;
        dom.translateExtractedBtn.disabled = isLoading;
        dom.loader.style.display = isLoading ? "block" : "none";
        dom.statusText.textContent = isLoading ? statusMessage : "";
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
