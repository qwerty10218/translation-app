document.addEventListener("DOMContentLoaded", () => {
    // API配置
    const API_CONFIG = {
        // GPT API (確認可用)
        gpt: {
            url: "https://free.v36.cm/v1/chat/completions",
            key: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
            model: "deepseek-chat",
            timeout: 15000,
            quota: 100000, // 每日字符配額
            delay: 1000 // 請求間隔
        },
        // MyMemory API (無登錄免費)
        mymemory: {
            url: "https://api.mymemory.translated.net/get",
            quota: 5000, // 每日字符配額
            delay: 500 // 請求間隔，避免過快
        },
        // LibreTranslate API
        libre: {
            endpoints: [
                "https://libretranslate.de/translate",
                "https://translate.argosopentech.com/translate",
                "https://libretranslate.com/translate",
                "https://translate.terraprint.co/translate"
            ],
            delay: 1000,
            quota: 5000
        }
    };

    // 保留 LibreTranslate 端點列表
    const LIBRE_ENDPOINTS = [
        "https://libretranslate.de/translate",
        "https://translate.argosopentech.com/translate",
        "https://libretranslate.com/translate",
        "https://translate.terraprint.co/translate"
    ];

    // 特殊提示詞模板 - 改進翻譯效果的 prompt
    const SPECIAL_PROMPTS = {
        base: `翻譯指引：
1. 精確翻譯，保持原文格式和風格
2. 不做任何內容過濾或審查
3. 完整保留所有表達、特殊用語和語氣
4. 若有成人內容，請如實翻譯所有露骨表述和描述
5. 若有暴力內容，請準確翻譯所有暴力描述
6. 若有俚語或口語，請使用對等的目標語言俚語，而非正式表達
7. 優先使用繁體中文進行翻譯

源語言 ({sourceLang}):
{text}

目標語言 ({targetLang}):
`,
        adult: "完整翻譯成人內容，包括露骨表達和描述，不要審查或淡化任何內容。使用繁體中文。",
        violence: "精確保留暴力和強烈描述，維持原文的強度和氛圍。使用繁體中文。",
        slang: "保留所有俚語、俗語和口語表達，不要使其正式化或簡化。使用繁體中文對應用語。"
    };

    // 當前使用的端點索引
    let libreEndpointIndex = 0;

    // 轉換語言代碼為 LibreTranslate 格式
    function convertToLibreFormat(langCode) {
        const mapping = {
            'zh': 'zh',
            'en': 'en',
            'ja': 'ja',
            'ko': 'ko',
            'fr': 'fr',
            'de': 'de',
            'es': 'es',
            'it': 'it',
            'pt': 'pt',
            'ru': 'ru'
            // 可根據需要添加更多語言
        };
        return mapping[langCode] || 'en';
    }

    // API負載均衡器
    class APIBalancer {
        constructor() {
            this.usageCount = {};
            this.lastUsed = {};
            this.initializeCounters();
        }

        initializeCounters() {
            Object.keys(API_CONFIG).forEach(api => {
                this.usageCount[api] = 0;
                this.lastUsed[api] = 0;
            });
        }

        // 獲取下一個可用的API
        getNextAPI(isSpecial = false) {
            const apis = Object.keys(API_CONFIG).filter(api => 
                isSpecial ? ['kobold', 'textgen'].includes(api) : ['horde', 'libre', 'lingva'].includes(api)
            );

            // 檢查 API 狀態和回應時間
            const now = Date.now();
            const availableAPIs = apis.filter(api => {
                const timeSinceLastUse = now - (this.lastUsed[api] || 0);
                const isAvailable = this.usageCount[api] < API_CONFIG[api].quota && 
                                  timeSinceLastUse > 1000 &&
                                  this.apiStatus[api] !== false;
                return isAvailable;
            });

            if (availableAPIs.length === 0) {
                throw new Error("所有API都已達到限制或無法使用，請稍後再試");
            }

            // 優先選擇回應最快的 API
            const selectedAPI = availableAPIs.reduce((fastest, current) => {
                const fastestResponseTime = this.apiResponseTimes[fastest] || Infinity;
                const currentResponseTime = this.apiResponseTimes[current] || Infinity;
                return currentResponseTime < fastestResponseTime ? current : fastest;
            });

            this.usageCount[selectedAPI]++;
            this.lastUsed[selectedAPI] = now;

            return selectedAPI;
        }

        // 重置使用計數
        resetCounters() {
            this.initializeCounters();
        }
    }

    // 翻譯管理器
    class TranslationManager {
        constructor() {
            this.model = "gpt";
            this.apiBalancer = new APIBalancer();
            this.apiResponseTimes = {};
            this.apiStatus = {};
            this.libreEndpointIndex = 0;
            this.currentLibreEndpointIndex = 0;
            this.isR18Mode = false;
            this.lastTranslationTime = 0;
        }

        // 設置所選模型
        setModel(model) {
            this.model = model;
        }

        // 轉換語言代碼為 LibreTranslate 格式
        convertToLibreFormat(langCode) {
            const mapping = {
                'zh': 'zh',
                'en': 'en',
                'ja': 'ja',
                'ko': 'ko',
                'fr': 'fr',
                'de': 'de',
                'es': 'es',
                'it': 'it',
                'pt': 'pt',
                'ru': 'ru'
                // 可根據需要添加更多語言
            };
            return mapping[langCode] || 'en';
        }

        async translate(text, sourceLang, targetLang, isSpecial = false, contentTypes = {}) {
            if (this.model === "openrouter") {
                try {
                    return await this.translateWithOpenRouter(text, sourceLang, targetLang);
                } catch (error) {
                    console.error("OpenRouter 翻譯失敗，嘗試使用備用 API:", error);
                    
                    // 回退到 GPT
                    try {
                        return await this.translateWithGPT(text, sourceLang, targetLang);
                    } catch (gptError) {
                        console.error("GPT 翻譯也失敗:", gptError);
                        throw new Error("所有翻譯 API 均失敗");
                    }
                }
            } else if (this.model === "gpt") {
                try {
                    return await this.translateWithGPT(text, sourceLang, targetLang);
                } catch (error) {
                    console.error("GPT 翻譯失敗，嘗試使用備用 API:", error);
                    
                    // 回退到 OpenRouter
                    try {
                        return await this.translateWithOpenRouter(text, sourceLang, targetLang);
                    } catch (openrouterError) {
                        console.error("OpenRouter 翻譯也失敗:", openrouterError);
                        throw new Error("所有翻譯 API 均失敗");
                    }
                }
            }
        }

        async translateWithOpenRouter(text, sourceLang, targetLang) {
            const prompt = `將以下${getLanguageName(sourceLang)}文本翻譯成${getLanguageName(targetLang)}：\n\n${text}`;
            
            // 創建進度條
            const progressBar = createProgressBar("translation-progress", "翻譯進度");
            document.querySelector(".action-panel").appendChild(progressBar);
            updateTranslationProgress(progressBar, 10);
            
            const startTime = Date.now();
            
            try {
                console.log("開始 OpenRouter 翻譯請求:", {
                    sourceLang,
                    targetLang,
                    textLength: text.length,
                    model: API_CONFIG.openrouter.model
                });
                
                const response = await fetch(API_CONFIG.openrouter.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${API_CONFIG.openrouter.key}`,
                        "HTTP-Referer": window.location.origin || "https://translator.app",
                        "X-Title": "詮語翻譯工具"
                    },
                    body: JSON.stringify({
                        model: API_CONFIG.openrouter.model,
                        messages: [
                            {
                                role: "system",
                                content: "你是一個專業的翻譯助手，請準確翻譯用戶提供的文本，保持原文的格式和風格。"
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        temperature: 0.3,
                        max_tokens: 2000
                    })
                });
                
                updateTranslationProgress(progressBar, 50);

                if (!response.ok) {
                    // 嘗試獲取原始響應文本
                    const responseText = await response.text();
                    console.error("OpenRouter 錯誤響應:", responseText);
                    
                    // 檢查是否是 HTML 回應
                    if (responseText.trim().toLowerCase().startsWith("<!doctype") || 
                        responseText.trim().toLowerCase().includes("<html")) {
                        throw new Error("收到 HTML 響應而非 JSON。可能是 API Key 或認證問題。");
                    }
                    
                    throw new Error(`OpenRouter API 錯誤: ${response.status} - ${responseText}`);
                }

                const data = await response.json();
                console.log("OpenRouter 響應:", data);
                
                updateTranslationProgress(progressBar, 100);
                
                // 更新 API 回應時間
                this.apiResponseTimes['openrouter'] = Date.now() - startTime;
                this.apiStatus['openrouter'] = true;
                
                // 移除進度條
                setTimeout(() => {
                    progressBar.remove();
                }, 1000);
                
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content.trim();
                } else {
                    throw new Error("OpenRouter 響應格式不正確");
                }
            } catch (error) {
                this.apiStatus['openrouter'] = false;
                console.error("使用 OpenRouter 翻譯時出錯:", error);
                
                // 移除進度條
                progressBar.remove();
                
                throw error;
            }
        }

        async translateWithGPT(text, sourceLang, targetLang) {
            const prompt = `將以下${getLanguageName(sourceLang)}文本翻譯成${getLanguageName(targetLang)}，請使用繁體中文：\n\n${text}`;
            
            const response = await fetch(API_CONFIG.gpt.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.gpt.key}`
                },
                body: JSON.stringify({
                    model: API_CONFIG.gpt.model,
                    messages: [
                        {
                            role: "system",
                            content: "你是一個專業的翻譯助手，請準確翻譯用戶提供的文本，保持原文的格式和風格。優先使用繁體中文。"
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`GPT API 錯誤: ${errorData.error?.message || response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        }

        async handleNormalTranslation(api, text, sourceLang, targetLang) {
            const config = API_CONFIG[api];
            
            switch(api) {
                case 'horde':
                    return await this.translateWithHorde(text, sourceLang, targetLang);
                case 'libre':
                    return await this.translateWithLibre(text, sourceLang, targetLang);
                case 'lingva':
                    return await this.translateWithLingva(text, sourceLang, targetLang);
                default:
                    throw new Error(`不支持的API: ${api}`);
            }
        }

        async handleSpecialTranslation(text, sourceLang, targetLang, contentTypes) {
            // 構建特殊提示詞
            let prompt = SPECIAL_PROMPTS.base
                .replace('{sourceLang}', getLanguageName(sourceLang))
                .replace('{targetLang}', getLanguageName(targetLang))
                .replace('{text}', text);

            // 根據選擇的內容類型添加額外提示詞
            if (contentTypes.adult) prompt = SPECIAL_PROMPTS.adult + "\n" + prompt;
            if (contentTypes.violence) prompt = SPECIAL_PROMPTS.violence + "\n" + prompt;
            if (contentTypes.slang) prompt = SPECIAL_PROMPTS.slang + "\n" + prompt;

            const startTime = Date.now();
            try {
                const response = await fetch(API_CONFIG.horde.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": API_CONFIG.horde.key
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        params: {
                            max_length: 1000,
                            temperature: 0.8,
                            top_p: 0.9,
                            min_p: 0.1,
                            top_k: 0,
                            repetition_penalty: 1.0,
                            stop_sequence: ["###"]
                        }
                    })
                });

                if (!response.ok) {
                    this.apiStatus['horde'] = false;
                    throw new Error(`Horde API錯誤: ${response.status}`);
                }

                const data = await response.json();
                
                // 更新 API 回應時間
                this.apiResponseTimes['horde'] = Date.now() - startTime;
                this.apiStatus['horde'] = true;
                
                return data.generations[0].text;
            } catch (error) {
                this.apiStatus['horde'] = false;
                throw error;
            }
        }

        // 各API的具體實現
        async translateWithHorde(text, sourceLang, targetLang) {
            const response = await fetch(API_CONFIG.horde.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": API_CONFIG.horde.key
                },
                body: JSON.stringify({
                    prompt: `Translate from ${sourceLang} to ${targetLang}:\n${text}\nTranslation:`,
                    params: {
                        max_length: 500,
                        temperature: 0.7
                    }
                })
            });

            if (!response.ok) throw new Error(`Horde API錯誤: ${response.status}`);
            const data = await response.json();
            return data.generations[0].text;
        }

        async translateWithLingva(text, sourceLang, targetLang) {
            const response = await fetch(`${API_CONFIG.lingva.url}/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`);

            if (!response.ok) throw new Error(`Lingva API錯誤: ${response.status}`);
            const data = await response.json();
            return data.translation;
        }

        async translateWithKobold(text, sourceLang, targetLang) {
            const response = await fetch(API_CONFIG.kobold.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: `Translate the following text from ${sourceLang} to ${targetLang}, keep the original meaning and style:\n${text}\n\nTranslation:`,
                    max_length: 1000,
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error(`Kobold API錯誤: ${response.status}`);
            const data = await response.json();
            return data.results[0].text;
        }

        async translateWithTextgen(text, sourceLang, targetLang) {
            const response = await fetch(API_CONFIG.textgen.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: `Translate from ${sourceLang} to ${targetLang}:\n${text}\nTranslation:`,
                    max_new_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error(`Text-gen API錯誤: ${response.status}`);
            const data = await response.json();
            return data.generated_text;
        }

        async translateWithLibre(inputText, sourceLang, targetLang) {
            let lastError = null;
            
            for (let i = 0; i < LIBRE_ENDPOINTS.length; i++) {
                const currentIndex = (this.currentLibreEndpointIndex + i) % LIBRE_ENDPOINTS.length;
                const endpoint = LIBRE_ENDPOINTS[currentIndex];
                
                try {
                    console.log(`嘗試使用 LibreTranslate 端點 ${i+1}/${LIBRE_ENDPOINTS.length}: ${endpoint}`);
                    
                    // 創建表單數據
                    const formData = new FormData();
                    formData.append("q", inputText);
                    formData.append("source", sourceLang);
                    formData.append("target", targetLang);
                    formData.append("format", "text");
                    formData.append("api_key", ""); // 大多數公共實例不需要 API 密鑰
                    
                    const response = await fetch(endpoint, {
                        method: "POST",
                        body: formData,
                    });
                    
                    console.log(`LibreTranslate 端點 ${endpoint} 響應狀態:`, response.status);
                    
                    // 檢查響應類型
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("text/html")) {
                        console.warn("LibreTranslate 返回了 HTML 而非 JSON");
                        const htmlContent = await response.text();
                        console.log("HTML 響應預覽:", htmlContent.substring(0, 200));
                        throw new Error("API 返回了 HTML 而非 JSON");
                    }
                    
                    if (!response.ok) {
                        throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
                    }
                    
                    // 解析 JSON 響應
                    const data = await response.json();
                    console.log("LibreTranslate 響應數據:", data);
                    
                    // 更新當前端點索引，下次從下一個端點開始嘗試
                    this.currentLibreEndpointIndex = (currentIndex + 1) % LIBRE_ENDPOINTS.length;
                    
                    if (!data.translatedText) {
                        throw new Error("翻譯結果為空");
                    }
                    
                    return data.translatedText;
                } catch (error) {
                    console.error(`LibreTranslate 端點 ${endpoint} 失敗:`, error);
                    lastError = error;
                    // 繼續嘗試下一個端點
                }
            }
            
            // 所有端點都失敗了
            throw lastError || new Error("所有 LibreTranslate 端點均失敗");
        }

        async translateWithFallback(inputText, sourceLang, targetLang, isR18 = false) {
            const now = Date.now();
            if (now - this.lastTranslationTime < 2000) {
                throw new Error("請稍等片刻再進行下一次翻譯");
            }
            this.lastTranslationTime = now;
            
            this.isR18Mode = isR18;
            const progressContainer = this.createProgressBar();
            let progressInterval;
            
            try {
                let progress = 0;
                progressInterval = setInterval(() => {
                    progress += 5;
                    if (progress > 90) {
                        clearInterval(progressInterval);
                        progressInterval = null;
                    }
                    const progressBar = progressContainer.querySelector('.progress-bar');
                    if (progressBar) {
                        progressBar.style.width = `${progress}%`;
                        progressBar.classList.add('pulse');
                    }
                }, 300);
                
                if (isR18) {
                    console.log("R18 內容翻譯中...");
                    try {
                        console.log("嘗試使用 MyMemory API 翻譯...");
                        return await this.translateWithMyMemory(inputText, sourceLang, targetLang);
                    } catch (myMemoryError) {
                        console.error("MyMemory 翻譯失敗:", myMemoryError);
                        showNotification("MyMemory API 失敗，嘗試使用 LibreTranslate...", "info");
                        
                        try {
                            console.log("嘗試使用 LibreTranslate 翻譯...");
                            return await this.translateWithLibre(inputText, sourceLang, targetLang);
                        } catch (libreError) {
                            console.error("LibreTranslate 翻譯失敗:", libreError);
                            showNotification("所有翻譯 API 均失敗", "error");
                            throw new Error("所有翻譯 API 均失敗");
                        }
                    }
                } else {
                    console.log("使用 GPT API 翻譯一般內容...");
                    try {
                        return await this.translateWithGPT(inputText, sourceLang, targetLang);
                    } catch (gptError) {
                        console.error("GPT 翻譯失敗:", gptError);
                        showNotification("GPT API 失敗，嘗試使用備用翻譯...", "info");
                        
                        try {
                            return await this.translateWithMyMemory(inputText, sourceLang, targetLang);
                        } catch (error) {
                            console.error("備用翻譯也失敗:", error);
                            throw new Error("所有翻譯 API 均失敗");
                        }
                    }
                }
            } finally {
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
                if (progressContainer) {
                    const progressBar = progressContainer.querySelector('.progress-bar');
                    if (progressBar) {
                        progressBar.style.width = "100%";
                        progressBar.classList.remove('pulse');
                        progressBar.classList.add('complete');
                    }
                    setTimeout(() => {
                        if (progressContainer.parentNode) {
                            progressContainer.parentNode.removeChild(progressContainer);
                        }
                    }, 500);
                }
            }
        }

        // 新增 MyMemory API 翻譯方法 (針對 R18 內容)
        async translateWithMyMemory(inputText, sourceLang, targetLang) {
            console.log("使用 MyMemory API 翻譯...");
            
            try {
                const source = sourceLang.toLowerCase();
                const target = targetLang.toLowerCase();
                
                const apiUrl = new URL(API_CONFIG.mymemory.url);
                apiUrl.searchParams.append('q', inputText);
                apiUrl.searchParams.append('langpair', `${source}|${target}`);
                apiUrl.searchParams.append('de', 'translation@app.com');
                
                await new Promise(resolve => setTimeout(resolve, API_CONFIG.mymemory.delay));
                
                const response = await fetch(apiUrl.toString());
                
                if (!response.ok) {
                    throw new Error(`MyMemory API HTTP 錯誤! 狀態: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.responseStatus !== 200 || !data.responseData) {
                    throw new Error(`MyMemory API 錯誤: ${data.responseStatus}`);
                }
                
                // 確保輸出使用繁體中文
                let translatedText = data.responseData.translatedText;
                if (target === 'zh') {
                    translatedText = translatedText.replace(/简/g, '簡')
                                               .replace(/复/g, '複')
                                               .replace(/么/g, '麼')
                                               .replace(/着/g, '著');
                }
                
                return translatedText;
            } catch (error) {
                console.error("MyMemory 翻譯失敗:", error);
                throw error;
            }
        }

        // 實現備用 API 翻譯方法
        async translateWithBackupAPI(inputText, sourceLang, targetLang) {
            // 直接使用 GPT 作為備用
            return await this.translateWithGPT(inputText, sourceLang, targetLang);
        }

        // 創建進度條 - 直接從 DOM 創建而不依賴現有元素
        createProgressBar() {
            // 創建進度條容器
            const progressContainer = document.createElement("div");
            progressContainer.className = "progress-container";
            progressContainer.style.display = "block";
            
            // 創建進度條
            const progressBar = document.createElement("div");
            progressBar.className = "progress-bar";
            progressContainer.appendChild(progressBar);
            
            // 確定插入位置
            const container = this.isR18Mode 
                ? document.querySelector("#r18Tab .action-panel") 
                : document.querySelector("#textTab .action-panel");
                
            if (container) {
                container.parentNode.insertBefore(progressContainer, container.nextSibling);
            }
            
            return progressContainer;
        }
    }

    // 初始化翻譯管理器
    const translationManager = new TranslationManager();

    // DOM元素
    const dom = {
        inputText: document.getElementById("inputText"),
        result: document.getElementById("result"),
        translateButton: document.getElementById("translateButton"),
        clearTextButton: document.getElementById("clearTextButton"),
        clearResultButton: document.getElementById("clearResultButton"),
        copyResultButton: document.getElementById("copyResultButton"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        swapLangButton: document.getElementById("swapLang"),
        imageDropArea: document.getElementById("imageDropArea"),
        imageInput: document.getElementById("imageInput"),
        imageCanvas: document.getElementById("imageCanvas"),
        enhanceContrastButton: document.getElementById("enhanceContrastButton"),
        grayscaleButton: document.getElementById("grayscaleButton"),
        resetImageButton: document.getElementById("resetImageButton"),
        clearImageButton: document.getElementById("clearImageButton"),
        extractTextButton: document.getElementById("extractTextButton"),
        extractedText: document.getElementById("extractedText"),
        translateExtractedButton: document.getElementById("translateExtractedButton"),
        ocrLanguageSelect: document.getElementById("ocrLanguageSelect"),
        startVoiceBtn: document.getElementById("startVoiceBtn"),
        stopVoiceBtn: document.getElementById("stopVoiceBtn"),
        voiceVisualizer: document.getElementById("voiceVisualizer"),
        voiceRecordingStatus: document.getElementById("voiceRecordingStatus"),
        voiceTranscript: document.getElementById("voiceTranscript"),
        useVoiceTextBtn: document.getElementById("useVoiceTextBtn"),
        clearVoiceBtn: document.getElementById("clearVoiceBtn"),
        expandVoiceBtn: document.getElementById("expandVoiceBtn"),
        shrinkVoiceBtn: document.getElementById("shrinkVoiceBtn"),
        r18InputText: document.getElementById("r18InputText"),
        r18Result: document.getElementById("r18Result"),
        r18TranslateButton: document.getElementById("r18TranslateButton"),
        r18ClearButton: document.getElementById("r18ClearButton"),
        r18CopyButton: document.getElementById("r18CopyButton"),
        r18ClearResultButton: document.getElementById("r18ClearResultButton"),
        r18SourceLang: document.getElementById("r18SourceLang"),
        r18TargetLang: document.getElementById("r18TargetLang"),
        r18SwapLangButton: document.getElementById("r18SwapLang"),
        r18ModelSelect: document.getElementById("r18ModelSelect"),
        adultContent: document.getElementById("adultContent"),
        violenceContent: document.getElementById("violenceContent"),
        slangContent: document.getElementById("slangContent"),
        historyList: document.getElementById("historyList"),
        clearHistoryBtn: document.getElementById("clearHistoryBtn"),
        exportHistoryBtn: document.getElementById("exportHistoryBtn"),
        textTab: document.getElementById("textTab"),
        imageTab: document.getElementById("imageTab"),
        voiceTab: document.getElementById("voiceTab"),
        r18Tab: document.getElementById("r18Tab"),
        historyTab: document.getElementById("historyTab"),
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        themeToggle: document.querySelector(".theme-toggle"),
        apiKeyInput: document.querySelector(".api-key-input"),
        modelSelect: document.querySelector(".model-select"),
        apiSettingsToggle: document.querySelector(".api-settings-toggle"),
        progressBar: null,
        progressContainer: null,
        specialProgressBar: null,
        specialProgressContainer: null
    };

    function init() {
        // 創建進度條元素
        createProgressBars();
        
        initTheme();
        initTabs();
        initTranslation();
        initImageTranslation();
        initVoiceRecognition();
        initR18Translation();
        initAPISettings();
        initHistory();
        initSettings(); // 添加設置初始化
    }
    
    // 創建進度條元素
    function createProgressBars() {
        // 普通翻譯進度條
        const progressContainer = document.createElement("div");
        progressContainer.className = "progress-container";
        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        progressContainer.appendChild(progressBar);
        dom.textTab.querySelector(".result-container").insertBefore(progressContainer, dom.result);
        
        dom.progressContainer = progressContainer;
        dom.progressBar = progressBar;
        
        // 特殊翻譯進度條
        const specialProgressContainer = document.createElement("div");
        specialProgressContainer.className = "progress-container";
        const specialProgressBar = document.createElement("div");
        specialProgressBar.className = "progress-bar";
        specialProgressContainer.appendChild(specialProgressBar);
        dom.r18Tab.querySelector(".result-container").insertBefore(specialProgressContainer, dom.specialResult);
        
        dom.specialProgressContainer = specialProgressContainer;
        dom.specialProgressBar = specialProgressBar;
    }

    // 創建單個進度條
    function createProgressBar(id, label) {
        const container = document.createElement("div");
        container.className = "progress-container";
        container.id = id + "-container";
        
        const labelElem = document.createElement("div");
        labelElem.className = "progress-label";
        labelElem.textContent = label;
        container.appendChild(labelElem);
        
        const bar = document.createElement("div");
        bar.className = "progress-bar";
        bar.id = id;
        container.appendChild(bar);
        
        return container;
    }

    function initButtons() {
        dom.clearTextButton.addEventListener("click", () => {
            dom.inputText.value = "";
            validateTranslationInput();
        });
        
        dom.copyResultButton.addEventListener("click", () => {
            if (dom.result.textContent) {
                navigator.clipboard.writeText(dom.result.textContent)
                    .then(() => alert("已複製到剪貼簿"))
                    .catch(err => alert("複製失敗: " + err));
            }
        });
        
        dom.clearResultButton.addEventListener("click", () => {
            dom.result.textContent = "";
        });
        
        dom.clearAllButton.addEventListener("click", () => {
            dom.inputText.value = "";
            dom.result.textContent = "";
            validateTranslationInput();
        });
        
        dom.clearImageButton.addEventListener("click", () => {
            clearImageData();
        });
    }

    function initTabs() {
        dom.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                dom.tabs.forEach(t => t.classList.remove("active"));
                dom.tabContents.forEach(c => c.classList.remove("active"));
                tab.classList.add("active");
                document.getElementById(tab.getAttribute("data-tab")).classList.add("active");
                dom.result.textContent = "";
                if (dom.extractedText) {
                    dom.extractedText.textContent = "";
                }
            });
        });
    }

    function initTranslation() {
        let lastTranslationTime = 0;
        
        // 初始化模型選擇器
        const modelSelect = document.getElementById("modelSelect");
        const r18ModelSelect = document.getElementById("r18ModelSelect");
        
        if (modelSelect) {
            modelSelect.addEventListener("change", (e) => {
                translationManager.setModel(e.target.value);
                localStorage.setItem("selectedModel", e.target.value);
                showNotification(`已切換到 ${e.target.value === "openrouter" ? "DeepSeek R1" : "GPT-3.5"} 模型`, "info");
            });
            
            // 從本地存儲中讀取之前選擇的模型
            const savedModel = localStorage.getItem("selectedModel");
            if (savedModel) {
                modelSelect.value = savedModel;
                translationManager.setModel(savedModel);
            }
        }
        
        if (r18ModelSelect) {
            r18ModelSelect.addEventListener("change", (e) => {
                translationManager.setModel(e.target.value);
                localStorage.setItem("selectedModel", e.target.value);
                showNotification(`已切換到 ${e.target.value === "openrouter" ? "DeepSeek R1" : "GPT-3.5"} 模型`, "info");
            });
            
            // 同步兩個選擇器的值
            if (modelSelect) {
                r18ModelSelect.value = modelSelect.value;
            }
        }
        
        // 確保頁面載入時執行驗證
        validateTranslationInput(false);
        
        dom.translateButton.addEventListener("click", async () => {
            const now = Date.now();
            if (now - lastTranslationTime < 3000) {
                showNotification("請稍等片刻再進行下一次翻譯請求", "warning");
                return;
            }
            lastTranslationTime = now;
            
            const text = dom.inputText.value.trim();
            const sourceLang = dom.sourceLang.value;
            const targetLang = dom.targetLang.value;
            
            if (!text) {
                showNotification("請輸入要翻譯的文字", "warning");
                return;
            }
            
            try {
                dom.translateButton.disabled = true;
                dom.translateButton.innerHTML = '<span class="button-icon">⏳</span>翻譯中...';
                
                const translatedText = await translationManager.translate(text, sourceLang, targetLang);
                
                dom.result.textContent = translatedText;
                
                // 添加到歷史記錄
                addToHistory({
                    timestamp: new Date().toISOString(),
                    sourceText: text,
                    targetText: translatedText,
                    sourceLang: sourceLang,
                    targetLang: targetLang,
                    isSpecial: false
                });
                
                showNotification("翻譯完成", "success");
            } catch (error) {
                console.error("翻譯失敗:", error);
                dom.result.textContent = `翻譯失敗: ${error.message}`;
                showNotification(`翻譯失敗: ${error.message}`, "error");
            } finally {
                dom.translateButton.disabled = false;
                dom.translateButton.innerHTML = '<span class="button-icon">🔄</span>翻譯';
            }
        });
        
        dom.swapLangButton.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", () => validateTranslationInput(false));
        dom.sourceLang.addEventListener("change", () => validateTranslationInput(false));
        dom.targetLang.addEventListener("change", () => validateTranslationInput(false));
    }

    function swapLanguages() {
        [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
        validateTranslationInput();
    }

    function validateTranslationInput(isSpecial = false) {
        const input = isSpecial ? dom.r18InputText : dom.inputText;
        const sourceLang = isSpecial ? dom.r18SourceLang : dom.sourceLang;
        const targetLang = isSpecial ? dom.r18TargetLang : dom.targetLang;
        const translateBtn = isSpecial ? dom.r18TranslateButton : dom.translateButton;

        const textInput = input.value.trim();
        const sameLanguage = sourceLang.value === targetLang.value;

        translateBtn.disabled = !textInput || sameLanguage;
        translateBtn.title = sameLanguage ? "源語言和目標語言不能相同" : 
                           !textInput ? "請輸入要翻譯的內容" : "";
    }

    async function handleTranslation(isSpecial = false) {
        // 獲取相應元素
        const inputElement = isSpecial ? dom.r18InputText : dom.inputText;
        const resultElement = isSpecial ? dom.r18Result : dom.result;
        const sourceLangElement = isSpecial ? dom.r18SourceLang : dom.sourceLang;
        const targetLangElement = isSpecial ? dom.r18TargetLang : dom.targetLang;
        const translateButton = isSpecial ? dom.r18TranslateButton : dom.translateButton;
        
        // 檢查輸入
        const inputText = inputElement.value.trim();
        if (!inputText) {
            showNotification("請輸入要翻譯的文字", "error");
            return;
        }
        
        // 檢查源語言和目標語言
        const sourceLang = sourceLangElement.value;
        const targetLang = targetLangElement.value;
        if (sourceLang === targetLang) {
            showNotification("源語言和目標語言不能相同", "error");
            return;
        }
        
        // 禁用翻譯按鈕，顯示翻譯中狀態
        translateButton.disabled = true;
        translateButton.innerHTML = '<span class="button-icon">⏳</span>翻譯中...';
        resultElement.textContent = "翻譯中...";
        
        // 獲取 R18 內容類型選項
        let contentTypes = {};
        if (isSpecial) {
            contentTypes = {
                adult: dom.adultContent.checked,
                violence: dom.violenceContent.checked,
                slang: dom.slangContent.checked
            };
        }
        
        // 使用 translateWithFallback 方法進行翻譯
        translationManager.translateWithFallback(inputText, sourceLang, targetLang, isSpecial)
            .then(result => {
                resultElement.textContent = result;
                
                // 添加到歷史記錄
                addToHistory({
                    timestamp: new Date().toISOString(),
                    sourceText: inputText,
                    targetText: result,
                    sourceLang: sourceLang,
                    targetLang: targetLang,
                    isSpecial: isSpecial
                });
                
                showNotification("翻譯完成", "success");
            })
            .catch(error => {
                console.error("翻譯錯誤:", error);
                resultElement.textContent = `翻譯失敗: ${error.message}`;
                showNotification(`翻譯失敗: ${error.message}`, "error");
            })
            .finally(() => {
                // 恢復按鈕狀態
                translateButton.disabled = false;
                translateButton.innerHTML = '<span class="button-icon">🔄</span>翻譯';
            });
    }

    function initImageTranslation() {
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextButton.addEventListener("click", extractTextFromImage);
        dom.translateExtractedButton.addEventListener("click", () => {
            if (dom.extractedText && dom.extractedText.textContent) {
                translateExtractedText();
            }
        });
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
                alert("請上傳圖片文件");
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
            alert("請上傳圖片文件");
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
                
                const maxWidth = canvas.parentElement.clientWidth - 40;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = img.height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.originalImage = img;
                canvas.originalWidth = width;
                canvas.originalHeight = height;
                
                initSelectionArea(canvas);
                
                dom.extractTextButton.disabled = false;
            };
            img.onerror = () => alert("圖片載入失敗，請使用其他圖片。");
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    function initSelectionArea(canvas) {
        const ctx = canvas.getContext("2d");
        let isSelecting = false;
        let selectionStart = { x: 0, y: 0 };
        let selectionEnd = { x: 0, y: 0 };
        let currentSelection = null;
        
        canvas.removeEventListener("mousedown", canvas.mousedownHandler);
        canvas.removeEventListener("mousemove", canvas.mousemoveHandler);
        canvas.removeEventListener("mouseup", canvas.mouseupHandler);
        
        canvas.mousedownHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            selectionStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            selectionEnd = { ...selectionStart };
            isSelecting = true;
            
            if (currentSelection) {
                redrawImage();
                currentSelection = null;
            }
        };
        
        canvas.mousemoveHandler = (e) => {
            if (!isSelecting) return;
            
            const rect = canvas.getBoundingClientRect();
            selectionEnd = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            redrawImage();
            drawSelectionBox();
        };
        
        canvas.mouseupHandler = () => {
            if (isSelecting) {
                isSelecting = false;
                
                if (Math.abs(selectionStart.x - selectionEnd.x) > 10 && 
                    Math.abs(selectionStart.y - selectionEnd.y) > 10) {
                    
                    currentSelection = {
                        x: Math.min(selectionStart.x, selectionEnd.x),
                        y: Math.min(selectionStart.y, selectionEnd.y),
                        width: Math.abs(selectionEnd.x - selectionStart.x),
                        height: Math.abs(selectionEnd.y - selectionStart.y)
                    };
                    
                    const selectionInfo = document.createElement("div");
                    selectionInfo.className = "selection-info";
                    selectionInfo.textContent = "已選擇區域，點擊「擷取文字」按鈕進行識別";
                    selectionInfo.style.position = "absolute";
                    selectionInfo.style.top = `${canvas.offsetTop + currentSelection.y + currentSelection.height + 5}px`;
                    selectionInfo.style.left = `${canvas.offsetLeft + currentSelection.x}px`;
                    selectionInfo.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
                    selectionInfo.style.color = "white";
                    selectionInfo.style.padding = "5px";
                    selectionInfo.style.borderRadius = "3px";
                    selectionInfo.style.fontSize = "12px";
                    selectionInfo.style.zIndex = "100";
                    
                    const prevInfo = document.querySelector(".selection-info");
                    if (prevInfo) prevInfo.remove();
                    
                    dom.imageTab.appendChild(selectionInfo);
                    setTimeout(() => selectionInfo.remove(), 3000);
                } else {
                    currentSelection = null;
                    redrawImage();
                }
            }
        };
        
        function redrawImage() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvas.originalImage, 0, 0, canvas.width, canvas.height);
        }
        
        function drawSelectionBox() {
            const x = Math.min(selectionStart.x, selectionEnd.x);
            const y = Math.min(selectionStart.y, selectionEnd.y);
            const width = Math.abs(selectionEnd.x - selectionStart.x);
            const height = Math.abs(selectionEnd.y - selectionStart.y);
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.clearRect(x, y, width, height);
            
            ctx.strokeStyle = "#2196F3";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
        }
        
        canvas.addEventListener("mousedown", canvas.mousedownHandler);
        canvas.addEventListener("mousemove", canvas.mousemoveHandler);
        canvas.addEventListener("mouseup", canvas.mouseupHandler);
        
        canvas.getCurrentSelection = () => currentSelection;
    }

    async function extractTextFromImage() {
        dom.extractTextButton.disabled = true;
        dom.translateExtractedButton.disabled = true;
        
        if (!dom.imageCanvas.width) {
            alert("請先上傳圖片");
            dom.extractTextButton.disabled = false;
            return;
        }
        
        if (!dom.extractedText) {
            dom.extractedText = document.createElement("div");
            dom.extractedText.id = "extractedText";
            dom.extractedText.className = "extracted-text";
            dom.imageTab.appendChild(dom.extractedText);
        }
        
        dom.extractedText.textContent = "識別中...";
        dom.extractedText.style.display = "block";

        try {
            const progressContainer = document.createElement("div");
            progressContainer.className = "ocr-progress-container";
            const progressBar = document.createElement("div");
            progressBar.className = "ocr-progress-bar";
            progressContainer.appendChild(progressBar);
            dom.imageTab.appendChild(progressContainer);

            const selection = dom.imageCanvas.getCurrentSelection();
            let imageData;
            
            if (selection) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = selection.width;
                tempCanvas.height = selection.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                tempCtx.drawImage(
                    dom.imageCanvas, 
                    selection.x, selection.y, selection.width, selection.height,
                    0, 0, selection.width, selection.height
                );
                
                imageData = tempCanvas;
            } else {
                imageData = dom.imageCanvas;
            }

            const ocrLang = dom.ocrLanguageSelect ? dom.ocrLanguageSelect.value : 'chi_tra+eng';
            
            const { createWorker } = Tesseract;
            const worker = await createWorker({
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        progressBar.style.width = `${progress.progress * 100}%`;
                    }
                },
                langPath: 'https://tessdata.projectnaptha.com/4.0.0'
            });

            await worker.loadLanguage(ocrLang);
            await worker.initialize(ocrLang);
            
            await worker.setParameters({
                preserve_interword_spaces: '1',
                tessedit_pageseg_mode: '6',
                tessedit_char_whitelist: ''
            });
            
            const { data } = await worker.recognize(imageData);
            await worker.terminate();

            progressContainer.remove();

            let recognizedText = data.text.trim();
            if (!recognizedText) {
                dom.extractedText.textContent = "未能識別出文字，請嘗試調整選擇區域或上傳清晰的圖片";
            } else {
                recognizedText = recognizedText
                    .replace(/(\r\n|\n|\r){2,}/gm, '\n\n')
                    .replace(/[^\S\r\n]+/g, ' ')
                    .trim();
                
                dom.extractedText.textContent = recognizedText;
                dom.translateExtractedButton.disabled = false;
                
                if (!document.getElementById('editExtractedButton')) {
                    const editButton = document.createElement('button');
                    editButton.id = 'editExtractedButton';
                    editButton.className = 'button secondary-button';
                    editButton.textContent = '編輯識別文本';
                    editButton.style.marginTop = '10px';
                    editButton.onclick = editExtractedText;
                    dom.extractedText.after(editButton);
                } else {
                    document.getElementById('editExtractedButton').style.display = 'inline-block';
                }
                
                const directTranslateInfo = document.createElement("div");
                directTranslateInfo.className = "direct-translate-info";
                directTranslateInfo.textContent = "點擊「翻譯擷取文字」按鈕直接進行翻譯";
                directTranslateInfo.style.marginTop = "10px";
                directTranslateInfo.style.fontStyle = "italic";
                directTranslateInfo.style.color = "#555";
                
                const prevInfo = dom.extractedText.nextElementSibling;
                if (prevInfo && prevInfo.className === "direct-translate-info") {
                    prevInfo.remove();
                }
                
                if (data.languages && data.languages.length > 0) {
                    const detectedLang = data.languages.sort((a, b) => b.confidence - a.confidence)[0];
                    
                    if (detectedLang && detectedLang.confidence > 0.5) {
                        const langInfo = document.createElement("div");
                        langInfo.className = "detected-language";
                        langInfo.textContent = `檢測到的語言: ${getLanguageName(detectedLang.code)} (信度: ${Math.round(detectedLang.confidence * 100)}%)`;
                        langInfo.style.display = 'block';
                        dom.extractedText.before(langInfo);
                    }
                }
                
                dom.extractedText.after(directTranslateInfo);
                
                dom.translateExtractedButton.focus();
            }
        } catch (error) {
            dom.extractedText.textContent = `識別失敗：${error.message}`;
        } finally {
            dom.extractTextButton.disabled = false;
        }
    }

    async function translateExtractedText() {
        if (!dom.extractedText) {
            alert("請先識別圖片文字");
            return;
        }

        const extractedText = dom.extractedText.textContent.trim();
        if (!extractedText || extractedText === "識別中..." || extractedText.startsWith("識別失敗")) {
            alert("沒有可翻譯的文字");
            return;
        }

        if (dom.sourceLang.value === dom.targetLang.value) {
            alert("源語言和目標語言不能相同");
            return;
        }

        await handleTranslation(false);
    }

    function clearImageData() {
        const canvas = dom.imageCanvas;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.display = "none";
        
        if (dom.extractedText) {
            dom.extractedText.textContent = "";
        }
        
        dom.extractTextButton.disabled = true;
        dom.translateExtractedButton.disabled = true;
        
        dom.imageInput.value = "";
    }

    function initTheme() {
        const themeToggle = document.querySelector('.theme-toggle');
        const savedTheme = localStorage.getItem('theme');
        
        // 設置初始主題
        if (savedTheme) {
            document.documentElement.className = savedTheme;
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.className = prefersDark ? 'dark-theme' : '';
        }
        
        // 更新主題切換按鈕文本
        updateThemeToggleText();
        
        // 主題切換事件
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark-theme');
            document.documentElement.className = isDark ? '' : 'dark-theme';
            localStorage.setItem('theme', isDark ? '' : 'dark-theme');
            updateThemeToggleText();
        });
        
        // 監聽系統主題變化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.className = e.matches ? 'dark-theme' : '';
                updateThemeToggleText();
            }
        });
    }

    function updateThemeToggleText() {
        const themeToggle = document.querySelector('.theme-toggle');
        const isDark = document.documentElement.classList.contains('dark-theme');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    }

    function initVoiceRecognition() {
        const startVoiceBtn = document.getElementById('startVoiceBtn');
        const stopVoiceBtn = document.getElementById('stopVoiceBtn');
        const useVoiceTextBtn = document.getElementById('useVoiceTextBtn');
        const clearVoiceBtn = document.getElementById('clearVoiceBtn');
        const voiceVisualizer = document.getElementById('voiceVisualizer');
        const voiceStatus = document.getElementById('voiceRecordingStatus');
        const voiceTranscript = document.getElementById('voiceTranscript');
        const expandVoiceBtn = document.getElementById('expandVoiceBtn');
        const shrinkVoiceBtn = document.getElementById('shrinkVoiceBtn');
        const voiceContainer = document.querySelector('.voice-visualizer-container');
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            voiceStatus.textContent = "您的瀏覽器不支持語音識別功能，請使用Chrome或Edge瀏覽器";
            voiceStatus.style.color = "#cc3333";
            startVoiceBtn.disabled = true;
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        
        let audioContext;
        let analyser;
        let microphone;
        let bars = [];
        let isRecording = false;
        let animationId;
        
        function createBars() {
            voiceVisualizer.innerHTML = '';
            const barCount = 50;
            
            for (let i = 0; i < barCount; i++) {
                const bar = document.createElement('div');
                bar.className = 'voice-bar';
                voiceVisualizer.appendChild(bar);
                bars.push(bar);
            }
        }
        
        function updateVisualizer(dataArray) {
            if (!isRecording) return;
            
            for (let i = 0; i < bars.length; i++) {
                const index = Math.floor(i * (dataArray.length / bars.length));
                const value = dataArray[index] / 128;
                const height = Math.max(5, value * 100);
                bars[i].style.height = `${height}px`;
            }
            
            animationId = requestAnimationFrame(() => updateVisualizer(dataArray));
        }
        
        startVoiceBtn.addEventListener('click', () => {
            try {
                if (!isRecording) {
                    recognition.lang = dom.sourceLang.value === '中文' ? 'zh-TW' : 'en-US';
                    
                    recognition.start();
                    
                    isRecording = true;
                    voiceStatus.textContent = "正在錄音...";
                    document.querySelector('.voice-container').classList.add('recording');
                    
                    startVoiceBtn.disabled = true;
                    stopVoiceBtn.disabled = false;
                    useVoiceTextBtn.disabled = true;
                    
                    if (!audioContext) {
                        audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        analyser = audioContext.createAnalyser();
                        analyser.fftSize = 256;
                    }
                    
                    createBars();
                    
                    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                        .then(stream => {
                            microphone = audioContext.createMediaStreamSource(stream);
                            microphone.connect(analyser);
                            
                            const bufferLength = analyser.frequencyBinCount;
                            const dataArray = new Uint8Array(bufferLength);
                            
                            function updateVisualizerLoop() {
                                if (!isRecording) return;
                                
                                analyser.getByteFrequencyData(dataArray);
                                updateVisualizer(dataArray);
                            }
                            
                            updateVisualizerLoop();
                        })
                        .catch(err => {
                            console.error("麥克風訪問錯誤:", err);
                            voiceStatus.textContent = "無法訪問麥克風";
                            voiceStatus.style.color = "#cc3333";
                        });
                }
            } catch (error) {
                console.error("語音識別啟動錯誤:", error);
                voiceStatus.textContent = `語音識別錯誤: ${error.message}`;
                voiceStatus.style.color = "#cc3333";
            }
        });
        
        stopVoiceBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
                isRecording = false;
                
                if (microphone) {
                    microphone.disconnect();
                    microphone = null;
                }
                
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                
                voiceStatus.textContent = "錄音已停止";
                document.querySelector('.voice-container').classList.remove('recording');
                
                bars.forEach(bar => bar.style.height = '5px');
                
                startVoiceBtn.disabled = false;
                stopVoiceBtn.disabled = true;
                useVoiceTextBtn.disabled = voiceTranscript.textContent.trim() === '';
            }
        });
        
        useVoiceTextBtn.addEventListener('click', () => {
            const recognizedText = voiceTranscript.textContent.trim();
            if (recognizedText) {
                document.querySelector('.tab-button[data-tab="textTab"]').click();
                
                dom.inputText.value = recognizedText;
                
                validateTranslationInput();
                
                dom.translateButton.focus();
            }
        });
        
        clearVoiceBtn.addEventListener('click', () => {
            voiceTranscript.textContent = '';
            useVoiceTextBtn.disabled = true;
            
            bars.forEach(bar => bar.style.height = '5px');
        });
        
        expandVoiceBtn.addEventListener('click', () => {
            const currentHeight = parseInt(window.getComputedStyle(voiceContainer).height);
            voiceContainer.style.height = `${currentHeight + 50}px`;
        });
        
        shrinkVoiceBtn.addEventListener('click', () => {
            const currentHeight = parseInt(window.getComputedStyle(voiceContainer).height);
            if (currentHeight > 100) {
                voiceContainer.style.height = `${currentHeight - 50}px`;
            }
        });
        
        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscript) {
                const previousText = voiceTranscript.textContent;
                voiceTranscript.textContent = previousText + finalTranscript + ' ';
                useVoiceTextBtn.disabled = false;
            } else if (interimTranscript) {
                const previousText = voiceTranscript.textContent;
                voiceTranscript.innerHTML = previousText + '<i>' + interimTranscript + '</i>';
            }
        };
        
        recognition.onerror = (event) => {
            console.error("語音識別錯誤:", event.error);
            voiceStatus.textContent = `錯誤: ${event.error}`;
            voiceStatus.style.color = "#cc3333";
            
            isRecording = false;
            startVoiceBtn.disabled = false;
            stopVoiceBtn.disabled = true;
            document.querySelector('.voice-container').classList.remove('recording');
        };
        
        recognition.onend = () => {
            if (isRecording) {
                recognition.start();
            }
        };
        
        createBars();
    }

    function editExtractedText() {
        const currentText = dom.extractedText.textContent;
        
        dom.extractedText.innerHTML = '';
        
        const editArea = document.createElement('textarea');
        editArea.className = 'edit-extracted-textarea';
        editArea.value = currentText;
        editArea.rows = 5;
        
        const saveButton = document.createElement('button');
        saveButton.className = 'button primary-button';
        saveButton.textContent = '保存';
        saveButton.style.marginRight = '10px';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'button secondary-button';
        cancelButton.textContent = '取消';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'edit-actions';
        actionsDiv.appendChild(saveButton);
        actionsDiv.appendChild(cancelButton);
        
        dom.extractedText.appendChild(editArea);
        dom.extractedText.appendChild(actionsDiv);
        
        const editButton = document.getElementById('editExtractedButton');
        if (editButton) editButton.style.display = 'none';
        
        saveButton.addEventListener('click', () => {
            const editedText = editArea.value.trim();
            dom.extractedText.textContent = editedText;
            if (editButton) editButton.style.display = 'inline-block';
            
            dom.translateExtractedButton.disabled = !editedText;
        });
        
        cancelButton.addEventListener('click', () => {
            dom.extractedText.textContent = currentText;
            if (editButton) editButton.style.display = 'inline-block';
        });
        
        editArea.focus();
    }

    function getLanguageName(langCode) {
        const langMap = {
            'eng': '英文',
            'chi_tra': '繁體中文',
            'chi_sim': '簡體中文',
            'jpn': '日文',
            'kor': '韓文',
            'fra': '法文',
            'deu': '德文',
            'spa': '西班牙文',
            'ita': '義大利文',
            'rus': '俄文'
        };
        
        return langMap[langCode] || langCode;
    }

    function convertToAPILanguageCode(uiLanguage) {
        const languageMap = {
            '中文': 'zh',
            '英文': 'en',
            '日文': 'ja',
            '韓文': 'ko',
            '法文': 'fr',
            '德文': 'de',
            '西班牙文': 'es',
            '義大利文': 'it',
            '俄文': 'ru'
        };
        
        return languageMap[uiLanguage] || 'en';
    }

    function initHuggingFaceTab() {
        updateIframeTheme();
        
        const refreshBtn = document.getElementById("refreshIframeBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                updateIframeTheme();
                showNotification("已重新載入 Hugging Face 介面", "info");
            });
        }
    }

    function updateIframeTheme() {
        const isDarkMode = document.body.classList.contains("dark-theme");
        const iframe = document.getElementById("huggingfaceFrame");
        if (iframe) {
            const baseUrl = "https://qwerty10218-gary-translate.hf.space";
            iframe.src = `${baseUrl}?__theme=${isDarkMode ? 'dark' : 'light'}`;
        }
    }

    function showNotification(message, type = "info", duration = 3000) {
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        
        // 根據類型添加圖標
        const icon = document.createElement("span");
        icon.className = "notification-icon";
        notification.appendChild(icon);
        
        const textContent = document.createElement("span");
        textContent.className = "notification-text";
        textContent.textContent = message;
        notification.appendChild(textContent);
        
        // 添加關閉按鈕
        const closeBtn = document.createElement("button");
        closeBtn.className = "notification-close";
        closeBtn.innerHTML = "×";
        closeBtn.onclick = () => {
            notification.classList.remove("show");
            setTimeout(() => notification.remove(), 300);
        };
        notification.appendChild(closeBtn);
        
        // 檢查是否已有相同內容的通知
        const existingNotifications = document.querySelectorAll('.notification');
        for (let existing of existingNotifications) {
            if (existing.querySelector('.notification-text').textContent === message) {
                existing.remove();
            }
        }
        
        document.body.appendChild(notification);
        
        // 添加動畫效果
        requestAnimationFrame(() => {
            notification.classList.add("show");
        });
        
        // 自動關閉
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove("show");
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }
        
        // 添加滑鼠懸停暫停自動關閉功能
        let timeoutId;
        notification.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
        });
        
        notification.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                notification.classList.remove("show");
                setTimeout(() => notification.remove(), 1000);
            }, 1000);
        });
    }

    function addToHistory(entry) {
        let history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        history.unshift(entry);
        if (history.length > 100) history.pop(); // 限制歷史記錄數量
        localStorage.setItem('translationHistory', JSON.stringify(history));
        updateHistoryDisplay();
    }

    function updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        
        historyList.innerHTML = history.map(entry => `
            <div class="history-item ${entry.isSpecial ? 'special' : ''} ${entry.useLibre ? 'libre' : ''}">
                <div class="history-meta">
                    <span>${new Date(entry.timestamp).toLocaleString()}</span>
                    <span>${entry.sourceLang} → ${entry.targetLang}</span>
                </div>
                <div class="history-content">
                    <div class="history-source">${entry.sourceText}</div>
                    <div class="history-target">${entry.targetText}</div>
                </div>
            </div>
        `).join('');
    }

    function initHistory() {
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const exportHistoryBtn = document.getElementById('exportHistoryBtn');

        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('確定要清除所有翻譯歷史嗎？')) {
                localStorage.removeItem('translationHistory');
                updateHistoryDisplay();
            }
        });

        exportHistoryBtn.addEventListener('click', () => {
            const history = localStorage.getItem('translationHistory');
            const blob = new Blob([history], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `translation_history_${new Date().toISOString()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        updateHistoryDisplay();
    }

    function initR18Translation() {
        dom.r18TranslateButton.addEventListener("click", () => handleTranslation(true));
        dom.r18CopyButton.addEventListener("click", () => copyToClipboard(dom.r18Result.textContent));
        dom.r18ClearButton.addEventListener("click", () => {
            dom.r18InputText.value = "";
            dom.r18Result.textContent = "";
        });
        dom.r18ClearResultButton.addEventListener("click", () => {
            dom.r18Result.textContent = "";
        });
        
        // 更新 R18 模型選擇下拉選單説明
        const r18ModelSelect = dom.r18ModelSelect;
        if (r18ModelSelect) {
            // 清空原有選項
            r18ModelSelect.innerHTML = '';
            
            // 添加新選項
            const myMemoryOption = document.createElement('option');
            myMemoryOption.value = 'mymemory';
            myMemoryOption.textContent = 'MyMemory API (純翻譯，無審查)';
            r18ModelSelect.appendChild(myMemoryOption);
            
            const libreOption = document.createElement('option');
            libreOption.value = 'libre';
            libreOption.textContent = 'LibreTranslate (純翻譯，作為備用)';
            r18ModelSelect.appendChild(libreOption);
        }
        
        // 添加 R18 分頁的說明文字
        const r18TabContent = document.getElementById('r18Tab');
        if (r18TabContent) {
            const warningBanner = r18TabContent.querySelector('.warning-banner');
            if (warningBanner) {
                warningBanner.innerHTML = `
                    ⚠️ R18 內容翻譯區 - 無內容限制
                    <p class="warning-description">
                      此區域使用純翻譯 API 進行翻譯，不審查成人、暴力或其他敏感內容。
                      選擇合適的選項來增強翻譯效果。翻譯時可能需要較長時間，請耐心等待。
                    </p>
                `;
            }
        }
    }

    function copyToClipboard(text) {
        if (!text) return;
        
        navigator.clipboard.writeText(text)
            .then(() => showNotification("已複製到剪貼簿", "success"))
            .catch(err => showNotification("複製失敗: " + err, "error"));
    }

    function initAPISettings() {
        // 移除 API 設置面板
        const apiSettingsPanel = document.querySelector('.api-settings-panel');
        if (apiSettingsPanel) {
            apiSettingsPanel.remove();
        }
    }

    // 更新翻譯進度條的動畫
    function updateTranslationProgress(progressBar, progress) {
        if (progress <= 0) {
            progressBar.style.width = "0%";
            return;
        }
        
        if (progress >= 100) {
            progressBar.style.width = "100%";
            progressBar.classList.add("complete");
            setTimeout(() => {
                progressBar.classList.remove("complete");
            }, 1000);
            return;
        }
        
        progressBar.style.width = `${progress}%`;
        
        // 添加脈動效果
        progressBar.classList.add("pulse");
        setTimeout(() => {
            progressBar.classList.remove("pulse");
        }, 500);
    }

    // 添加 API 狀態檢查
    async function checkAPIStatus() {
        const openrouterStatus = document.getElementById("openrouterStatus");
        const gptStatus = document.getElementById("gptStatus");
        
        // 檢查 OpenRouter API
        try {
            const response = await fetch(API_CONFIG.openrouter.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.openrouter.key}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "詮語翻譯"
                },
                body: JSON.stringify({
                    model: API_CONFIG.openrouter.model,
                    messages: [
                        {role: "user", content: "test"}
                    ]
                })
            });
            
            if (response.ok) {
                if (openrouterStatus) {
                    openrouterStatus.classList.add("connected");
                    openrouterStatus.parentElement.querySelector(".api-status-text").textContent = "已連接";
                }
            } else {
                if (openrouterStatus) {
                    openrouterStatus.classList.remove("connected");
                    openrouterStatus.parentElement.querySelector(".api-status-text").textContent = "未連接";
                }
            }
        } catch (error) {
            if (openrouterStatus) {
                openrouterStatus.classList.remove("connected");
                openrouterStatus.parentElement.querySelector(".api-status-text").textContent = "未連接";
            }
        }
        
        // 檢查 GPT API
        try {
            const response = await fetch(API_CONFIG.gpt.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.gpt.key}`
                },
                body: JSON.stringify({
                    model: API_CONFIG.gpt.model,
                    messages: [
                        {role: "user", content: "test"}
                    ]
                })
            });
            
            if (response.ok) {
                if (gptStatus) {
                    gptStatus.classList.add("connected");
                    gptStatus.parentElement.querySelector(".api-status-text").textContent = "已連接";
                }
            } else {
                if (gptStatus) {
                    gptStatus.classList.remove("connected");
                    gptStatus.parentElement.querySelector(".api-status-text").textContent = "未連接";
                }
            }
        } catch (error) {
            if (gptStatus) {
                gptStatus.classList.remove("connected");
                gptStatus.parentElement.querySelector(".api-status-text").textContent = "未連接";
            }
        }
    }

    // 添加設置標籤頁初始化
    function initSettings() {
        const clearLocalStorageBtn = document.getElementById("clearLocalStorage");
        
        if (clearLocalStorageBtn) {
            clearLocalStorageBtn.addEventListener("click", () => {
                if (confirm("確定要清除所有本地數據嗎？這將刪除所有設置和歷史記錄。")) {
                    localStorage.clear();
                    showNotification("所有本地數據已清除", "success");
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            });
        }
        
        // 檢查 API 狀態
        checkAPIStatus();
    }

    init();
});
