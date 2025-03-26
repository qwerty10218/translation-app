/**
 * 完全重寫版本 - 簡化核心功能，確保可靠運行
 */

// 添加API配置 - 移到全局作用域以解決初始化順序問題
const API_CONFIG = {
    // OpenAI API配置
    GPT: {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827"
    },
    // MyMemory API配置
    MYMEMORY: {
        URL: "https://api.mymemory.translated.net/get"
    }
};

// 等待頁面完全加載後初始化
document.addEventListener("DOMContentLoaded", () => {
    console.clear();
    console.log("⭐ 頁面加載完成，開始初始化應用...");
    
    // 定義全局變數表示API狀態
    let gptAPIAvailable = false;
    let myMemoryAPIAvailable = false;
    
    // 統一獲取所有DOM元素
    const dom = {
        // 標準翻譯元素
        standard: {
            inputText: document.getElementById("inputText"),
            result: document.getElementById("result"),
            translateButton: document.getElementById("translateButton"),
            sourceLang: document.getElementById("sourceLang"),
            targetLang: document.getElementById("targetLang"),
            swapLangButton: document.getElementById("swapLang"),
            clearTextButton: document.getElementById("clearTextButton"),
            copyResultButton: document.getElementById("copyResultButton"),
            clearResultButton: document.getElementById("clearResultButton")
        },
        // R18 翻譯元素
        r18: {
            inputText: document.getElementById("r18InputText"),
            result: document.getElementById("r18Result"),
            translateButton: document.getElementById("r18TranslateButton"),
            sourceLang: document.getElementById("r18SourceLang"),
            targetLang: document.getElementById("r18TargetLang"),
            swapLangButton: document.getElementById("r18SwapLang"),
            clearButton: document.getElementById("r18ClearButton"),
            copyButton: document.getElementById("r18CopyButton"),
            clearResultButton: document.getElementById("r18ClearResultButton"),
            progressContainer: document.getElementById("r18ProgressContainer"),
            adultCheckbox: document.getElementById("adultCheckbox"),
            profanityCheckbox: document.getElementById("profanityCheckbox"),
            violenceCheckbox: document.getElementById("violenceCheckbox")
        },
        // 主題和標籤頁元素
        theme: {
            themeToggle: document.getElementById("themeToggle"),
            themeOverlay: document.getElementById("themeTransitionOverlay")
        },
        tabs: {
            buttons: document.querySelectorAll(".tab-button"),
            contents: document.querySelectorAll(".tab-content")
        },
        image: {
            imageInput: document.getElementById("imageInput"),
            imageCanvas: document.getElementById("imageCanvas"),
            imageDropArea: document.getElementById("imageDropArea"),
            extractTextButton: document.getElementById("extractTextButton"),
            translateExtractedButton: document.getElementById("translateExtractedButton"),
            extractedText: document.getElementById("extractedText"),
            sourceLang: document.getElementById("imageSourceLang"),
            targetLang: document.getElementById("imageTargetLang"),
            swapLangButton: document.getElementById("imageSwapLang"),
            result: document.getElementById("imageTranslationResult")
        },
        voice: {
            sourceLang: document.getElementById("voiceSourceLang"),
            targetLang: document.getElementById("voiceTargetLang"),
            swapLangButton: document.getElementById("voiceSwapLang"),
            textArea: document.getElementById("voiceTextArea"),
            micButton: document.getElementById("voiceMicButton"),
            clearButton: document.getElementById("voiceClearButton"),
            result: document.getElementById("voiceResult"),
            translateButton: document.getElementById("voiceTranslateButton"),
            copyButton: document.getElementById("voiceCopyButton"),
            clearResultButton: document.getElementById("voiceClearResultButton"),
            progressContainer: document.getElementById("voiceProgressContainer"),
            progressBar: document.getElementById("voiceProgressBar"),
            status: document.getElementById("voiceStatus")
        }
    };
    
    // 保存DOM元素到全局變量
    window.dom = dom;
    
    // 初始化所有功能
    initAll();
    
    console.log("✅ 應用初始化完成");
    
    // 主函數 - 初始化所有功能
    function initAll() {
        console.log("初始化所有功能...");
        
        // 初始化主題
        initTheme();
        
        // 初始化標籤頁
        initTabs();
        
        // 初始化進度條
        initProgressBars();
        
        // 初始化翻譯功能
        initStandardTranslation();
        
        // 初始化R18翻譯功能
        initR18Translation();
        
        // 初始化圖片翻譯
        initImageTranslation();
        
        // 初始化語音翻譯
        initVoiceTranslation();
        
        // 初始化清理按鈕
        initCleanupButtons();
        
        // 初始化歷史記錄
        initHistory();
        
        // 初始化設置頁面
        initSettings();
        
        console.log("✅ 應用初始化完成");
    }
    
    // 初始化主題功能
    function initTheme() {
        console.log("初始化主題功能...");
        const { themeToggle, themeOverlay } = dom.theme;
        
        if (!themeToggle) {
            console.error("找不到主題切換按鈕");
            return;
        }
        
        // 應用保存的主題
        const savedTheme = localStorage.getItem("theme") || "light";
        console.log(`加載保存的主題: ${savedTheme}`);
        
        // 立即應用主題
        if (savedTheme === "dark") {
            document.body.classList.add("dark-theme");
        } else {
            document.body.classList.remove("dark-theme");
        }
        
        // 更新主題按鈕文本
        updateThemeButtonText();
        
        // 綁定主題切換事件
        themeToggle.addEventListener("click", toggleTheme);
        
        console.log("主題功能初始化完成");
    }
    
    // 切換主題
    function toggleTheme() {
        console.log("切換主題");
        const { themeToggle, themeOverlay } = dom.theme;
        const isDarkMode = document.body.classList.contains("dark-theme");
        
        // 添加過渡效果
        if (themeOverlay) {
            themeOverlay.className = "theme-transition-overlay";
            themeOverlay.classList.add(isDarkMode ? "dark-to-light" : "light-to-dark");
            themeOverlay.classList.add("active");
            
            setTimeout(() => {
                themeOverlay.classList.remove("active");
            }, 800);
        }
        
        // 切換主題類
        if (isDarkMode) {
            document.body.classList.remove("dark-theme");
            localStorage.setItem("theme", "light");
        } else {
            document.body.classList.add("dark-theme");
            localStorage.setItem("theme", "dark");
        }
        
        // 更新按鈕文本
        updateThemeButtonText();
        
        console.log(`主題已切換到: ${document.body.classList.contains("dark-theme") ? "深色" : "淺色"}`);
    }
    
    // 更新主題按鈕文本
    function updateThemeButtonText() {
        const themeToggle = dom.theme.themeToggle;
        if (!themeToggle) return;
        
        const isDarkMode = document.body.classList.contains("dark-theme");
        themeToggle.textContent = isDarkMode ? "☀️" : "🌙";
    }
    
    // 初始化標籤頁功能
    function initTabs() {
        console.log("初始化標籤頁功能...");
        const { buttons, contents } = dom.tabs;
        
        if (!buttons || buttons.length === 0) {
            console.error("找不到標籤頁按鈕");
            return;
        }
        
        buttons.forEach(button => {
            button.addEventListener("click", () => {
                // 移除所有活動標籤
                buttons.forEach(btn => btn.classList.remove("active"));
                contents.forEach(content => content.classList.remove("active"));
                
                // 啟用當前標籤
                button.classList.add("active");
                const tabId = button.getAttribute("data-tab");
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add("active");
                }
            });
        });
        
        // 預設激活第一個標籤
        if (buttons[0]) buttons[0].click();
        
        console.log("標籤頁功能初始化完成");
    }
    
    // 初始化進度條功能
    function initProgressBars() {
        console.log("重建進度條功能...");
        
        // 確保每個翻譯區域有進度條
        const tabIds = ['translationTab', 'r18Tab', 'imageTab', 'voiceTab'];
        
        tabIds.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (!tab) return;
            
            let progressContainer = tab.querySelector('.progress-container');
            
            // 如果不存在進度條容器，就創建一個
            if (!progressContainer) {
                progressContainer = document.createElement('div');
                progressContainer.className = 'progress-container';
                
                const progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                
                progressContainer.appendChild(progressBar);
                
                // 插入到標籤頁的第一個子元素位置
                if (tab.firstChild) {
                    tab.insertBefore(progressContainer, tab.firstChild);
                } else {
                    tab.appendChild(progressContainer);
                }
                
                console.log(`已為 ${tabId} 添加進度條`);
            }
        });
        
        // 添加進度條樣式 (以防CSS未正確加載)
        const style = document.createElement('style');
        style.textContent = `
            .progress-container {
                width: 100%;
                height: 6px;
                background-color: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 15px;
                display: none;
            }
            
            .progress-bar {
                height: 100%;
                width: 0;
                background-color: #8d6c61;
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            
            .dark-theme .progress-bar {
                background-color: #b89b8c;
            }
            
            .dark-theme .progress-container {
                background-color: #333;
            }
        `;
        document.head.appendChild(style);
        
        console.log("進度條功能重建完成");
    }
    
    // 初始化標準翻譯功能 - 整合GPT模型選擇
    function initStandardTranslation() {
        console.log("初始化標準翻譯功能...");
        const { 
            inputText, 
            result, 
            translateButton, 
            sourceLang, 
            targetLang, 
            swapLangButton,
            clearTextButton,
            copyResultButton,
            clearResultButton 
        } = dom.standard;
        
        if (!translateButton || !inputText || !result) {
            console.error("標準翻譯必要元素未找到");
            return;
        }
        
        // 獲取模型選擇下拉菜單
        const modelSelect = document.getElementById("modelSelect");
        
        // 獲取或創建進度條
        const progressContainer = document.querySelector('#translationTab .progress-container');
        
        translateButton.addEventListener("click", async () => {
            const text = inputText.value.trim();
            if (!text) {
                alert("請輸入要翻譯的文字");
                return;
            }
            
            const from = sourceLang.value;
            const to = targetLang.value;
            const model = modelSelect ? modelSelect.value : "gpt-3.5-turbo-0125";
            
            // 顯示進度條
            if (progressContainer) {
                progressContainer.style.display = "block";
                const progressBar = progressContainer.querySelector(".progress-bar");
                if (progressBar) progressBar.style.width = "10%";
            }
            
            result.textContent = "翻譯中...";
            result.classList.add("translating");
            
            try {
                console.log(`使用${model}翻譯中...`);
                
                // 更新進度條
                updateProgress(progressContainer, 30);
                
                // 呼叫GPT API
                const prompt = `請將以下${from === 'auto' ? '檢測到的語言' : from}文本翻譯成${to}，保持原文格式：\n\n${text}`;
                
                const response = await fetch(API_CONFIG.GPT.URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_CONFIG.GPT.KEY}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.3,
                        max_tokens: 2000
                    })
                });
                
                // 檢查API響應
                if (!response.ok) {
                    throw new Error(`API錯誤: ${response.status}`);
                }
                
                updateProgress(progressContainer, 60);
                
                const data = await response.json();
                
                if (data && data.choices && data.choices[0].message) {
                    const translatedText = data.choices[0].message.content.trim();
                    result.textContent = translatedText;
                    result.classList.remove("translating");
                    
                    // 添加到歷史記錄
                    addToHistory(text, translatedText, from, to);
                    
                    console.log("GPT翻譯完成");
                } else {
                    throw new Error("API返回了無效響應");
                }
            } catch (error) {
                console.error("GPT翻譯錯誤:", error);
                
                // 使用MyMemory作為備用
                try {
                    console.log("使用MyMemory API翻譯...");
                    
                    // 修正：確保語言代碼正確
                    // 對於auto，使用"auto"而不是空字符串
                    const fromCode = from === 'auto' ? 'auto' : from;
                    
                    const url = `${API_CONFIG.MYMEMORY.URL}?q=${encodeURIComponent(text)}&langpair=${fromCode}|${to}`;
                    
                    console.log("MyMemory API URL:", url);
                    
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`API返回錯誤: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    if (data.responseData && data.responseData.translatedText) {
                        const translatedText = data.responseData.translatedText;
                        result.textContent = translatedText;
                        result.classList.remove("translating");
                        
                        // 添加到歷史記錄
                        addToHistory(text, translatedText, from, to);
                        
                        console.log("備用翻譯完成");
                    } else if (data.responseStatus && data.responseStatus !== 200) {
                        throw new Error(data.responseDetails || "MyMemory API返回錯誤");
                    } else {
                        throw new Error("未收到有效翻譯結果");
                    }
                } catch (backupError) {
                    console.error("備用翻譯錯誤:", backupError);
                    result.textContent = `翻譯失敗: GPT API不可用，備用翻譯也失敗: ${backupError.message}`;
                    result.classList.remove("translating");
                }
            } finally {
                // 更新進度條
                updateProgress(progressContainer, 100);
                setTimeout(() => {
                    if (progressContainer) {
                        progressContainer.style.display = "none";
                        const progressBar = progressContainer.querySelector(".progress-bar");
                        if (progressBar) progressBar.style.width = "0";
                    }
                }, 500);
            }
        });
        
        // 綁定語言交換按鈕
        if (swapLangButton && sourceLang && targetLang) {
            swapLangButton.addEventListener("click", () => {
                if (sourceLang.value === "auto") {
                    alert("自動檢測語言無法交換位置");
                    return;
                }
                const temp = sourceLang.value;
                sourceLang.value = targetLang.value;
                targetLang.value = temp;
            });
        }
        
        console.log("標準翻譯功能初始化完成");
    }
    
    // 輔助函數: 更新進度條
    function updateProgress(container, percent) {
        if (!container) return;
        
        const progressBar = container.querySelector(".progress-bar");
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
    }

    // MyMemory翻譯函數 - 主要用於R18區域
    async function translateWithMyMemory(text, sourceLang, targetLang) {
        console.log("使用MyMemory API翻譯...");
        
        // 處理特殊語言代碼
        const sourceCode = sourceLang === "auto" ? "" : sourceLang;
        
        // 構建API URL - 簡化參數
        const url = `${API_CONFIG.MYMEMORY.URL}?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetLang}`;
        
        console.log("MyMemory API URL:", url);
        
        // 發送請求
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`MyMemory API錯誤: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.responseData && data.responseData.translatedText) {
            return data.responseData.translatedText;
        } else if (data.responseStatus && data.responseStatus !== 200) {
            throw new Error(data.responseDetails || "MyMemory API返回錯誤");
        } else {
            throw new Error("未收到有效翻譯結果");
        }
    }

    // API可用性檢查函數 - 使用與主翻譯函數相同的實現
    async function checkGPTAPI() {
        try {
            const response = await fetch(API_CONFIG.GPT.URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.GPT.KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo-0125",
                    messages: [
                        { role: "user", content: "hello" }
                    ],
                    max_tokens: 5
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error("GPT API檢查失敗:", error);
            return false;
        }
    }
    
    // 修改R18翻譯功能，移除提示詞
    function initR18Translation() {
        console.log("初始化R18翻譯功能...");
        const {
            inputText,
            result,
            translateButton,
            sourceLang,
            targetLang,
            swapLangButton,
            clearButton,
            copyButton,
            clearResultButton,
            progressContainer
        } = dom.r18;
        
        if (!translateButton || !inputText || !result) {
            console.error("R18翻譯必要元素未找到");
            return;
        }
        
        // 綁定翻譯按鈕事件
        translateButton.addEventListener("click", async () => {
            const text = inputText.value.trim();
            if (!text) {
                alert("請輸入要翻譯的文字");
                return;
            }
            
            const from = sourceLang.value;
            const to = targetLang.value;
            
            // 顯示進度條
            if (progressContainer) {
                progressContainer.style.display = "block";
                const progressBar = progressContainer.querySelector(".progress-bar");
                if (progressBar) progressBar.style.width = "10%";
            }
            
            result.textContent = "執行R18翻譯...";
            result.classList.add("translating");
            
            try {
                console.log("執行R18翻譯...");
                
                // 修正：當源語言為auto時，使用"auto"而非空字符串
                const fromCode = from === 'auto' ? 'auto' : from;
                const url = `${API_CONFIG.MYMEMORY.URL}?q=${encodeURIComponent(text)}&langpair=${fromCode}|${to}`;
                
                console.log("使用MyMemory API URL:", url);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`API返回錯誤: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data && data.responseData && data.responseData.translatedText) {
                    const translatedText = data.responseData.translatedText;
                    result.textContent = translatedText;
                    result.classList.remove("translating");
                    
                    // 添加到歷史記錄
                    addToHistory(text, translatedText, from, to, true);
                    
                    console.log("R18翻譯完成");
                } else {
                    throw new Error(data.responseDetails || "翻譯服務未返回有效結果");
                }
            } catch (error) {
                console.error("R18翻譯錯誤:", error);
                result.textContent = `翻譯失敗: ${error.message}`;
                result.classList.remove("translating");
            } finally {
                // 完成進度條
                if (progressContainer) {
                    const progressBar = progressContainer.querySelector(".progress-bar");
                    if (progressBar) {
                        progressBar.style.width = "100%";
                        setTimeout(() => {
                            progressContainer.style.display = "none";
                            progressBar.style.width = "0";
                        }, 500);
                    }
                }
            }
        });
        
        // 綁定複製按鈕
        if (copyButton) {
            copyButton.addEventListener("click", function() {
                copyToClipboard(result.textContent);
            });
        }
        
        // 綁定清理按鈕
        if (clearButton) {
            clearButton.addEventListener("click", function() {
                inputText.value = "";
            });
        }
        
        // 綁定清理結果按鈕
        if (clearResultButton) {
            clearResultButton.addEventListener("click", function() {
                result.textContent = "";
            });
        }
        
        // 綁定語言交換按鈕
        if (swapLangButton && sourceLang && targetLang) {
            swapLangButton.addEventListener("click", function() {
                if (sourceLang.value === "auto") {
                    alert("無法交換，源語言為自動檢測");
                    return;
                }
                
                const temp = sourceLang.value;
                sourceLang.value = targetLang.value;
                targetLang.value = temp;
            });
        }
        
        console.log("R18翻譯功能初始化完成");
    }
    
    // 初始化清理按鈕
    function initCleanupButtons() {
        console.log("初始化清理按鈕...");
        
        // 標準翻譯清理按鈕
        const {
            clearTextButton,
            copyResultButton,
            clearResultButton,
            inputText,
            result
        } = dom.standard;
        
        if (clearTextButton && inputText) {
            clearTextButton.addEventListener("click", () => {
                inputText.value = "";
                validateTranslation(dom.standard);
            });
        }
        
        if (copyResultButton && result) {
            copyResultButton.addEventListener("click", () => {
                if (result.textContent) {
                    copyToClipboard(result.textContent);
                }
            });
        }
        
        if (clearResultButton && result) {
            clearResultButton.addEventListener("click", () => {
                result.textContent = "";
            });
        }
        
        // R18翻譯清理按鈕
        const {
            clearButton,
            copyButton,
            clearResultButton: r18ClearResultButton,
            inputText: r18InputText,
            result: r18Result
        } = dom.r18;
        
        if (clearButton && r18InputText) {
            clearButton.addEventListener("click", () => {
                r18InputText.value = "";
                validateTranslation(dom.r18);
            });
        }
        
        if (copyButton && r18Result) {
            copyButton.addEventListener("click", () => {
                if (r18Result.textContent) {
                    copyToClipboard(r18Result.textContent);
                }
            });
        }
        
        if (r18ClearResultButton && r18Result) {
            r18ClearResultButton.addEventListener("click", () => {
                r18Result.textContent = "";
            });
        }
        
        console.log("清理按鈕初始化完成");
    }
    
    // 驗證翻譯輸入
    function validateTranslation(elements) {
        const { inputText, translateButton, sourceLang, targetLang } = elements;
        
        if (!inputText || !translateButton) return;
        
        const text = inputText.value.trim();
        const source = sourceLang ? sourceLang.value : "auto";
        const target = targetLang ? targetLang.value : "zh-TW";
        
        // 檢查輸入是否為空
        const isInputEmpty = text.length === 0;
        
        // 檢查源語言和目標語言是否相同
        const isSameLang = source === target && source !== "auto";
        
        // 更新翻譯按鈕狀態
        translateButton.disabled = isInputEmpty || isSameLang;
        
        // 添加視覺提示
        if (targetLang) {
            if (isSameLang) {
                targetLang.classList.add("error-select");
                translateButton.title = "源語言和目標語言不能相同";
            } else {
                targetLang.classList.remove("error-select");
                translateButton.title = isInputEmpty ? "請輸入要翻譯的文字" : "";
            }
        }
    }
    
    // 初始化圖片翻譯功能
    function initImageTranslation() {
        console.log("初始化圖片翻譯功能...");
        const {
            imageInput, 
            imageCanvas, 
            imageDropArea, 
            extractTextButton, 
            translateExtractedButton, 
            extractedText, 
            sourceLang, 
            targetLang, 
            swapLangButton, 
            result
        } = dom.image;
        
        if (!imageInput || !imageCanvas || !imageDropArea || !extractTextButton) {
            console.error("圖片翻譯必要元素未找到");
            return;
        }
        
        // 檢查Tesseract.js是否存在
        if (typeof Tesseract === 'undefined') {
            console.error("找不到Tesseract.js庫，嘗試動態加載");
            
            // 如果Tesseract未定義，動態添加腳本
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.2/dist/tesseract.min.js";
            script.onload = () => console.log("Tesseract.js已成功加載");
            script.onerror = () => console.error("無法加載Tesseract.js，圖片識別功能將不可用");
            document.head.appendChild(script);
        }
        
        // 確保有進度條
        let progressContainer = document.querySelector('#imageTab .progress-container');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            progressContainer.innerHTML = '<div class="progress-bar"></div>';
            
            const imageTab = document.getElementById('imageTab');
            if (imageTab) {
                imageTab.insertBefore(progressContainer, imageTab.firstChild);
            }
        }
        
        // 設置Canvas上下文
        const ctx = imageCanvas.getContext('2d');
        
        // 綁定文件選擇事件
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                displayImage(file);
            }
        });
        
        // 顯示圖片
        function displayImage(file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // 調整Canvas大小
                    imageCanvas.width = img.width;
                    imageCanvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        // 將語言代碼轉換為Tesseract支持的格式
        function mapLanguageCodeForTesseract(langCode) {
            const langMap = {
                'zh-TW': 'chi_tra',
                'zh-CN': 'chi_sim',
                'ja': 'jpn',
                'en': 'eng',
                'ko': 'kor',
                'fr': 'fra',
                'de': 'deu',
                'es': 'spa',
                'ru': 'rus'
            };
            
            return langMap[langCode] || 'eng';
        }
        
        // 修復提取文字功能
        extractTextButton.addEventListener('click', function() {
            if (imageCanvas.width === 0 || imageCanvas.height === 0) {
                alert("請先上傳圖片");
                return;
            }
            
            // 檢查Tesseract是否可用
            if (typeof Tesseract === 'undefined') {
                extractedText.textContent = "錯誤：OCR文字識別庫未載入。請刷新頁面後重試，或檢查網路連接。";
                return;
            }
            
            // 顯示進度條
            if (progressContainer) {
                progressContainer.style.display = "block";
                const progressBar = progressContainer.querySelector(".progress-bar");
                if (progressBar) progressBar.style.width = "10%";
            }
            
            extractedText.textContent = "正在提取文字，請稍候...";
            
            // 從Canvas獲取圖片數據
            const imageData = imageCanvas.toDataURL('image/png');
            
            try {
                // 安全調用Tesseract
                Tesseract.recognize(
                    imageData,
                    sourceLang.value === 'auto' ? 'eng+jpn+chi_tra' : mapLanguageCodeForTesseract(sourceLang.value),
                    { 
                        logger: function(info) {
                            console.log(info);
                            // 只在有progress屬性時更新進度條
                            if (info.status === 'recognizing text' && typeof info.progress === 'number') {
                                if (progressContainer) {
                                    const progressBar = progressContainer.querySelector(".progress-bar");
                                    if (progressBar) {
                                        progressBar.style.width = `${Math.floor(info.progress * 100)}%`;
                                    }
                                }
                            }
                        }
                    }
                ).then(function(result) {
                    // 確保結果有效
                    if (result && result.data && result.data.text) {
                        extractedText.textContent = result.data.text.trim();
                    } else {
                        extractedText.textContent = "未能識別文字，請嘗試不同的圖片或語言設置";
                    }
                    
                    // 隱藏進度條
                    if (progressContainer) {
                        progressContainer.style.display = "none";
                        const progressBar = progressContainer.querySelector(".progress-bar");
                        if (progressBar) progressBar.style.width = "0";
                    }
                }).catch(function(error) {
                    console.error("文字提取錯誤:", error);
                    extractedText.textContent = `提取文字失敗: ${error.message || '未知錯誤'}`;
                    
                    // 隱藏進度條
                    if (progressContainer) {
                        progressContainer.style.display = "none";
                        const progressBar = progressContainer.querySelector(".progress-bar");
                        if (progressBar) progressBar.style.width = "0";
                    }
                });
            } catch (error) {
                console.error("Tesseract調用錯誤:", error);
                extractedText.textContent = "OCR引擎調用失敗，請確保Tesseract.js已正確引入";
                
                // 隱藏進度條
                if (progressContainer) {
                    progressContainer.style.display = "none";
                }
            }
        });
        
        // 其他功能保持不變...
        
        console.log("圖片翻譯功能初始化完成");
    }

    // 初始化語音識別功能
    function initVoiceTranslation() {
        console.log("初始化語音識別功能...");
        
        const { 
            sourceLang, 
            targetLang, 
            swapLangButton, 
            textArea, 
            micButton, 
            clearButton, 
            result, 
            translateButton, 
            copyButton, 
            clearResultButton, 
            progressContainer,
            status 
        } = dom.voice;
        
        // 初始化語音識別對象
        let recognition = null;
        let isRecording = false;
        
        // 檢查瀏覽器是否支持語音識別
        if ('webkitSpeechRecognition' in window) {
            // 創建語音識別對象
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            
            // 設置識別語言
            recognition.lang = sourceLang.value;
            
            // 識別結束時的事件
            recognition.onend = function() {
                isRecording = false;
                micButton.classList.remove("recording");
                micButton.textContent = "開始錄音";
                status.textContent = "語音識別已停止";
            };
            
            // 識別結果事件
            recognition.onresult = function(event) {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                // 更新文本區域
                if (finalTranscript) {
                    textArea.value = textArea.value + finalTranscript + ' ';
                }
                
                // 顯示臨時結果
                if (interimTranscript) {
                    status.textContent = "正在聽取: " + interimTranscript;
                }
            };
            
            // 錯誤處理
            recognition.onerror = function(event) {
                console.error("語音識別錯誤:", event.error);
                status.textContent = "錯誤: " + event.error;
                isRecording = false;
                micButton.classList.remove("recording");
                micButton.textContent = "開始錄音";
            };
        } else {
            // 瀏覽器不支持語音識別
            micButton.disabled = true;
            status.textContent = "您的瀏覽器不支持語音識別";
        }
        
        // 綁定錄音按鈕
        if (micButton && recognition) {
            micButton.addEventListener("click", function() {
                if (!isRecording) {
                    // 開始錄音
                    isRecording = true;
                    recognition.lang = sourceLang.value;
                    recognition.start();
                    micButton.classList.add("recording");
                    micButton.textContent = "停止錄音";
                    status.textContent = "正在聆聽...";
                } else {
                    // 停止錄音
                    isRecording = false;
                    recognition.stop();
                    micButton.classList.remove("recording");
                    micButton.textContent = "開始錄音";
                    status.textContent = "已停止聆聽";
                }
            });
        }
        
        // 綁定清除按鈕
        if (clearButton) {
            clearButton.addEventListener("click", function() {
                textArea.value = "";
                status.textContent = "已清除文本";
            });
        }
        
        // 綁定翻譯按鈕
        if (translateButton) {
            translateButton.addEventListener("click", function() {
                const text = textArea.value.trim();
                if (text) {
                    const from = sourceLang.value;
                    const to = targetLang.value;
                    translateWithGPT(text, from, to, "gpt-3.5-turbo-0125", result, progressContainer);
                }
            });
        }
        
        // 綁定複製結果按鈕
        if (copyButton) {
            copyButton.addEventListener("click", function() {
                if (result.textContent) {
                    copyToClipboard(result.textContent);
                    status.textContent = "已複製翻譯結果";
                }
            });
        }
        
        // 綁定清除結果按鈕
        if (clearResultButton) {
            clearResultButton.addEventListener("click", function() {
                result.textContent = "";
            });
        }
        
        // 綁定語言切換按鈕
        if (swapLangButton) {
            swapLangButton.addEventListener("click", function() {
                // 不交換auto選項
                if (sourceLang.value === "auto") return;
                
                // 交換語言
                const temp = sourceLang.value;
                sourceLang.value = targetLang.value;
                targetLang.value = temp;
            });
        }
        
        console.log("語音識別功能初始化完成");
    }

    // 初始化歷史記錄功能
    function initHistory() {
        console.log("完全重構歷史記錄功能...");
        
        // 獲取DOM元素
        const historyTab = document.getElementById("historyTab");
        
        // 檢查是否存在歷史標籤頁
        if (!historyTab) {
            console.error("歷史標籤頁不存在!");
            return;
        }
        
        console.log("清理歷史標籤頁結構...");
        // 清理現有內容
        historyTab.innerHTML = "";
        
        // 創建歷史記錄容器
        const historyContainer = document.createElement("div");
        historyContainer.className = "history-container";
        
        // 創建歷史記錄列表
        const historyList = document.createElement("div");
        historyList.className = "history-list";
        historyList.id = "historyList";
        historyContainer.appendChild(historyList);
        
        // 添加清空歷史記錄按鈕
        const clearHistoryBtn = document.createElement("button");
        clearHistoryBtn.textContent = "清空歷史記錄";
        clearHistoryBtn.className = "action-button clear-history-btn";
        clearHistoryBtn.id = "clearHistoryBtn";
        historyContainer.appendChild(clearHistoryBtn);
        
        // 添加歷史記錄容器到標籤頁
        historyTab.appendChild(historyContainer);
        
        console.log("綁定歷史記錄按鈕事件...");
        // 綁定清空歷史記錄按鈕事件
        clearHistoryBtn.addEventListener("click", () => {
            if (confirm("確定要清空所有歷史記錄嗎？此操作不可恢復。")) {
                localStorage.removeItem("translationHistory");
                updateHistoryDisplay();
            }
        });
        
        // 綁定歷史記錄列表事件 (代理事件)
        historyList.addEventListener("click", (e) => {
            const target = e.target;
            if (target.classList.contains("history-copy-btn")) {
                const index = target.getAttribute("data-index");
                copyHistoryItem(index);
            } else if (target.classList.contains("history-delete-btn")) {
                const index = target.getAttribute("data-index");
                deleteHistoryItem(index);
            }
        });
        
        // 初始更新歷史記錄顯示
        updateHistoryDisplay();
        
        console.log("歷史記錄功能重構完成");
    }
    
    // 複製歷史記錄項
    function copyHistoryItem(index) {
        try {
            const history = JSON.parse(localStorage.getItem("translationHistory") || "[]");
            const item = history[index];
            if (item && item.targetText) {
                copyToClipboard(item.targetText);
            }
        } catch (e) {
            console.error("複製歷史記錄失敗:", e);
        }
    }
    
    // 刪除歷史記錄項
    function deleteHistoryItem(index) {
        try {
            const history = JSON.parse(localStorage.getItem("translationHistory") || "[]");
            history.splice(index, 1);
            localStorage.setItem("translationHistory", JSON.stringify(history));
            updateHistoryDisplay();
        } catch (e) {
            console.error("刪除歷史記錄失敗:", e);
        }
    }
    
    // 更新歷史記錄顯示
    function updateHistoryDisplay() {
        console.log("更新歷史記錄顯示...");
        const historyList = document.getElementById("historyList");
        if (!historyList) return;
        
        try {
            const history = JSON.parse(localStorage.getItem("translationHistory") || "[]");
            
            if (history.length === 0) {
                historyList.innerHTML = "<div class='no-history'>暫無歷史記錄</div>";
                return;
            }
            
            historyList.innerHTML = history.map((entry, index) => {
                // 確保所有屬性存在
                const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '未知時間';
                const sourceLang = entry.sourceLang || '未知';
                const targetLang = entry.targetLang || '未知';
                const sourceText = entry.sourceText || '';
                const targetText = entry.targetText || '';
                
                return `
                    <div class="history-item ${entry.isSpecial ? 'special' : ''}">
                        <div class="history-meta">
                            <span class="history-time">${timestamp}</span>
                            <span class="history-lang">${sourceLang} → ${targetLang}</span>
                        </div>
                        <div class="history-content">
                            <div class="history-source">${sourceText}</div>
                            <div class="history-target">${targetText}</div>
                        </div>
                        <div class="history-actions">
                            <button class="history-copy-btn" data-index="${index}">複製</button>
                            <button class="history-delete-btn" data-index="${index}">刪除</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            console.log("歷史記錄顯示已更新，共 " + history.length + " 條記錄");
        } catch (e) {
            console.error("更新歷史記錄顯示失敗:", e);
            historyList.innerHTML = "<div class='no-history'>讀取歷史記錄失敗</div>";
        }
    }
    
    // 定義缺失的addToHistory函數
    function addToHistory(sourceText, targetText, sourceLang, targetLang, isSpecial = false) {
        try {
            // 獲取現有歷史記錄
            let history = [];
            try {
                history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
            } catch (e) {
                console.error("解析歷史記錄失敗:", e);
                history = [];
            }
            
            // 添加新記錄
            const newRecord = {
                timestamp: new Date().getTime(),
                sourceText: sourceText,
                targetText: targetText,
                sourceLang: sourceLang,
                targetLang: targetLang,
                isSpecial: isSpecial
            };
            
            // 添加到歷史記錄開頭
            history.unshift(newRecord);
            
            // 限制歷史記錄數量(最多50條)
            if (history.length > 50) {
                history = history.slice(0, 50);
            }
            
            // 保存到本地存儲
            localStorage.setItem('translationHistory', JSON.stringify(history));
            
            // 如果當前在歷史頁面，則更新顯示
            const historyTab = document.querySelector('.tab-button[data-tab="historyTab"]');
            if (historyTab && historyTab.classList.contains('active')) {
                updateHistoryDisplay();
            }
            
            console.log("已添加到歷史記錄");
        } catch (e) {
            console.error("添加到歷史記錄失敗:", e);
        }
    }

    // 添加缺失的設置功能初始化函數
    function initSettings() {
        console.log("初始化設置功能...");
        
        // 獲取設置頁面元素
        const settingsTab = document.getElementById("settingsTab");
        if (!settingsTab) {
            console.error("找不到設置標籤頁");
            return;
        }
        
        // 創建API狀態檢查區域
        let apiStatusElement = document.getElementById("apiStatus");
        if (!apiStatusElement) {
            apiStatusElement = document.createElement("div");
            apiStatusElement.id = "apiStatus";
            settingsTab.appendChild(apiStatusElement);
        }
        
        // 設置API狀態檢查界面
        apiStatusElement.innerHTML = `
            <div class="api-status-container">
                <h3>API 狀態</h3>
                <div class="api-status-item">
                    <span class="api-name">GPT API</span>
                    <span class="api-status checking">檢查中...</span>
                </div>
                <div class="api-status-item">
                    <span class="api-name">MyMemory API</span>
                    <span class="api-status checking">檢查中...</span>
                </div>
                <button id="reCheckAPIButton" class="api-check-button">重新檢查API</button>
            </div>
        `;
        
        // 添加版本信息
        const versionInfo = document.createElement("div");
        versionInfo.className = "version-info";
        versionInfo.innerHTML = `
            <p>版本: 1.2.0</p>
            <p>更新日期: ${new Date().toLocaleDateString()}</p>
        `;
        settingsTab.appendChild(versionInfo);
        
        // 添加使用說明
        const usageGuide = document.createElement("div");
        usageGuide.className = "usage-guide";
        usageGuide.innerHTML = `
            <h3>使用說明</h3>
            <ul>
                <li>標準翻譯：使用GPT模型進行高質量翻譯</li>
                <li>R18翻譯：使用MyMemory API進行敏感內容翻譯，避開審查</li>
                <li>圖片翻譯：上傳圖片提取文字後進行翻譯</li>
                <li>語音翻譯：使用麥克風錄製聲音並轉換為文字後翻譯</li>
            </ul>
            <p>若GPT API不可用，系統會自動切換至MyMemory API作為備用。</p>
        `;
        settingsTab.appendChild(usageGuide);
        
        // 綁定重新檢查按鈕事件
        const reCheckButton = document.getElementById("reCheckAPIButton");
        if (reCheckButton) {
            reCheckButton.addEventListener("click", checkAPIAvailability);
        }
        
        // 初始檢查API可用性
        checkAPIAvailability();
        
        console.log("設置功能初始化完成");
    }

    // 添加缺少的copyToClipboard函數
    function copyToClipboard(text) {
        if (!text) return;
        
        // 創建臨時textarea元素
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        // 選擇並複製文本
        textarea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                console.log('文本已複製到剪貼板');
                // 顯示提示訊息
                showToast('已複製到剪貼板');
            } else {
                console.error('複製失敗');
            }
        } catch (err) {
            console.error('複製操作失敗:', err);
        }
        
        // 移除臨時元素
        document.body.removeChild(textarea);
    }

    // 添加缺少的API檢查函數
    async function checkAPIAvailability() {
        console.log("檢查API可用性...");
        
        // 獲取狀態元素
        const gptStatusElement = document.querySelector('.api-status-item:nth-child(1) .api-status');
        const mymemoryStatusElement = document.querySelector('.api-status-item:nth-child(2) .api-status');
        
        // 設置為檢查中狀態
        if (gptStatusElement) {
            gptStatusElement.className = 'api-status checking';
            gptStatusElement.textContent = '檢查中...';
        }
        
        if (mymemoryStatusElement) {
            mymemoryStatusElement.className = 'api-status checking';
            mymemoryStatusElement.textContent = '檢查中...';
        }
        
        // 檢查GPT API
        try {
            console.log("檢查GPT API...");
            const response = await fetch(API_CONFIG.GPT.URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.GPT.KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo-0125",
                    messages: [{ role: "user", content: "hello" }],
                    max_tokens: 5
                })
            });
            
            const gptAvailable = response.ok;
            
            // 更新UI
            if (gptStatusElement) {
                gptStatusElement.className = `api-status ${gptAvailable ? 'available' : 'unavailable'}`;
                gptStatusElement.textContent = gptAvailable ? '可用' : '不可用';
            }
            
            console.log(`GPT API: ${gptAvailable ? '可用' : '不可用'}`);
        } catch (error) {
            console.error("GPT API檢查失敗:", error);
            if (gptStatusElement) {
                gptStatusElement.className = 'api-status unavailable';
                gptStatusElement.textContent = '不可用';
            }
        }
        
        // 等待一下再檢查MyMemory API，避免同時發起太多請求
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 檢查MyMemory API
        try {
            console.log("檢查MyMemory API...");
            const response = await fetch(`${API_CONFIG.MYMEMORY.URL}?q=hello&langpair=en|zh-TW`);
            const data = await response.json();
            
            const myMemoryAvailable = response.ok && data && data.responseData;
            
            // 更新UI
            if (mymemoryStatusElement) {
                mymemoryStatusElement.className = `api-status ${myMemoryAvailable ? 'available' : 'unavailable'}`;
                mymemoryStatusElement.textContent = myMemoryAvailable ? '可用' : '不可用';
            }
            
            console.log(`MyMemory API: ${myMemoryAvailable ? '可用' : '不可用'}`);
        } catch (error) {
            console.error("MyMemory API檢查失敗:", error);
            if (mymemoryStatusElement) {
                mymemoryStatusElement.className = 'api-status unavailable';
                mymemoryStatusElement.textContent = '不可用';
            }
        }
    }

    // 顯示提示訊息
    function showToast(message, duration = 2000) {
        // 檢查是否已有toast元素
        let toast = document.getElementById('toast-message');
        
        if (!toast) {
            // 創建toast元素
            toast = document.createElement('div');
            toast.id = 'toast-message';
            document.body.appendChild(toast);
            
            // 添加toast樣式
            const style = document.createElement('style');
            style.textContent = `
                #toast-message {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 4px;
                    z-index: 1000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                
                #toast-message.show {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }
        
        // 設置消息內容
        toast.textContent = message;
        toast.className = 'show';
        
        // 顯示後自動隱藏
        setTimeout(() => {
            toast.className = '';
        }, duration);
    }
});
