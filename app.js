document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
        TIMEOUT: 15000
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
        imgSourceLang: document.getElementById("imgSourceLang"),
        imgTargetLang: document.getElementById("imgTargetLang"),
        swapLang: document.getElementById("swapLang"),
        imgSwapLang: document.getElementById("imgSwapLang"),
        modelSelect: document.getElementById("modelSelect"),
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
        initLanguageSelects();
        
        // 初始檢查翻譯按鈕狀態
        validateTranslationInput();
        validateImageLangSelections();
        
        // 默認禁用圖片相關按鈕
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
    }

    function initLanguageSelects() {
        // 為每個語言選擇器設置同語言禁用功能
        disableSameLanguageOptions(dom.sourceLang, dom.targetLang);
        disableSameLanguageOptions(dom.imgSourceLang, dom.imgTargetLang);
    }

    function disableSameLanguageOptions(sourceSelect, targetSelect) {
        // 當源語言改變時更新目標語言的禁用選項
        sourceSelect.addEventListener("change", () => {
            updateDisabledOptions(sourceSelect, targetSelect);
        });

        // 當目標語言改變時更新源語言的禁用選項
        targetSelect.addEventListener("change", () => {
            updateDisabledOptions(targetSelect, sourceSelect);
        });

        // 初始設置禁用
        updateDisabledOptions(sourceSelect, targetSelect);
        updateDisabledOptions(targetSelect, sourceSelect);
    }

    function updateDisabledOptions(select1, select2) {
        const selectedValue = select1.value;
        
        // 重置所有選項
        Array.from(select2.options).forEach(option => {
            option.disabled = false;
        });
        
        // 禁用相同語言的選項
        const sameOption = Array.from(select2.options).find(option => option.value === selectedValue);
        if (sameOption) {
            sameOption.disabled = true;
        }
        
        // 如果當前選中的選項被禁用，則選擇第一個非禁用選項
        if (select2.value === selectedValue) {
            const firstEnabledOption = Array.from(select2.options).find(option => !option.disabled);
            if (firstEnabledOption) {
                select2.value = firstEnabledOption.value;
            }
        }

        // 更新翻譯按鈕狀態
        validateTranslationInput();
        validateImageLangSelections();
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
                    .catch(err => showToast("複製失敗: " + err));
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
        dom.translateBtn.addEventListener("click", async () => {
            const text = dom.inputText.value.trim();
            const sourceLang = dom.sourceLang.value;
            const targetLang = dom.targetLang.value;
            const model = dom.modelSelect.value;
            
            if (text) {
                // 開始翻譯前的UI更新
                dom.translateBtn.disabled = true;
                dom.result.textContent = "翻譯中...";
                document.querySelector(".progress-container").style.display = "block";
                updateProgress(10);
                
                try {
                    const translatedText = await translateText(text, sourceLang, targetLang, model);
                    updateProgress(100);
                    
                    // 顯示翻譯結果
                    dom.result.textContent = translatedText;
                    showToast("翻譯完成");
                } catch (error) {
                    dom.result.textContent = `翻譯出錯: ${error.message}`;
                    showToast("翻譯失敗");
                } finally {
                    // 恢復UI狀態
                    dom.translateBtn.disabled = false;
                    setTimeout(() => {
                        document.querySelector(".progress-container").style.display = "none";
                        updateProgress(0);
                    }, 500);
                }
            }
        });
        
        // 在輸入框變化時檢查翻譯按鈕狀態
        dom.inputText.addEventListener("input", validateTranslationInput);
        
        // 語言交換按鈕
        dom.swapLang.addEventListener("click", () => {
            const tempLang = dom.sourceLang.value;
            dom.sourceLang.value = dom.targetLang.value;
            dom.targetLang.value = tempLang;
            
            // 更新禁用選項
            updateDisabledOptions(dom.sourceLang, dom.targetLang);
            updateDisabledOptions(dom.targetLang, dom.sourceLang);
        });
    }
    
    function validateTranslationInput() {
        const text = dom.inputText.value.trim();
        const sourceLang = dom.sourceLang.value;
        const targetLang = dom.targetLang.value;
        
        // 檢查文本是否為空以及源語言和目標語言是否相同
        const isValid = text.length > 0 && sourceLang !== targetLang;
        dom.translateBtn.disabled = !isValid;
        
        // 如果語言相同，突出顯示選擇器
        if (sourceLang === targetLang) {
            dom.sourceLang.classList.add("error-select");
            dom.targetLang.classList.add("error-select");
            setTimeout(() => {
                dom.sourceLang.classList.remove("error-select");
                dom.targetLang.classList.remove("error-select");
            }, 1000);
        }
        
        return isValid;
    }
    
    function validateImageLangSelections() {
        const sourceLang = dom.imgSourceLang.value;
        const targetLang = dom.imgTargetLang.value;
        
        // 檢查源語言和目標語言是否相同
        const isValid = sourceLang !== targetLang;
        
        // 如果有擷取的文字且語言選擇有效，啟用翻譯按鈕
        dom.translateExtractedBtn.disabled = !(isValid && dom.extractedText.textContent.trim().length > 0);
        
        // 如果語言相同，突出顯示選擇器
        if (sourceLang === targetLang) {
            dom.imgSourceLang.classList.add("error-select");
            dom.imgTargetLang.classList.add("error-select");
            setTimeout(() => {
                dom.imgSourceLang.classList.remove("error-select");
                dom.imgTargetLang.classList.remove("error-select");
            }, 1000);
        }
        
        return isValid;
    }
    
    function initImageTranslation() {
        // 圖片下拉區域點擊事件
        dom.imageDropArea.addEventListener("click", () => {
            dom.imageInput.click();
        });
        
        // 文件選擇變更事件
        dom.imageInput.addEventListener("change", handleImageSelection);
        
        // 語言交換按鈕
        dom.imgSwapLang.addEventListener("click", () => {
            const tempLang = dom.imgSourceLang.value;
            dom.imgSourceLang.value = dom.imgTargetLang.value;
            dom.imgTargetLang.value = tempLang;
            
            // 更新禁用選項
            updateDisabledOptions(dom.imgSourceLang, dom.imgTargetLang);
            updateDisabledOptions(dom.imgTargetLang, dom.imgSourceLang);
        });
        
        // 擷取文字按鈕
        dom.extractTextBtn.addEventListener("click", async () => {
            const canvas = dom.imageCanvas;
            if (canvas.style.display === "block") {
                dom.extractTextBtn.disabled = true;
                dom.extractTextBtn.textContent = "擷取中...";
                dom.extractedText.textContent = "正在處理圖片...";
                dom.extractedText.style.display = "block";
                
                try {
                    const lang = getTesseractLangCode(dom.imgSourceLang.value);
                    const text = await extractTextFromCanvas(canvas, lang);
                    dom.extractedText.textContent = text;
                    
                    // 啟用翻譯按鈕，如果有擷取的文字且語言選擇有效
                    dom.translateExtractedBtn.disabled = !(text.trim().length > 0 && validateImageLangSelections());
                    
                    showToast("文字擷取完成");
                } catch (error) {
                    dom.extractedText.textContent = `文字擷取失敗: ${error.message}`;
                    showToast("文字擷取失敗");
                } finally {
                    dom.extractTextBtn.textContent = "擷取文字";
                    dom.extractTextBtn.disabled = false;
                }
            }
        });
        
        // 翻譯擷取文字按鈕
        dom.translateExtractedBtn.addEventListener("click", async () => {
            const text = dom.extractedText.textContent.trim();
            const sourceLang = dom.imgSourceLang.value;
            const targetLang = dom.imgTargetLang.value;
            const model = dom.modelSelect.value;
            
            if (text && validateImageLangSelections()) {
                // 開始翻譯前的UI更新
                dom.translateExtractedBtn.disabled = true;
                dom.result.textContent = "翻譯中...";
                document.querySelector(".progress-container").style.display = "block";
                updateProgress(10);
                
                try {
                    const translatedText = await translateText(text, sourceLang, targetLang, model);
                    updateProgress(100);
                    
                    // 顯示翻譯結果
                    dom.result.textContent = translatedText;
                    showToast("翻譯完成");
                } catch (error) {
                    dom.result.textContent = `翻譯出錯: ${error.message}`;
                    showToast("翻譯失敗");
                } finally {
                    // 恢復UI狀態
                    dom.translateExtractedBtn.disabled = false;
                    setTimeout(() => {
                        document.querySelector(".progress-container").style.display = "none";
                        updateProgress(0);
                    }, 500);
                }
            }
        });
        
        // 語言選擇變更事件
        dom.imgSourceLang.addEventListener("change", validateImageLangSelections);
        dom.imgTargetLang.addEventListener("change", validateImageLangSelections);
    }
    
    function initDragAndDrop() {
        // 拖放區域事件
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
            const files = dt.files;
            if (files.length > 0 && files[0].type.match('image.*')) {
                handleImageFile(files[0]);
            } else {
                showToast("請選擇有效的圖片檔案");
            }
        }, false);
    }
    
    // 處理圖片選擇
    function handleImageSelection(e) {
        const files = e.target.files;
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    }
    
    // 處理圖片文件
    function handleImageFile(file) {
        if (!file.type.match('image.*')) {
            showToast("請選擇有效的圖片檔案");
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = dom.imageCanvas;
                const ctx = canvas.getContext('2d');
                
                // 調整畫布大小，保持原始比例但最大寬度為容器寬度
                const maxWidth = dom.imageTab.clientWidth;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // 顯示畫布並啟用擷取按鈕
                canvas.style.display = "block";
                dom.extractTextBtn.disabled = false;
                dom.extractedText.style.display = "none"; // 重置擷取結果
                dom.translateExtractedBtn.disabled = true;
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }
    
    // 從畫布擷取文字 (OCR)
    async function extractTextFromCanvas(canvas, lang) {
        return new Promise((resolve, reject) => {
            Tesseract.recognize(
                canvas,
                lang,
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            const progress = m.progress * 100;
                            updateProgress(progress);
                        }
                    }
                }
            ).then(({ data: { text } }) => {
                resolve(text.trim());
            }).catch(err => {
                reject(err);
            });
        });
    }
    
    // 翻譯文字 API
        const MODEL_CONTEXT_LIMITS = {
            "gpt-3.5-turbo": 4096,
            "gpt-4": 8192,
            "gpt-4-32k": 32768,
            "gpt-4-turbo": 128000
        };
       async function translateText(text, sourceLang, targetLang, model) {
        try {
            updateProgress(30);
            
            const prompt = `請將以下${sourceLang}文本翻譯成${targetLang}...`;
            const maxContext = MODEL_CONTEXT_LIMITS[model] || 4096;
            const estimatedInputTokens = Math.ceil(text.length * 2); // 修改后的估算方式
            const maxTokens = Math.max(512, maxContext - estimatedInputTokens);

            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.KEY}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: maxTokens
                }),
                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
            });
    async function translateText(text, sourceLang, targetLang, model) {
        try {
            updateProgress(30);
            
            const prompt = `請將以下${sourceLang}文本翻譯成${targetLang}，只需要輸出翻譯結果，不要加任何解釋或說明：\n\n${text}`;
            const maxContext = MODEL_CONTEXT_LIMITS[model] || 4096;
            const estimatedInputTokens = Math.ceil(text.length * 1.5);
            const maxTokens = Math.max(512, maxContext - estimatedInputTokens);

            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.KEY}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: maxTokens
                }),
                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
            });
            
            updateProgress(70);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "API 請求失敗");
            }
            
            const data = await response.json();
            const translatedText = data.choices[0].message.content.trim();
            
            return translatedText;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("請求超時，請稍後再試");
            }
            throw error;
        }
    }
    
    // 獲取 Tesseract 語言代碼
    function getTesseractLangCode(language) {
        const langMap = {
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
        
        return langMap[language] || "eng";
    }
    
    // 更新進度條
    function updateProgress(percent) {
        dom.progressBar.style.width = `${percent}%`;
    }
    
    // 顯示 Toast 提示
    function showToast(message) {
        let toast = document.querySelector(".toast");
        
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.classList.add("show");
        
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }
    
    // 初始化應用
    init();
});
