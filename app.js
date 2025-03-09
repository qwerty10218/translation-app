document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
        TIMEOUT: 15000
    };

    const LANGUAGE_CODES = {
        "中文": "chi_tra",
        "英文": "eng",
        "日文": "jpn",
        "韓文": "kor",
        "法文": "fra",
        "德文": "deu",
        "西班牙文": "spa",
        "義大利文": "ita",
        "俄文": "rus"
    };

    // 獲取 DOM 元素
    const dom = {
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        inputText: document.getElementById("inputText"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        imageSourceLang: document.getElementById("imageSourceLang"),
        imageTargetLang: document.getElementById("imageTargetLang"),
        imageSwapLang: document.getElementById("imageSwapLang"),
        swapLang: document.getElementById("swapLang"),
        modelSelect: document.getElementById("modelSelect"),
        imageModelSelect: document.getElementById("imageModelSelect"),
        progressBar: document.getElementById("progressBar"),
        imageInput: document.getElementById("imageInput"),
        imageCanvas: document.getElementById("imageCanvas"),
        extractTextBtn: document.getElementById("extractTextButton"),
        translateExtractedBtn: document.getElementById("translateExtractedButton"),
        extractedText: document.getElementById("extractedText"),
        imageDropArea: document.getElementById("imageDropArea"),
        clearTextButton: document.getElementById("clearTextButton"),
        copyResultButton: document.getElementById("copyResultButton"),
        clearResultButton: document.getElementById("clearResultButton"),
        imageTab: document.getElementById("imageTab")
    };

    function init() {
        initTabs();
        initTextTranslation();
        initImageTranslation();
        initDragAndDrop();
        initButtons();
        // 同步兩個頁面的語言選擇
        syncLanguageSelections();
        // 初始檢查翻譯按鈕狀態
        validateTranslationInput();
        validateImageTranslationInput();
        // 設置文本區域高度
        dom.inputText.style.height = "150px";
        // 默認禁用圖片相關按鈕
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
    }

    function syncLanguageSelections() {
        // 當文本翻譯的語言選項改變時也改變圖片翻譯的語言選項
        dom.sourceLang.addEventListener('change', () => {
            dom.imageSourceLang.value = dom.sourceLang.value;
            validateImageTranslationInput();
        });
        
        dom.targetLang.addEventListener('change', () => {
            dom.imageTargetLang.value = dom.targetLang.value;
            validateImageTranslationInput();
        });

        // 當圖片翻譯的語言選項改變時也改變文本翻譯的語言選項
        dom.imageSourceLang.addEventListener('change', () => {
            dom.sourceLang.value = dom.imageSourceLang.value;
            validateTranslationInput();
        });
        
        dom.imageTargetLang.addEventListener('change', () => {
            dom.targetLang.value = dom.imageTargetLang.value;
            validateTranslationInput();
        });
        
        // 同步模型選擇
        dom.modelSelect.addEventListener('change', () => {
            dom.imageModelSelect.value = dom.modelSelect.value;
        });
        
        dom.imageModelSelect.addEventListener('change', () => {
            dom.modelSelect.value = dom.imageModelSelect.value;
        });
    }

    function initButtons() {
        // 清除文本按鈕
        dom.clearTextButton.addEventListener("click", () => {
            dom.inputText.value = "";
            validateTranslationInput();
        });
        
        // 複製結果按鈕
        dom.copyResultButton.addEventListener("click", () => {
            if (dom.result.textContent) {
                navigator.clipboard.writeText(dom.result.textContent)
                    .then(() => showToast("已複製到剪貼簿"))
                    .catch(err => showToast("複製失敗: " + err, true));
            }
        });
        
        // 清除結果按鈕
        dom.clearResultButton.addEventListener("click", () => {
            dom.result.textContent = "";
        });
    }

    function initTabs() {
        dom.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                dom.tabs.forEach(t => t.classList.remove("active"));
                dom.tabContents.forEach(c => c.classList.remove("active"));
                tab.classList.add("active");
                document.getElementById(tab.getAttribute("data-tab")).classList.add("active");
            });
        });
    }

    function initTextTranslation() {
        // 修正: 不直接傳遞事件對象，而是使用箭頭函數
        dom.translateBtn.addEventListener("click", () => handleTranslation());
        dom.swapLang.addEventListener("click", () => swapLanguages(dom.sourceLang, dom.targetLang));
        dom.inputText.addEventListener("input", validateTranslationInput);
        
        // 語言選擇改變時檢查翻譯按鈕狀態
        dom.sourceLang.addEventListener("change", validateTranslationInput);
        dom.targetLang.addEventListener("change", validateTranslationInput);
    }

    function swapLanguages(sourceSelect, targetSelect) {
        [sourceSelect.value, targetSelect.value] = [targetSelect.value, sourceSelect.value];
        validateTranslationInput();
        validateImageTranslationInput();
    }

    function validateTranslationInput() {
        const textInput = dom.inputText.value.trim();
        const sourceLang = dom.sourceLang.value;
        const targetLang = dom.targetLang.value;
        
        // 檢查輸入是否為空以及源語言和目標語言是否相同
        const sameLanguage = sourceLang === targetLang;
        
        // 如果源語言和目標語言相同，禁用翻譯按鈕
        if (sameLanguage) {
            dom.translateBtn.disabled = true;
            // 可以添加提示信息
            dom.translateBtn.title = "源語言和目標語言不能相同";
            
            // 如果需要，可以添加視覺提示
            dom.targetLang.classList.add("error-select");
        } else {
            // 正常檢查輸入是否為空
            dom.translateBtn.disabled = !textInput;
            dom.translateBtn.title = textInput ? "" : "請輸入要翻譯的內容";
            
            // 移除可能的錯誤樣式
            dom.targetLang.classList.remove("error-select");
        }
    }

    function validateImageTranslationInput() {
        const sourceLang = dom.imageSourceLang.value;
        const targetLang = dom.imageTargetLang.value;
        
        // 檢查源語言和目標語言是否相同
        const sameLanguage = sourceLang === targetLang;
        
        // 如果源語言和目標語言相同，禁用翻譯按鈕
        if (sameLanguage) {
            dom.translateExtractedBtn.disabled = true;
            dom.translateExtractedBtn.title = "源語言和目標語言不能相同";
            dom.imageTargetLang.classList.add("error-select");
        } else {
            const hasExtractedText = dom.extractedText && dom.extractedText.textContent && 
                                    !dom.extractedText.textContent.includes("識別中...") && 
                                    !dom.extractedText.textContent.includes("識別失敗") && 
                                    !dom.extractedText.textContent.includes("未能識別出文字");
            
            dom.translateExtractedBtn.disabled = !hasExtractedText;
            dom.translateExtractedBtn.title = hasExtractedText ? "" : "請先識別圖片文字";
            
            // 移除可能的錯誤樣式
            dom.imageTargetLang.classList.remove("error-select");
        }
    }

    async function handleTranslation(extractedText = null) {
        // 確保 extractedText 是字符串而不是事件對象
        if (extractedText && typeof extractedText === 'object' && extractedText.type === 'click') {
            extractedText = null; // 如果是事件對象，設為 null，使用輸入框中的文本
        }
        
        // 判斷是從哪個標籤頁調用的，並選擇相應的語言和模型
        const isFromImageTab = dom.tabs[1].classList.contains('active');
        
        const text = extractedText || dom.inputText.value.trim();
        if (!text) {
            showToast("請輸入要翻譯的內容", true);
            return;
        }
        
        const sourceLang = isFromImageTab ? dom.imageSourceLang.value : dom.sourceLang.value;
        const targetLang = isFromImageTab ? dom.imageTargetLang.value : dom.targetLang.value;
        const model = isFromImageTab ? dom.imageModelSelect.value : dom.modelSelect.value;
        
        // 再次檢查源語言和目標語言是否相同
        if (sourceLang === targetLang) {
            showToast("源語言和目標語言不能相同", true);
            return;
        }

        dom.result.textContent = "翻譯中...";
        showProgressBar();

        try {
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{
                        role: "user",
                        content: `請專業地將以下 ${sourceLang} 文本翻譯成 ${targetLang}，保持原文格式：\n\n${text}`
                    }],
                    timeout: API_CONFIG.TIMEOUT
                }),
                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            dom.result.textContent = data.choices?.[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            dom.result.textContent = `請求失敗：${error.message}`;
        } finally {
            hideProgressBar();
        }
    }

    function showProgressBar() {
        // 重置並顯示進度條
        dom.progressBar.style.width = "0%";
        dom.progressBar.parentElement.style.display = "block";
        
        // 開始進度條動畫
        let progress = 0;
        progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            dom.progressBar.style.width = `${progress}%`;
        }, 300);
    }

    function hideProgressBar() {
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        dom.progressBar.style.width = "100%";
        setTimeout(() => {
            dom.progressBar.parentElement.style.display = "none";
            dom.progressBar.style.width = "0%";
        }, 500);
    }

    function initImageTranslation() {
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        dom.translateExtractedBtn.addEventListener("click", () => {
            if (dom.extractedText && dom.extractedText.textContent) {
                translateExtractedText();
            }
        });
        
        // 圖片標籤頁的語言切換
        dom.imageSwapLang.addEventListener("click", () => {
            swapLanguages(dom.imageSourceLang, dom.imageTargetLang);
        });
        
        // 圖片標籤頁的語言選擇器事件
        dom.imageSourceLang.addEventListener("change", validateImageTranslationInput);
        dom.imageTargetLang.addEventListener("change", validateImageTranslationInput);
    }

    function initDragAndDrop() {
        const dropArea = dom.imageDropArea;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.add('highlight');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('highlight');
            }, false);
        });

        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file && file.type.startsWith('image/')) {
                dom.imageInput.files = dt.files;
                processImageFile(file);
            } else {
                showToast("請上傳圖片文件", true);
            }
        }, false);

        dropArea.addEventListener('click', () => {
            dom.imageInput.click();
        });
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            showToast("請上傳圖片文件", true);
            return;
        }

        processImageFile(file);
    }

    function processImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = dom.imageCanvas;
                canvas.style.display = "block";
                
                // 調整畫布尺寸，保持比例但不超過容器
                const maxWidth = canvas.parentElement.clientWidth - 20;
                const maxHeight = 400; // 限制最大高度
                let width = img.width;
                let height = img.height;
                
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                if (ratio < 1) {
                    width = width * ratio;
                    height = height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                dom.extractTextBtn.disabled = false;
                
                // 圖片載入後，隱藏拖放區域以節省空間
                dom.imageDropArea.style.display = "none";
                
                // 添加清除圖片的按鈕
                if (!document.getElementById("clearImageButton")) {
                    const clearButton = document.createElement("button");
                    clearButton.id = "clearImageButton";
                    clearButton.className = "button secondary-button";
                    clearButton.textContent = "清除圖片";
                    clearButton.addEventListener("click", clearImage);
                    
                    const buttonContainer = canvas.parentElement.querySelector(".button-container");
                    buttonContainer.appendChild(clearButton);
                }
            };
            img.onerror = () => showToast("圖片載入失敗，請使用其他圖片", true);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function clearImage() {
        // 清除畫布
        const canvas = dom.imageCanvas;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = "none";
        
        // 重置文件輸入
        dom.imageInput.value = "";
        
        // 重新顯示拖放區域
        dom.imageDropArea.style.display = "flex";
        
        // 清除提取的文本
        if (dom.extractedText) {
            dom.extractedText.textContent = "";
            dom.extractedText.style.display = "none";
        }
        
        // 禁用按鈕
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        
        // 移除清除圖片按鈕
        const clearButton = document.getElementById("clearImageButton");
        if (clearButton) {
            clearButton.remove();
        }
    }

    async function extractTextFromImage() {
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        
        // 檢查是否有圖片
        if (!dom.imageCanvas.width) {
            showToast("請先上傳圖片", true);
            dom.extractTextBtn.disabled = false;
            return;
        }
        
        // 創建或獲取 extractedText 元素
        if (!dom.extractedText) {
            dom.extractedText = document.createElement("div");
            dom.extractedText.id = "extractedText";
            dom.extractedText.className = "extracted-text";
            dom.imageTab.appendChild(dom.extractedText);
        }
        
        dom.extractedText.textContent = "識別中...";
        dom.extractedText.style.display = "block";

        try {
            // 顯示進度條
            const progressContainer = document.createElement("div");
            progressContainer.className = "ocr-progress-container";
            const progressBar = document.createElement("div");
            progressBar.className = "ocr-progress-bar";
            progressContainer.appendChild(progressBar);
            dom.imageTab.appendChild(progressContainer);

            // 獲取當前選擇的語言
            const sourceLang = dom.imageSourceLang.value;
            let langCode = LANGUAGE_CODES[sourceLang] || "eng";
            
            // 對於中文，可能需要添加英文支持以提高準確性
            if (langCode === "chi_tra") {
                langCode = "chi_tra+eng";
            }

            // 通過預處理增強圖片識別
            const preprocessedCanvas = preprocessImage(dom.imageCanvas);

            // 設置 Tesseract 進度回調
            const { createWorker } = Tesseract;
            const worker = await createWorker({
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        progressBar.style.width = `${progress.progress * 100}%`;
                    }
                }
            });

            await worker.loadLanguage(langCode);
            await worker.initialize(langCode);
            
            // 設置更多的OCR引擎參數以提高準確性
            const { data } = await worker.recognize(preprocessedCanvas, {
                tessedit_pageseg_mode: 6, // 假定一個统一的块型文本
                tessedit_ocr_engine_mode: 3, // 使用LSTM引擎
                preserve_interword_spaces: '1', // 保留單詞之間的空格
                user_defined_dpi: '300' // 設置較高的DPI以提高準確性
            });
            
            await worker.terminate();

            // 移除進度條
            progressContainer.remove();

            // 清理文本：合併多個換行，去除首尾空格
            const cleanedText = data.text.replace(/(\r\n|\n|\r){2,}/gm, "\n").trim();
            
            dom.extractedText.textContent = cleanedText || "未能識別出文字";
            dom.translateExtractedBtn.disabled = !cleanedText;
            
            // 檢查翻譯按鈕狀態
            validateImageTranslationInput();
        } catch (error) {
            dom.extractedText.textContent = `識別失敗：${error.message}`;
        } finally {
            dom.extractTextBtn.disabled = false;
        }
    }

    // 圖片預處理以提高OCR效果
    function preprocessImage(canvas) {
        const ctx = canvas.getContext("2d");
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // 創建一個新的畫布用於預處理後的圖像
        const processedCanvas = document.createElement("canvas");
        processedCanvas.width = canvas.width;
        processedCanvas.height = canvas.height;
        const processedCtx = processedCanvas.getContext("2d");
        
        // 圖像二值化處理
        for (let i = 0; i < data.length; i += 4) {
            const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            const threshold = 150;
            
            // 二值化處理
            const value = brightness > threshold ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = value;
        }
        
        processedCtx.putImageData(imgData, 0, 0);
        
        // 進行銳化處理
        processedCtx.filter = 'contrast(1.4) saturate(0) brightness(1.1)';
        processedCtx.drawImage(canvas, 0, 0);
        
        return processedCanvas;
    }
    
    async function translateExtractedText() {
        if (!dom.extractedText) {
            showToast("請先識別圖片文字", true);
            return;
        }

        const extractedText = dom.extractedText.textContent.trim();
        if (!extractedText || extractedText === "識別中..." || extractedText.startsWith("識別失敗") || extractedText === "未能識別出文字") {
            showToast("沒有可翻譯的文字", true);
            return;
        }

        // 圖片翻譯也需要檢查源語言和目標語言是否相同
        if (dom.imageSourceLang.value === dom.imageTargetLang.value) {
            showToast("源語言和目標語言不能相同", true);
            return;
        }

        // 確保我們傳遞的是文本而不是事件
        await handleTranslation(extractedText);
    }
    
    // 顯示提示消息
    function showToast(message, isError = false) {
        // 檢查是否已有toast，如果有，先移除它
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 顯示動畫
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 3秒後消失
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // 全局變量存儲進度條定時器
    let progressInterval;
    
    init();
});
