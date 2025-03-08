document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827", // 这里不要暴露真实 API Key
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

    // 存储OCR识别到的文本和区域信息
    let textRegions = [];
    let originalImage = null;

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
        
        // 添加翻译叠加层
        dom.overlayContainer = document.createElement("div");
        dom.overlayContainer.id = "overlayContainer";
        dom.overlayContainer.className = "image-overlay-container";
        document.getElementById("imageTab").insertBefore(dom.overlayContainer, dom.extractedText);
        
        // 添加动画样式
        const style = document.createElement("style");
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .image-overlay-container {
                position: relative;
                margin: 15px 0;
                display: none;
            }
            
            .translation-overlay {
                position: absolute;
                background: rgba(255, 255, 255, 0.8);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 14px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                pointer-events: none;
                border: 1px solid #8d6c61;
                color: #5c4a3d;
                max-width: 90%;
                overflow-wrap: break-word;
            }
            
            .image-drop-area.dragover {
                background-color: #f0e4d7;
                border-color: #8d6c61;
            }
            
            #imageCanvas {
                display: none;
                max-width: 100%;
                height: auto;
            }
            
            .btn-group {
                display: flex;
                gap: 10px;
                margin: 10px 0;
            }
            
            .btn-group button {
                flex: 1;
            }
            
            .text-transfer-container {
                display: flex;
                align-items: center;
                margin-top: 10px;
                background: #fdf7f0;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #b89b8c;
            }
            
            .text-transfer-container button {
                width: auto;
                white-space: nowrap;
                margin: 0 0 0 10px;
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
        
        // 添加粘贴事件处理
        document.addEventListener("paste", handlePaste);
        
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
        
        // 创建按钮组
        const btnGroup = document.createElement("div");
        btnGroup.className = "btn-group";
        
        // 移动提取和翻译按钮到按钮组
        imageTab.removeChild(dom.extractTextBtn);
        imageTab.removeChild(dom.translateExtractedBtn);
        btnGroup.appendChild(dom.extractTextBtn);
        btnGroup.appendChild(dom.translateExtractedBtn);
        
        // 添加显示模式切换按钮
        const toggleOverlayBtn = document.createElement("button");
        toggleOverlayBtn.id = "toggleOverlayBtn";
        toggleOverlayBtn.className = "button";
        toggleOverlayBtn.textContent = "圖上顯示";
        toggleOverlayBtn.disabled = true;
        btnGroup.appendChild(toggleOverlayBtn);
        
        // 将按钮组添加到合适的位置
        imageTab.insertBefore(btnGroup, dom.extractedText);
        
        // 添加传输文本按钮
        const textTransferContainer = document.createElement("div");
        textTransferContainer.className = "text-transfer-container";
        
        const transferText = document.createElement("span");
        transferText.textContent = "要將識別出的文字傳輸到文本翻譯頁面嗎？";
        
        const transferBtn = document.createElement("button");
        transferBtn.id = "transferTextBtn";
        transferBtn.className = "button";
        transferBtn.textContent = "傳輸";
        transferBtn.disabled = true;
        
        textTransferContainer.appendChild(transferText);
        textTransferContainer.appendChild(transferBtn);
        imageTab.insertBefore(textTransferContainer, dom.extractedText);
        
        // 更新DOM元素引用
        dom.imgSourceLang = document.getElementById("imgSourceLang");
        dom.imgTargetLang = document.getElementById("imgTargetLang");
        dom.toggleOverlayBtn = document.getElementById("toggleOverlayBtn");
        dom.transferTextBtn = document.getElementById("transferTextBtn");
        
        // 设置图片拖放区域
        setupImageDropArea();
        
        // 添加事件监听器
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        dom.translateExtractedBtn.addEventListener("click", translateExtractedText);
        dom.toggleOverlayBtn.addEventListener("click", toggleOverlayDisplay);
        dom.transferTextBtn.addEventListener("click", transferTextToTextTab);
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
    
    // 处理粘贴事件
    function handlePaste(e) {
        // 获取活动标签页
        const activeTab = document.querySelector(".tab-content.active");
        const isImageTab = activeTab && activeTab.id === "imageTab";
        
        if (isImageTab && e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            let imageItem = null;
            
            // 查找剪贴板中的图像数据
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    imageItem = items[i];
                    break;
                }
            }
            
            // 如果找到图像数据，处理它
            if (imageItem) {
                e.preventDefault();
                const blob = imageItem.getAsFile();
                
                // 创建 File 对象并触发图像上传事件
                const file = new File([blob], "pasted-image.png", { type: blob.type });
                handleImageUpload({ target: { files: [file] } });
                
                showNotification("已從剪貼板粘貼圖片");
            }
        }
    }
    
    // 显示通知
    function showNotification(message) {
        const notification = document.createElement("div");
        notification.className = "notification";
        notification.textContent = message;
        notification.style.position = "fixed";
        notification.style.top = "20px";
        notification.style.right = "20px";
        notification.style.backgroundColor = "#8d6c61";
        notification.style.color = "white";
        notification.style.padding = "10px 15px";
        notification.style.borderRadius = "4px";
        notification.style.zIndex = "1000";
        notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = "0";
            notification.style.transition = "opacity 0.5s";
            setTimeout(() => document.body.removeChild(notification), 500);
        }, 3000);
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
        
        // 清除已提取的文本和翻译
        dom.extractedText.textContent = "";
        dom.translateExtractedBtn.disabled = true;
        dom.toggleOverlayBtn.disabled = true;
        dom.transferTextBtn.disabled = true;
        clearOverlays();
        
        // 读取和显示图片
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 保存原始图像以供OCR使用
                originalImage = img;
                
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
        
        // 清除任何先前的覆盖层
        clearOverlays();
        
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
                originalImage || dom.imageCanvas,
                tesseractLang,
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            dom.statusText.textContent = `辨識中: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );
            
            // 获取识别文本和区域
            textRegions = [];
            let extractedText = "";
            
            if (result.data.words && result.data.words.length > 0) {
                // 提取每个单词及其位置
                result.data.words.forEach(word => {
                    textRegions.push({
                        text: word.text,
                        bbox: word.bbox,
                        translated: "" // 将在翻译后填充
                    });
                    
                    extractedText += word.text + " ";
                });
                
                extractedText = extractedText.trim();
            } else {
                extractedText = result.data.text.trim();
            }
            
            if (extractedText.length === 0) {
                throw new Error("未能識別出文字，請嘗試其他圖片或調整圖片清晰度");
            }
            
            dom.extractedText.textContent = extractedText;
            dom.translateExtractedBtn.disabled = false;
            dom.transferTextBtn.disabled = false;
        } catch (error) {
            handleError(error);
            dom.translateExtractedBtn.disabled = true;
            dom.toggleOverlayBtn.disabled = true;
            dom.transferTextBtn.disabled = true;
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
            
            // 如果有识别到文本区域，则分配翻译结果
            if (textRegions.length > 0) {
                // 简单起见，我们将整个翻译结果设置为每个区域的翻译
                textRegions.forEach(region => {
                    region.translated = resultText;
                });
                
                // 启用覆盖层切换按钮
                dom.toggleOverlayBtn.disabled = false;
            }
        } catch (error) {
            handleError(error);
        } finally {
            setLoadingState(false);
        }
    }
    
    // 切换在图片上显示翻译结果
    function toggleOverlayDisplay() {
        const overlayContainer = dom.overlayContainer;
        
        if (overlayContainer.style.display === "block") {
            // 隐藏覆盖层
            overlayContainer.style.display = "none";
            dom.toggleOverlayBtn.textContent = "圖上顯示";
            return;
        }
        
        // 显示覆盖层
        overlayContainer.style.display = "block";
        dom.toggleOverlayBtn.textContent = "隱藏顯示";
        
        // 清除现有覆盖层
        clearOverlays();
        
        // 获取画布和图像的尺寸比例
        const canvas = dom.imageCanvas;
        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        
        // 设置覆盖容器的尺寸和位置，与画布保持一致
        overlayContainer.style.width = `${canvasRect.width}px`;
        overlayContainer.style.height = `${canvasRect.height}px`;
        overlayContainer.style.position = "relative";
        
        // 创建翻译覆盖层
        const translatedText = dom.extractedText.textContent;
        
        if (textRegions.length > 0) {
            // 为每个文本区域创建覆盖层
            textRegions.forEach(region => {
                if (!region.translated) return;
                
                const overlay = document.createElement("div");
                overlay.className = "translation-overlay";
                
                // 计算覆盖层位置
                const left = region.bbox.x0 / scaleX;
                const top = region.bbox.y0 / scaleY;
                const width = (region.bbox.x1 - region.bbox.x0) / scaleX;
                
                overlay.style.left = `${left}px`;
                overlay.style.top = `${top}px`;
                overlay.style.minWidth = `${width}px`;
                overlay.textContent = region.translated;
                
                overlayContainer.appendChild(overlay);
            });
        } else {
            // 如果没有区域信息，则创建一个居中的覆盖层
            const overlay = document.createElement("div");
