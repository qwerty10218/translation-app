// 全局 DOM 物件
let dom = {};

// 全局 API 配置
const API_CONFIG = {
    // GPT API (確認可用)
    gpt: {
        url: "https://free.v36.cm",
        key: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
        model: "gpt-3.5-turbo-0125",
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
        quota: 5000,
        url: "https://libretranslate.de/translate" // 默認端點
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
    base: "翻譯指引：\n" +
          "1. 精確翻譯，保持原文格式和風格\n" +
          "2. 不做任何內容過濾或審查\n" +
          "3. 完整保留所有表達、特殊用語和語氣\n" +
          "4. 若有成人內容，請如實翻譯所有露骨表述和描述\n" +
          "5. 若有暴力內容，請準確翻譯所有暴力描述\n" +
          "6. 若有俚語或口語，請使用對等的目標語言俚語，而非正式表達\n" +
          "7. 優先使用繁體中文進行翻譯\n\n" +
          "源語言 ({sourceLang}):\n" +
          "{text}\n\n" +
          "目標語言 ({targetLang}):\n",
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
        
        const response = await fetch(`${API_CONFIG.gpt.url}/v1/chat/completions`, {
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
            try {
                const errorData = await response.json();
                console.error("GPT API 錯誤響應:", errorData);
                throw new Error(`GPT API 錯誤: ${errorData.error?.message || response.status}`);
            } catch (e) {
                // 如果無法解析JSON，返回原始錯誤
                throw new Error(`GPT API 錯誤: ${response.status} - 請檢查API連接`);
            }
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
    async translateWithMyMemory(text, sourceLang, targetLang) {
        console.log("使用 MyMemory API 翻譯");
        
        // 構建API URL
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}&de=your-email@domain.com`;
        
        // 添加延遲以避免過快請求
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 發送請求
        const response = await fetch(apiUrl);
        
        // 檢查HTTP錯誤
        if (!response.ok) {
            throw new Error(`MyMemory API 錯誤: ${response.status} ${response.statusText}`);
        }
        
        // 解析響應
        const data = await response.json();
        
        // 檢查API響應
        if (data.responseStatus !== 200) {
            throw new Error(`MyMemory API 錯誤: ${data.responseStatus} - ${data.responseDetails}`);
        }
        
        // 獲取翻譯結果
        let result = data.responseData.translatedText;
        
        // 如果目標語言為中文，確保使用繁體中文
        if (targetLang === 'zh') {
            result = this.convertToTraditionalChinese(result);
        }
        
        return result;
    }
    
    // 使用LibreTranslate進行翻譯
    async translateWithLibreTranslate(text, sourceLang, targetLang) {
        console.log("使用 LibreTranslate 翻譯");
        
        // 使用免費的LibreTranslate實例
        const apiUrl = 'https://libretranslate.de/translate';
        
        // 添加延遲以避免過快請求
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 構建請求數據
        const requestData = {
            q: text,
            source: sourceLang,
            target: targetLang,
            format: "text"
        };
        
        // 發送POST請求
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify(requestData),
            headers: {
                'Content-Type': 'application/json,'
            }
        });
        
        // 檢查HTTP錯誤
        if (!response.ok) {
            throw new Error(`LibreTranslate 錯誤: ${response.status} ${response.statusText}`);
        }
        
        // 解析響應
        const data = await response.json();
        
        // 獲取翻譯結果
        let result = data.translatedText;
        
        // 如果目標語言為中文，確保使用繁體中文
        if (targetLang === 'zh') {
            result = this.convertToTraditionalChinese(result);
        }
        
        return result;
    }
    
    // 簡轉繁處理
    convertToTraditionalChinese(text) {
        // TODO: 實現更完整的簡轉繁功能
        // 這裡僅做一些基本替換示例
        const simplifiedToTraditional = {
            '简': '簡', '体': '體', '东': '東', '西': '西', '南': '南', '北': '北',
            '是': '是', '的': '的', '在': '在', '了': '了', '和': '和', '有': '有',
            '为': '為', '这': '這', '那': '那', '个': '個', '说': '說', '时': '時',
            '去': '去', '过': '過', '来': '來', '做': '做', '会': '會', '对': '對',
            '能': '能', '要': '要', '于': '於', '发': '發', '可': '可', '见': '見'
        };
        
        // 替換字符
        let result = text;
        for (const [simplified, traditional] of Object.entries(simplifiedToTraditional)) {
            result = result.replace(new RegExp(simplified, 'g'), traditional);
        }
        
        return result;
    }
    
    // 實現備用 API 翻譯方法
    async translateWithBackupAPI(inputText, sourceLang, targetLang) {
        // 直接使用 GPT 作為備用
        return await this.translateWithGPT(inputText, sourceLang, targetLang);
    }
    
    // 創建進度條
    createProgressBar() {
        // 檢查是否已存在進度條
        let progressContainer = document.getElementById("progressContainer");
        
        if (!progressContainer) {
            // 創建進度條容器
            progressContainer = document.createElement("div");
            progressContainer.id = "progressContainer";
            progressContainer.className = "progress-container";
            
            // 創建進度條
            const progressBar = document.createElement("div");
            progressBar.id = "progressBar";
            progressBar.className = "progress-bar";
            
            // 添加進度條到容器
            progressContainer.appendChild(progressBar);
            
            // 添加到頁面
            const actionPanel = document.querySelector(".action-panel");
            if (actionPanel) {
                actionPanel.appendChild(progressContainer);
            } else {
                document.body.appendChild(progressContainer);
            }
        }
        
        return {
            container: document.getElementById("progressContainer"),
            bar: document.getElementById("progressBar")
        };
    }
}

// 初始化翻譯管理器
window.translationManager = new TranslationManager();

document.addEventListener("DOMContentLoaded", () => {
});


// DOM元素
const domElements = {
    // 標籤頁
    tabs: document.querySelectorAll(".tab-button"),
    tabContents: document.querySelectorAll(".tab-content"),
    
     // 文字翻译模块
    translation: {
        inputText: document.getElementById("inputText"),
        result: document.getElementById("result"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        translateButton: document.getElementById("translateButton"),
        clearTextButton: document.getElementById("clearTextButton"),
        swapLangButton: document.getElementById("swapLang"),
        copyResultButton: document.getElementById("copyResultButton"),
        clearResultButton: document.getElementById("clearResultButton")
    },
    
    // 进度条模块
    progress: {
        container: document.getElementById("progressContainer"),
        bar: document.getElementById("progressBar"),
        specialContainer: document.getElementById("specialProgressContainer"),
        specialBar: document.getElementById("specialProgressBar")
    },
    
    // 主题切换
    theme: {
        toggle: document.getElementById("themeToggle")
    },
    
    // 图像处理模块
    image: {
        dropArea: document.getElementById("imageDropArea"),
        input: document.getElementById("imageInput"),
        canvas: document.getElementById("imageCanvas"),
        enhanceContrastButton: document.getElementById("enhanceContrastButton"),
        grayscaleButton: document.getElementById("grayscaleButton"),
        resetButton: document.getElementById("resetImageButton"),
        clearButton: document.getElementById("clearImageButton"),
        uploadButton: document.getElementById("uploadImageButton"),
        extractTextButton: document.getElementById("extractTextButton"),
        extractedText: document.getElementById("extractedText"),
        translateExtractedButton: document.getElementById("translateExtractedButton"),
        ocrLanguageSelect: document.getElementById("ocrLanguageSelect")
    },
    
    // 语音模块
    voice: {
        startButton: document.getElementById("startVoiceBtn"),
        stopButton: document.getElementById("stopVoiceBtn"),
        visualizer: document.getElementById("voiceVisualizer"),
        recordingStatus: document.getElementById("voiceRecordingStatus"),
        transcript: document.getElementById("voiceTranscript"),
        useTextButton: document.getElementById("useVoiceTextBtn"),
        clearButton: document.getElementById("clearVoiceBtn"),
        expandButton: document.getElementById("expandVoiceBtn"),
        shrinkButton: document.getElementById("shrinkVoiceBtn")
    },
    
    // R18 翻译模块
    r18Translation: {
        inputText: document.getElementById("r18InputText"),
        result: document.getElementById("r18Result"),
        translateButton: document.getElementById("r18TranslateButton"),
        clearButton: document.getElementById("r18ClearButton"),
        copyButton: document.getElementById("r18CopyButton"),
        clearResultButton: document.getElementById("r18ClearResultButton"),
        sourceLang: document.getElementById("r18SourceLang"),
        targetLang: document.getElementById("r18TargetLang"),
        swapLangButton: document.getElementById("r18SwapLang"),
        modelSelect: document.getElementById("r18ModelSelect")
    },
    
    // 内容过滤
    contentFilter: {
        adultContent: document.getElementById("adultContent"),
        violenceContent: document.getElementById("violenceContent"),
        slangContent: document.getElementById("slangContent")
    },
    
    // 历史记录
    history: {
        list: document.getElementById("historyList"),
        clearButton: document.getElementById("clearHistoryBtn"),
        exportButton: document.getElementById("exportHistoryBtn")
    },
    
    // 标签页
    tabs: {
        text: document.getElementById("textTab"),
        image: document.getElementById("imageTab"),
        voice: document.getElementById("voiceTab"),
        r18: document.getElementById("r18Tab"),
        history: document.getElementById("historyTab"),
        settings: document.getElementById("settingsTab")
    },
    
    // 模型选择
    modelSelect: document.querySelector(".model-select")
};

// 使用示例
function initTranslation() {
    const { 
        inputText, 
        translateButton, 
        clearTextButton 
    } = domElements.translation;
    
    // 添加事件监听器的示例
    translateButton.addEventListener('click', translateText);
    clearTextButton.addEventListener('click', clearInput);
}

// 初始化应用
function init() {
    initTranslation();
    // 其他模块初始化...
}

// 调用初始化
init();

function init() {
    console.log("初始化應用...");
    
    // 初始化DOM引用
    initDOM();
    
    // 初始化標籤頁
    initTabs();
    
    // 初始化翻譯功能
    initTranslation();
    
    // 初始化圖片翻譯
    initImageTranslation();
    
    // 初始化拖放功能
    initDragAndDrop();
    
    // 初始化按鈕操作
    initButtons();
    
    // 初始化主題
    initTheme();
    
    // 初始化語音識別
    initVoiceRecognition();
    
    // 初始化歷史記錄
    initHistory();
    
    // 初始化 R18 翻譯
    initR18Translation();
    
    // 初始化 API 設置
    initAPISettings();
    
    // 初始化設置選項
    initSettings();
    
    // 初始化 HuggingFace 嵌入
    initHuggingFaceTab();
    
    console.log("應用初始化完成");
    
    // 創建翻譯管理器並掛載到全局
    window.translationManager = new TranslationManager();
}

// 3. 修改 initButtons 函數，增加錯誤處理和元素檢查
function initButtons() {
    try {
        console.log("初始化按鈕...");
        
        // 檢查dom物件和translation物件是否存在
        if (!dom || !dom.translation) {
            console.error("DOM物件未初始化，無法初始化按鈕");
            return;
        }
        
        const { 
            clearTextButton, 
            copyResultButton, 
            clearResultButton, 
            inputText, 
            result 
        } = dom.translation;
        
        // 重置按鈕
        if (clearTextButton && inputText) {
            clearTextButton.addEventListener("click", () => {
                inputText.value = "";
                validateTranslationInput(false);
            });
        }
        
        // 複製結果按鈕
        if (copyResultButton && result) {
            copyResultButton.addEventListener("click", () => {
                if (result.textContent) {
                    copyToClipboard(result.textContent);
                }
            });
        }
        
        // 清除結果按鈕
        if (clearResultButton && result) {
            clearResultButton.addEventListener("click", () => {
                result.textContent = "";
            });
        }
        
        // 清除所有按鈕
        const clearAllButton = document.getElementById("clearAllButton");
        if (clearAllButton && inputText && result) {
            clearAllButton.addEventListener("click", () => {
                inputText.value = "";
                result.textContent = "";
                validateTranslationInput(false);
            });
        }
        
        console.log("按鈕初始化完成");
    } catch (error) {
        console.error("按鈕初始化失敗:", error);
    }
}

// 修正 initTabs 函數，添加適當的錯誤處理
function initTabs() {
    try {
        // 使用更安全的選擇器方式
        const tabButtons = document.querySelectorAll(".tab-button");
        if (!tabButtons || tabButtons.length === 0) {
            console.warn("找不到標籤頁按鈕，跳過標籤頁初始化");
            return;
        }

        const tabContents = document.querySelectorAll(".tab-content");
        if (!tabContents || tabContents.length === 0) {
            console.warn("找不到標籤頁內容，跳過標籤頁初始化");
            return;
        }

        // 為每個標籤按鈕添加點擊事件
        tabButtons.forEach(button => {
            if (button) {  // 額外檢查確保元素存在
                button.addEventListener("click", () => {
                    // 移除所有標籤和內容的活動狀態
                    tabButtons.forEach(btn => btn.classList.remove("active"));
                    tabContents.forEach(content => content.classList.remove("active"));
                    
                    // 激活被點擊的標籤
                    button.classList.add("active");
                    
                    // 獲取目標標籤頁ID
                    const targetTabId = button.getAttribute("data-tab");
                    if (targetTabId) {
                        const targetContent = document.getElementById(targetTabId);
                        if (targetContent) {
                            targetContent.classList.add("active");
                        }
                    }
                    
                    // 清空結果區域
                    if (dom.translation && dom.translation.result) {
                        dom.translation.result.textContent = "";
                    }
                });
            }
        });
        
        // 初始化時激活第一個標籤頁
        if (tabButtons[0]) {
            tabButtons[0].click();
        }
    } catch (error) {
        console.error("標籤頁初始化失敗:", error);
    }
}

function initTranslation() {
    try {
        // 檢查必要的DOM元素是否存在
        if (!dom || !dom.translation) {
            console.error("翻譯相關DOM元素未初始化");
            return;
        }
        
        const { 
            inputText, 
            translateButton, 
            clearTextButton,
            sourceLang,
            targetLang,
            swapLangButton,
            copyResultButton
        } = dom.translation;
        
        // 檢查關鍵元素
        if (!translateButton) {
            console.error("翻譯按鈕未找到");
            return;
        }
        
        let lastTranslationTime = 0;
        
        // 初始化模型選擇器
        const modelSelect = document.getElementById("modelSelect");
        const r18ModelSelect = document.getElementById("r18ModelSelect");
        
        if (modelSelect) {
            modelSelect.addEventListener("change", (e) => {
                if (window.translationManager) {
                    window.translationManager.setModel(e.target.value);
                    localStorage.setItem("selectedModel", e.target.value);
                    showNotification(`已切換到 ${e.target.value} 模型`, "info");
                }
            });
            
            // 從本地存儲中讀取之前選擇的模型
            const savedModel = localStorage.getItem("selectedModel");
            if (savedModel && window.translationManager) {
                modelSelect.value = savedModel;
                window.translationManager.setModel(savedModel);
            }
        }
        
        if (r18ModelSelect) {
            r18ModelSelect.addEventListener("change", (e) => {
                if (window.translationManager) {
                    window.translationManager.setModel(e.target.value);
                    localStorage.setItem("selectedModel", e.target.value);
                    showNotification(`已切換到 ${e.target.value} 模型`, "info");
                }
            });
            
            // 同步兩個選擇器的值
            if (modelSelect) {
                r18ModelSelect.value = modelSelect.value;
            }
        }
        
        // 確保頁面載入時執行驗證
        if (inputText && translateButton) {
            validateTranslationInput(false);
        }
        
        // 添加翻譯按鈕點擊事件
        translateButton.addEventListener("click", async () => {
            // 檢查是否有預設的防抖時間
            const now = Date.now();
            if (now - lastTranslationTime < 3000) {
                showNotification("請稍等片刻再進行下一次翻譯請求", "warning");
                return;
            }
            lastTranslationTime = now;
            
            if (!inputText || !sourceLang || !targetLang) {
                showNotification("翻譯元素未初始化完成", "error");
                return;
            }
            
            const text = inputText.value.trim();
            const sLang = sourceLang.value;
            const tLang = targetLang.value;
            
            if (!text) {
                showNotification("請輸入要翻譯的文字", "warning");
                return;
            }
            
            try {
                translateButton.disabled = true;
                translateButton.innerHTML = '<span class="button-icon">⏳</span>翻譯中...';
                
                // 更新進度
                updateProgressBar(10);
                
                if (!window.translationManager) {
                    throw new Error("翻譯管理器未初始化");
                }
                
                const translatedText = await window.translationManager.translate(text, sLang, tLang);
                
                if (dom.translation.result) {
                    dom.translation.result.textContent = translatedText;
                    
                    // 嘗試添加到歷史記錄
                    try {
                        addToHistory({
                            timestamp: new Date().toISOString(),
                            sourceText: text,
                            targetText: translatedText,
                            sourceLang: sLang,
                            targetLang: tLang,
                            isSpecial: false
                        });
                    } catch (historyError) {
                        console.warn("添加到歷史記錄失敗:", historyError);
                    }
                }
                
                showNotification("翻譯完成", "success");
                updateProgressBar(100);
            } catch (error) {
                console.error("翻譯失敗:", error);
                if (dom.translation.result) {
                    dom.translation.result.textContent = `翻譯失敗: ${error.message}`;
                }
                showNotification(`翻譯失敗: ${error.message}`, "error");
                updateProgressBar(0);
            } finally {
                translateButton.disabled = false;
                translateButton.innerHTML = '<span class="button-icon">🔄</span>翻譯';
            }
        });
        
        // 添加其他按鈕事件
        if (swapLangButton && sourceLang && targetLang) {
            swapLangButton.addEventListener("click", () => {
                [sourceLang.value, targetLang.value] = [targetLang.value, sourceLang.value];
                validateTranslationInput(false);
            });
        }
        
        if (inputText) {
            inputText.addEventListener("input", () => validateTranslationInput(false));
        }
        
        if (sourceLang) {
            sourceLang.addEventListener("change", () => validateTranslationInput(false));
        }
        
        if (targetLang) {
            targetLang.addEventListener("change", () => validateTranslationInput(false));
        }
        
        // 初始化其他按鈕
        if (clearTextButton && inputText) {
            clearTextButton.addEventListener("click", () => {
                inputText.value = "";
                validateTranslationInput(false);
            });
        }
        
        if (copyResultButton && dom.translation.result) {
            copyResultButton.addEventListener("click", () => {
                if (dom.translation.result.textContent) {
                    copyToClipboard(dom.translation.result.textContent);
                }
            });
        }
        
        console.log("翻譯功能初始化完成");
    } catch (error) {
        console.error("翻譯功能初始化失敗:", error);
    }
}

function swapLanguages() {
    [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
    validateTranslationInput();
}

// 1. 修復 validateTranslationInput 函數，增加安全檢查
function validateTranslationInput(isR18 = false) {
    try {
        // 檢查dom物件和對應的子物件是否存在
        if (!dom) return false;
        
        // 對於R18模式，檢查r18物件是否已初始化
        if (isR18 && !dom.r18) return false;
        
        // 對於標準模式，檢查translation物件是否已初始化
        if (!isR18 && !dom.translation) return false;
        
        // 安全取值
        const sourceLang = isR18 ? 
            (dom.r18?.sourceLang?.value || '') : 
            (dom.translation?.sourceLang?.value || '');
        
        const targetLang = isR18 ? 
            (dom.r18?.targetLang?.value || '') : 
            (dom.translation?.targetLang?.value || '');
        
        const inputText = isR18 ? 
            (dom.r18?.inputText?.value?.trim() || '') : 
            (dom.translation?.inputText?.value?.trim() || '');
        
        const translateButton = isR18 ? 
            dom.r18?.translateButton : 
            dom.translation?.translateButton;
        
        // 檢查輸入是否為空
        const isInputEmpty = !inputText;
        
        // 檢查源語言和目標語言是否相同
        const isSameLang = sourceLang === targetLang && sourceLang !== '';
        
        // 禁用或啟用翻譯按鈕（如果存在）
        if (translateButton) {
            translateButton.disabled = isInputEmpty || isSameLang;
        }
        
        // 如果語言相同，顯示警告
        if (isSameLang && !isInputEmpty) {
            showNotification("源語言和目標語言不能相同", "warning");
        }
        
        // 返回驗證結果
        return !isInputEmpty && !isSameLang;
    } catch (error) {
        console.error("驗證翻譯輸入失敗:", error);
        return false;
    }
}

// 處理翻譯請求
async function handleTranslation(isR18 = false) {
    try {
        // 確保 dom 物件已定義
        if (!dom) {
            console.error("DOM物件未定義!");
            showNotification("應用未完全初始化，請刷新頁面", "error");
            return;
        }
        
        // 獲取對應的元素
        const inputElement = isR18 ? dom.r18InputText : dom.inputText;
        const resultElement = isR18 ? dom.r18Result : dom.result;
        const translateButton = isR18 ? dom.r18TranslateButton : dom.translateButton;
        
        // 檢查DOM元素是否存在
        if (!inputElement || !resultElement || !translateButton) {
            console.error("必要的DOM元素未找到:", {inputElement, resultElement, translateButton});
            showNotification("應用界面元素未找到，請刷新頁面", "error");
            return;
        }
        
        // 獲取輸入文本
        const inputText = inputElement.value.trim();
        if (!inputText) {
            showNotification("請輸入要翻譯的文字", "warning");
            return;
        }
        
        // 獲取語言設置
        const sourceLang = isR18 ? dom.r18SourceLang.value : dom.sourceLang.value;
        const targetLang = isR18 ? dom.r18TargetLang.value : dom.targetLang.value;
        
        // 驗證翻譯輸入
        const validationResult = validateTranslationInput(inputText, sourceLang, targetLang);
        if (!validationResult.valid) {
            showNotification(validationResult.message, "warning");
            return;
        }
        
        // 更新按鈕狀態
        translateButton.disabled = true;
        translateButton.innerHTML = '<span class="button-icon">⏳</span>翻譯中...';
        
        // 顯示加載狀態
        resultElement.textContent = "翻譯中...";
        
        // 顯示並更新進度條
        updateProgressBar(10);
        
        // 開始翻譯
        const translatedText = await window.translationManager.translate(
            inputText,
            sourceLang,
            targetLang,
            isR18
        );
        
        // 更新結果
        resultElement.textContent = translatedText;
        
        // 更新按鈕狀態
        translateButton.disabled = false;
        translateButton.innerHTML = '<span class="button-icon">🔄</span>翻譯';
        
        // 添加到歷史記錄
        addToHistory(inputText, translatedText, sourceLang, targetLang, isR18);
        
        // 更新進度條至 100%
        updateProgressBar(100);
        
    } catch (error) {
        console.error("翻譯失敗:", error);
        showNotification(`翻譯失敗: ${error.message}`, "error");
        
        // 重置按鈕狀態
        const translateButton = isR18 ? dom.r18TranslateButton : dom.translateButton;
        if (translateButton) {
            translateButton.disabled = false;
            translateButton.innerHTML = '<span class="button-icon">🔄</span>翻譯';
        }
        
        // 重置進度條
        updateProgressBar(0);
    }
}

function initImageTranslation() {
    try {
        // 檢查必要的DOM元素是否存在
        if (!dom || !dom.image) {
            console.error("圖片相關DOM元素未初始化");
            return;
        }

        const {
            input,
            extractTextButton,
            extractedText,
            translateExtractedButton,
            uploadImageButton,
            enhanceContrastButton,
            grayscaleButton,
            resetImageButton,
            clearImageButton,
            ocrLanguageSelect
        } = dom.image;

        // 檢查關鍵元素
        if (!input) {
            console.error("圖片輸入元素未找到");
            return;
        }

        // 添加圖片上傳和處理事件
        if (input) {
            input.addEventListener("change", handleImageUpload);
        }

        if (extractTextButton) {
            extractTextButton.addEventListener("click", extractTextFromImage);
        }

        if (translateExtractedButton && extractedText) {
            translateExtractedButton.addEventListener("click", () => {
                if (extractedText.textContent) {
                    translateExtractedText();
                }
            });
        }
        
        // 添加上傳圖片按鈕事件監聽器
        if (uploadImageButton) {
            uploadImageButton.addEventListener("click", () => {
                if (input) input.click();
            });
        }

        // 添加圖片工具按鈕事件監聽器
        if (enhanceContrastButton) {
            enhanceContrastButton.addEventListener("click", enhanceImageContrast);
        }
        
        if (grayscaleButton) {
            grayscaleButton.addEventListener("click", convertImageToGrayscale);
        }
        
        if (resetImageButton) {
            resetImageButton.addEventListener("click", resetImage);
        }
        
        if (clearImageButton) {
            clearImageButton.addEventListener("click", clearImageData);
        }
        
        console.log("圖片翻譯功能初始化完成");
    } catch (error) {
        console.error("圖片翻譯功能初始化失敗:", error);
    }
}

function initDragAndDrop() {
    try {
        // 確保 dom 和圖片物件已初始化
        if (!dom || !dom.image) {
            console.error("拖放功能初始化失敗：DOM 未完全初始化");
            return;
        }

        const dropArea = dom.image.dropArea;
        if (!dropArea) {
            console.error("拖放功能初始化失敗：未找到拖放區域元素");
            return;
        }

        // 添加拖放事件監聽器
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
                if (dom.image.input) {
                    dom.image.input.files = dt.files;
                    processImageFile(file);
                }
            } else {
                showNotification("請上傳圖片文件", "warning");
            }
        }, false);

        dropArea.addEventListener('click', () => {
            if (dom.image.input) {
                dom.image.input.click();
            }
        });

        console.log("拖放功能初始化完成");
    } catch (error) {
        console.error("拖放功能初始化失敗:", error);
    }
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

    const sourceLanguage = document.getElementById('imageSourceLang');
    const targetLanguage = document.getElementById('imageTargetLang');
    
    if (!sourceLanguage || !targetLanguage) {
        alert("無法獲取語言選擇元素");
        return;
    }
    
    if (sourceLanguage.value === targetLanguage.value) {
        alert("源語言和目標語言不能相同");
        return;
    }
    
    // 設置進度條
    let progressBar = null;
    if (translationManager) {
        progressBar = translationManager.createProgressBar();
    }
    
    try {
        dom.translateExtractedButton.disabled = true;
        dom.translateExtractedButton.textContent = "翻譯中...";
        
        // 使用圖片翻譯模型
        const model = document.getElementById('imageModelSelect') ? 
                      document.getElementById('imageModelSelect').value : 
                      'gpt-3.5-turbo';
                          
        if (translationManager) {
            translationManager.setModel(model);
        }
        
        const result = await translationManager.translate(
            extractedText,
            sourceLanguage.value,
            targetLanguage.value
        );
        
        if (!result || result.trim() === '') {
            throw new Error("翻譯結果為空");
        }

        // 顯示結果
        dom.result.innerHTML = result;
        // 定位到主文字翻譯標籤頁
        document.querySelector('.tab-button[data-tab="textTab"]').click();
        // 滾動到結果區域
        dom.result.scrollIntoView({ behavior: 'smooth' });
        
        showNotification("翻譯完成", "success");
        
    } catch (error) {
        console.error("圖片翻譯錯誤:", error);
        showNotification(`翻譯失敗: ${error.message}`, "error");
        
        // 設置一個溫和的錯誤提示而不是undefined
        dom.result.innerHTML = `<div class="error-message">翻譯過程中出現問題。請再試一次，或嘗試不同的圖片。</div>`;
    } finally {
        dom.translateExtractedButton.disabled = false;
        dom.translateExtractedButton.innerHTML = '<span class="button-icon">🔄</span>翻譯擷取文字';
        
        // 進度條處理
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.classList.add('complete');
            setTimeout(() => {
                progressBar.parentElement.remove();
            }, 1000);
        }
    }
}

function clearImageData() {
    try {
        if (!dom.image) return;
        
        const { canvas, extractedText, input } = dom.image;
        
        if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
            canvas.style.display = "none";
        }
        
        if (extractedText) {
            extractedText.textContent = "";
        }
        
        if (input) {
            input.value = "";
        }
        
        // 禁用提取文字和翻譯按鈕
        if (dom.image.extractTextButton) {
            dom.image.extractTextButton.disabled = true;
        }
        
        if (dom.image.translateExtractedButton) {
            dom.image.translateExtractedButton.disabled = true;
        }
        
        showNotification("已清除圖片數據", "success");
    } catch (error) {
        console.error("清除圖片數據失敗:", error);
    }
}

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme');
    const themeOverlay = document.getElementById('themeTransitionOverlay');
    
    if (!themeToggle) {
        console.error('暗色模式切換按鈕不存在！');
        return;
    }
    
    // 設置初始主題
    if (savedTheme === 'dark-theme') {
        document.body.classList.add('dark-theme');
    } else if (savedTheme === 'light-theme') {
        document.body.classList.remove('dark-theme');
    } else {
        // 如果沒有保存的主題，使用系統偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.classList.add('dark-theme');
        }
    }
    
    // 更新主題切換按鈕文本
    updateThemeToggleText();
    
    // 主題切換事件
    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        
        // 啟動舞台簾幕效果
        if (themeOverlay) {
            // 設置合適的過渡動畫類
            themeOverlay.classList.remove('light-to-dark', 'dark-to-light');
            themeOverlay.classList.add(isDark ? 'dark-to-light' : 'light-to-dark');
            themeOverlay.classList.add('active');
            
            // 延遲主題切換，等待動畫中點
            setTimeout(() => {
                if (isDark) {
                    document.body.classList.remove('dark-theme');
                    localStorage.setItem('theme', 'light-theme');
                } else {
                    document.body.classList.add('dark-theme');
                    localStorage.setItem('theme', 'dark-theme');
                }
                
                updateThemeToggleText();
                updateIframeTheme();
            }, 400); // 動畫中點時間
            
            // 動畫結束後移除活動狀態
            setTimeout(() => {
                themeOverlay.classList.remove('active');
            }, 800); // 完整動畫時間
        } else {
            // 如果沒有覆蓋層，則直接切換主題
            if (isDark) {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light-theme');
            } else {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark-theme');
            }
            
            updateThemeToggleText();
            updateIframeTheme();
        }
        
        // 顯示通知
        const currentTheme = document.body.classList.contains('dark-theme') ? '深色' : '淺色';
        showNotification(`已切換到${currentTheme}模式`, "info");
    });
    
    // 監聽系統主題變化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
            updateThemeToggleText();
            updateIframeTheme();
        }
    });
}

function updateThemeToggleText() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    
    // 確保其他依賴主題的元素更新
    const allElements = document.querySelectorAll('[data-theme-dependent]');
    allElements.forEach(el => {
        if (typeof el.updateTheme === 'function') {
            el.updateTheme(isDark);
        }
    });
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
    
    // 定義語言映射表
    const languageMapping = {
        'zh': 'zh-TW', // 繁體中文
        'en': 'en-US', // 英文
        'ja': 'ja-JP', // 日文
        'ko': 'ko-KR'  // 韓文
    };
    
    // 創建語音語言選擇器
    const voiceTabContent = document.getElementById('voiceTab');
    if (voiceTabContent && !document.getElementById('voiceLanguageSelector')) {
        const languageSelector = document.createElement('div');
        languageSelector.id = 'voiceLanguageSelector';
        languageSelector.className = 'voice-language-selector';
        
        const label = document.createElement('label');
        label.textContent = '語音識別語言：';
        
        const select = document.createElement('select');
        select.id = 'voiceLanguageSelect';
        
        // 添加語言選項
        const options = [
            { value: 'zh-TW', text: '繁體中文' },
            { value: 'en-US', text: '英文' },
            { value: 'ja-JP', text: '日文' },
            { value: 'ko-KR', text: '韓文' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            select.appendChild(optionElement);
        });
        
        languageSelector.appendChild(label);
        languageSelector.appendChild(select);
        
        // 插入到語音控制區域
        const voiceControls = voiceTabContent.querySelector('.voice-controls');
        if (voiceControls) {
            voiceControls.appendChild(languageSelector);
        }
        
        // 添加事件監聽器
        select.addEventListener('change', function() {
            // 如果正在錄音，停止並重新開始以應用新語言
            if (isRecording) {
                stopVoiceRecognition(voiceStatus, startVoiceBtn, stopVoiceBtn, useVoiceTextBtn);
                setTimeout(() => {
                    startVoiceRecognition(voiceVisualizer, voiceStatus, voiceTranscript, startVoiceBtn, stopVoiceBtn, useVoiceTextBtn);
                }, 500);
            }
        });
    }
    
    // 獲取當前選擇的語音語言
    function getCurrentLanguage() {
        const voiceLanguageSelect = document.getElementById('voiceLanguageSelect');
        if (voiceLanguageSelect) {
            return voiceLanguageSelect.value;
        }
        
        // 如果沒有語音語言選擇器，則使用源語言
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return 'zh-TW'; // 默認繁體中文
        
        // 根據當前標籤頁獲取相應的語言選擇框
        let sourceLanguageSelect;
        
        if (activeTab.id === 'textTab') {
            sourceLanguageSelect = document.getElementById('sourceLang');
        } else if (activeTab.id === 'imageTab') {
            sourceLanguageSelect = document.getElementById('imageSourceLang');
        } else if (activeTab.id === 'r18Tab') {
            sourceLanguageSelect = document.getElementById('r18SourceLang');
        } else {
            return 'zh-TW'; // 默認繁體中文
        }
        
        // 獲取選擇的語言代碼並映射到語音API支持的格式
        const selectedLang = sourceLanguageSelect ? sourceLanguageSelect.value : 'zh';
        return languageMapping[selectedLang] || 'zh-TW';
    }
    
    let audioContext;
    let analyser;
    let microphone;
    let bars = [];
    let isRecording = false;
    let animationId;
    let detectedLanguage = '';
    
    // 創建語言檢測器
    const languageDetector = {
        detect: function(text) {
            // 簡易語言檢測
            const patterns = {
                'zh-TW': /[\u4e00-\u9fff]/g, // 中文字符
                'en-US': /[a-zA-Z]/g,         // 英文字符
                'ja-JP': /[\u3040-\u309f\u30a0-\u30ff]/g, // 日文
                'ko-KR': /[\uac00-\ud7af]/g  // 韓文
            };
            
            let maxCount = 0;
            let detectedLang = 'en-US'; // 默認英文
            
            for (const [lang, pattern] of Object.entries(patterns)) {
                const matches = text.match(pattern);
                const count = matches ? matches.length : 0;
                if (count > maxCount) {
                    maxCount = count;
                    detectedLang = lang;
                }
            }
            
            return detectedLang;
        }
    };
    
    function createBars(visualizer) {
        // 清空現有內容
        visualizer.innerHTML = '';
        
        // 創建條形
        const barCount = 30; // 較少的條更好看
        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'bar';
            visualizer.appendChild(bar);
        }
    }
    
    // 更新可視化效果
    function updateVisualizer(dataArray) {
        const visualizer = document.querySelector('.voice-visualizer');
        if (!visualizer) return;
        
        const bars = visualizer.querySelectorAll('.bar');
        
        for (let i = 0; i < bars.length; i++) {
            const index = Math.floor(i * (dataArray.length / bars.length));
            const value = dataArray[index] / 128;
            const height = Math.max(5, value * 100);
            bars[i].style.height = `${height}px`;
        }
    }
    
    // 在文字翻譯頁面添加語音按鈕
    function addVoiceButtonToTextTab() {
        // 不再在文字翻譯頁面添加語音按鈕
        // 改為在語音區域添加更明確的說明
        
        const voiceContainer = document.querySelector('#voiceTab .voice-container');
        if (!voiceContainer) return;
        
        // 添加說明文字
        if (!document.querySelector('.voice-instructions')) {
            const instructions = document.createElement('div');
            instructions.className = 'voice-instructions';
            instructions.innerHTML = `
                <p>使用語音識別功能將您的語音轉換為文字。</p>
                <p>點擊"開始錄音"按鈕，說話後點擊"停止錄音"，然後可以使用識別的文字。</p>
                <p>支持多種語言，會自動使用當前選擇的源語言。</p>
            `;
            
            // 插入到voiceContainer的開頭
            voiceContainer.insertBefore(instructions, voiceContainer.firstChild);
        }
    }
    
    
    function openVoicePanel() {
        const panel = document.getElementById('voiceFloatingPanel');
        if (panel) {
            panel.classList.remove('hidden');
            // 添加動畫
            setTimeout(() => {
                panel.classList.add('expanded');
            }, 10);
        }
    }
    
    function closeVoicePanel() {
        const panel = document.getElementById('voiceFloatingPanel');
        if (panel) {
            // 停止任何進行中的識別
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
            }
            
            panel.classList.remove('expanded');
            // 等待動畫完成後隱藏
            setTimeout(() => {
                panel.classList.add('hidden');
                // 清空識別結果
                panel.querySelector('.voice-floating-transcript').textContent = '';
                panel.querySelector('.voice-floating-status').textContent = '準備就緒';
                panel.querySelector('.voice-floating-status').style.color = '';
            }, 300);
        }
    }
    
    function startVoiceRecognition(visualizer, status, transcript, startBtn, stopBtn, useBtn) {
        if (isRecording) return;
        
        isRecording = true;
        transcript.textContent = '';
        status.textContent = '正在聆聽...';
        status.style.color = '#33cc33';
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        useBtn.disabled = true;
        
        // 獲取當前選擇的語言
        const language = getCurrentLanguage();
        recognition.lang = language;
        
        try {
            recognition.start();
            console.log(`語音識別已啟動，語言: ${language}`);
            
            // 顯示通知
            const langNames = {
                'zh-TW': '繁體中文',
                'en-US': '英文',
                'ja-JP': '日文',
                'ko-KR': '韓文'
            };
            showNotification(`語音識別已啟動: ${langNames[language] || language}`, "info");
            
            // 初始化音頻可視化
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (!analyser) {
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
            }
            
            if (!dataArray) {
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            }
            
            // 獲取麥克風輸入
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    if (mediaStream) {
                        mediaStream.getTracks().forEach(track => track.stop());
                    }
                    
                    mediaStream = stream;
                    const source = audioContext.createMediaStreamSource(stream);
                    source.connect(analyser);
                    
                    // 創建可視化條
                    if (!visualizer.querySelector('.bar')) {
                        createBars(visualizer);
                    }
                    
                    // 更新可視化
                    function updateVisualizerLoop() {
                        if (!isRecording) return;
                        
                        analyser.getByteFrequencyData(dataArray);
                        updateVisualizer(dataArray);
                        requestAnimationFrame(updateVisualizerLoop);
                    }
                    
                    updateVisualizerLoop();
                })
                .catch(err => {
                    console.error('獲取麥克風失敗:', err);
                    status.textContent = '無法訪問麥克風';
                    status.style.color = '#cc3333';
                    isRecording = false;
                    startBtn.disabled = false;
                    stopBtn.disabled = true;
                });
        } catch (err) {
            console.error('啟動語音識別失敗:', err);
            status.textContent = '啟動語音識別失敗';
            status.style.color = '#cc3333';
            isRecording = false;
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }
    
    function stopVoiceRecognition(status, startBtn, stopBtn, useBtn) {
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
            
            status.textContent = "錄音已停止";
            status.style.color = "";
            
            startBtn.disabled = false;
            stopBtn.disabled = true;
            // 只有有識別文字才啟用使用按鈕
            const floatingTranscript = document.querySelector('.voice-floating-transcript');
            useBtn.disabled = floatingTranscript.textContent.trim() === '';
            
            bars.forEach(bar => bar.style.height = '5px');
        }
    }
    
    function useRecognizedText(text) {
        if (text.trim()) {
            dom.inputText.value = text;
            validateTranslationInput();
            dom.translateButton.focus();
            showNotification("已添加語音識別文字", "success");
        }
    }
    
    // 語音識別結果處理
    recognition.onresult = function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            // 檢測語言
            if (i === 0 && !detectedLanguage) {
                detectedLanguage = languageDetector.detect(transcript);
                
                // 更新目標語言
                if (detectedLanguage.startsWith('zh')) {
                    // 如果檢測到中文，設置目標語言為英文
                    dom.sourceLang.value = 'zh';
                    dom.targetLang.value = 'en';
                } else if (detectedLanguage.startsWith('en')) {
                    // 如果檢測到英文，設置目標語言為中文
                    dom.sourceLang.value = 'en';
                    dom.targetLang.value = 'zh';
                } else if (detectedLanguage.startsWith('ja')) {
                    // 如果檢測到日文，設置目標語言為中文
                    dom.sourceLang.value = 'ja';
                    dom.targetLang.value = 'zh';
                } else if (detectedLanguage.startsWith('ko')) {
                    // 如果檢測到韓文，設置目標語言為中文
                    dom.sourceLang.value = 'ko';
                    dom.targetLang.value = 'zh';
                }
                
                // 顯示檢測到的語言
                const statusElement = isRecording ? 
                    document.querySelector('.voice-floating-status') : 
                    voiceStatus;
                
                if (statusElement) {
                    const languageName = {
                        'zh-TW': '繁體中文',
                        'en-US': '英文',
                        'ja-JP': '日文',
                        'ko-KR': '韓文'
                    }[detectedLanguage] || detectedLanguage;
                    
                    statusElement.textContent = `檢測到語言: ${languageName}`;
                    statusElement.style.color = "#4CAF50";
                }
            }
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // 更新界面顯示
        const transcriptElement = isRecording ? 
            document.querySelector('.voice-floating-transcript') : 
            voiceTranscript;
        
        if (transcriptElement) {
            transcriptElement.innerHTML = 
                finalTranscript + 
                '<span class="interim">' + interimTranscript + '</span>';
            
            // 啟用使用按鈕
            if (finalTranscript.trim() !== '') {
                const useButton = isRecording ? 
                    document.querySelector('.voice-floating-use') : 
                    useVoiceTextBtn;
                
                if (useButton) {
                    useButton.disabled = false;
                }
            }
        }
    };
    
    recognition.onerror = function(event) {
        const statusElement = isRecording ? 
            document.querySelector('.voice-floating-status') : 
            voiceStatus;
        
        if (statusElement) {
            statusElement.textContent = "錯誤: " + event.error;
            statusElement.style.color = "#cc3333";
        }
        
        console.error("語音識別錯誤:", event.error);
    };
    
    recognition.onend = function() {
        if (isRecording) {
            // 如果用戶沒有手動停止，但瀏覽器結束了識別，嘗試重啟
            recognition.start();
        }
    };
    
    // 設置主界面按鈕事件
    startVoiceBtn.addEventListener('click', () => {
        if (!isRecording) {
            detectedLanguage = '';
            
            startVoiceRecognition(
                voiceVisualizer,
                voiceStatus,
                voiceTranscript,
                startVoiceBtn,
                stopVoiceBtn,
                useVoiceTextBtn
            );
        }
    });
    
    stopVoiceBtn.addEventListener('click', () => {
        stopVoiceRecognition(
            voiceStatus,
            startVoiceBtn,
            stopVoiceBtn,
            useVoiceTextBtn
        );
    });
    
    useVoiceTextBtn.addEventListener('click', () => {
        useRecognizedText(voiceTranscript.textContent);
    });
    
    clearVoiceBtn.addEventListener('click', () => {
        voiceTranscript.textContent = '';
        useVoiceTextBtn.disabled = true;
    });
    
    expandVoiceBtn.addEventListener('click', () => {
        voiceContainer.style.height = (parseInt(getComputedStyle(voiceContainer).height) + 20) + 'px';
    });
    
    shrinkVoiceBtn.addEventListener('click', () => {
        const currentHeight = parseInt(getComputedStyle(voiceContainer).height);
        if (currentHeight > 50) {
            voiceContainer.style.height = (currentHeight - 20) + 'px';
        }
    });
    
    // 初始化時，在文字翻譯頁面添加語音按鈕
    addVoiceButtonToTextTab();
    
    return {
        addVoiceButtonToTextTab
    };
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
        // 如果使用 Hugging Face 空間
        const baseUrl = "https://qwerty10218-gary-translate.hf.space";
        iframe.src = `${baseUrl}?__theme=${isDarkMode ? 'dark' : 'light'}`;
    }
    
    // 更新所有可能的嵌入 iframe
    const allIframes = document.querySelectorAll('iframe[data-theme-dependent]');
    allIframes.forEach(frame => {
        const currentSrc = new URL(frame.src);
        const params = new URLSearchParams(currentSrc.search);
        params.set('theme', isDarkMode ? 'dark' : 'light');
        currentSrc.search = params.toString();
        frame.src = currentSrc.toString();
    });
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

function addToHistory(sourceText, translatedText, sourceLang, targetLang, isR18 = false) {
    // 創建歷史記錄條目
    const entry = {
        timestamp: new Date().toISOString(),
        sourceText: sourceText,
        targetText: translatedText,
        sourceLang: sourceLang,
        targetLang: targetLang,
        isSpecial: isR18
    };
    
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
    try {
        // 檢查必要的DOM元素是否存在
        if (!dom) {
            console.error("DOM物件未初始化，無法初始化R18翻譯功能");
            return;
        }

        // 安全地獲取R18相關元素
        const r18InputText = document.getElementById("r18InputText");
        const r18Result = document.getElementById("r18Result");
        const r18TranslateButton = document.getElementById("r18TranslateButton");
        const r18ClearButton = document.getElementById("r18ClearButton");
        const r18CopyButton = document.getElementById("r18CopyButton");
        const r18ClearResultButton = document.getElementById("r18ClearResultButton");
        const r18SourceLang = document.getElementById("r18SourceLang");
        const r18TargetLang = document.getElementById("r18TargetLang");
        const r18SwapLangButton = document.getElementById("r18SwapLang");
        const r18ModelSelect = document.getElementById("r18ModelSelect");
        
        // 存儲到dom對象中供其他函數使用
        dom.r18 = {
            inputText: r18InputText,
            result: r18Result,
            translateButton: r18TranslateButton,
            clearButton: r18ClearButton,
            copyButton: r18CopyButton,
            clearResultButton: r18ClearResultButton,
            sourceLang: r18SourceLang,
            targetLang: r18TargetLang,
            swapLangButton: r18SwapLangButton,
            modelSelect: r18ModelSelect
        };

        // 檢查關鍵元素存在性
        if (!r18TranslateButton) {
            console.warn("R18翻譯按鈕未找到，跳過R18翻譯初始化");
            return;
        }

        // 添加翻譯按鈕事件
        if (r18TranslateButton) {
            r18TranslateButton.addEventListener("click", () => handleTranslation(true));
        }

        // 添加複製按鈕事件
        if (r18CopyButton && r18Result) {
            r18CopyButton.addEventListener("click", () => {
                if (r18Result.textContent) {
                    copyToClipboard(r18Result.textContent);
                }
            });
        }

        // 添加清除按鈕事件
        if (r18ClearButton && r18InputText) {
            r18ClearButton.addEventListener("click", () => {
                r18InputText.value = "";
                if (r18Result) r18Result.textContent = "";
            });
        }

        // 添加清除結果按鈕事件
        if (r18ClearResultButton && r18Result) {
            r18ClearResultButton.addEventListener("click", () => {
                r18Result.textContent = "";
            });
        }

        // 添加語言切換按鈕事件
        if (r18SwapLangButton && r18SourceLang && r18TargetLang) {
            r18SwapLangButton.addEventListener("click", () => {
                [r18SourceLang.value, r18TargetLang.value] = 
                [r18TargetLang.value, r18SourceLang.value];
                validateTranslationInput(true);
            });
        }

        // 初始化R18模型選擇下拉選單
        if (r18ModelSelect) {
            // 清空原有選項
            r18ModelSelect.innerHTML = '';
            
            // 添加新選項
            const options = [
                { value: 'mymemory', text: 'MyMemory API (純翻譯，無審查)' },
                { value: 'libre', text: 'LibreTranslate (純翻譯，作為備用)' }
            ];
            
            options.forEach(option => {
                const optElement = document.createElement('option');
                optElement.value = option.value;
                optElement.textContent = option.text;
                r18ModelSelect.appendChild(optElement);
            });
        }

        console.log("R18翻譯功能初始化完成");
    } catch (error) {
        console.error("R18翻譯功能初始化失敗:", error);
    }
}

async function copyToClipboard(text) {
    // 確保文本不是undefined或null
    if (!text) {
        showNotification("沒有可複製的文本", "warning");
        return;
    }
    
    try {
        // 嘗試使用現代Clipboard API
        await navigator.clipboard.writeText(text);
        showNotification("已複製到剪貼板", "success");
    } catch (err) {
        // 如果Clipboard API失敗，使用傳統方法
        console.warn("Clipboard API失敗，使用備用方法", err);
        
        // 創建臨時textarea元素
        const textarea = document.createElement("textarea");
        textarea.value = text;
        
        // 設置樣式使其不可見
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        
        // 添加到DOM，選中並複製
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            const successful = document.execCommand("copy");
            if (successful) {
                showNotification("已複製到剪貼板", "success");
            } else {
                throw new Error("複製命令失敗");
            }
        } catch (err) {
            console.error("複製失敗:", err);
            showNotification("複製失敗: " + err.message, "error");
        } finally {
            // 清理DOM
            document.body.removeChild(textarea);
        }
    }
}

function initAPISettings() {
    try {
        // 已不需要API設置面板
        console.log("API設置初始化完成");
    } catch (error) {
        console.error("API設置初始化失敗:", error);
    }
}

// 添加 API 狀態檢查
async function checkAPIStatus() {
    // 檢查所有 API 狀態元素
    const statusElements = {
        gpt: document.getElementById("gptStatus"),
        mymemory: document.getElementById("mymemoryStatus"),
        libre: document.getElementById("libreStatus")
    };

    // 檢查 GPT API
    if (statusElements.gpt) {
        try {
            const response = await fetch(`${API_CONFIG.gpt.url}/v1/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_CONFIG.gpt.key}`
                },
                body: JSON.stringify({
                    model: API_CONFIG.gpt.model,
                    messages: [{role: "user", content: "test"}],
                    max_tokens: 5
                })
            });
            
            updateStatusElement(statusElements.gpt, response.ok);
        } catch (error) {
            console.error("GPT API 檢查錯誤:", error);
            updateStatusElement(statusElements.gpt, false);
        }
    }

    // 檢查 MyMemory API
    if (statusElements.mymemory) {
        try {
            const response = await fetch(`${API_CONFIG.mymemory.url}/translate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    q: "test",
                    langpair: "en|zh"
                })
            });
            
            updateStatusElement(statusElements.mymemory, response.ok);
        } catch (error) {
            console.error("MyMemory API 檢查錯誤:", error);
            updateStatusElement(statusElements.mymemory, false);
        }
    }

    // 檢查 LibreTranslate API
    if (statusElements.libre) {
        try {
            const response = await fetch(`${API_CONFIG.libre.url}/translate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    q: "test",
                    source: "en",
                    target: "zh"
                })
            });
            
            updateStatusElement(statusElements.libre, response.ok);
        } catch (error) {
            console.error("LibreTranslate API 檢查錯誤:", error);
            updateStatusElement(statusElements.libre, false);
        }
    }
}

function updateStatusElement(element, isConnected) {
    if (!element) return;
    
    const statusText = element.parentElement.querySelector(".api-status-text");
    if (isConnected) {
        element.classList.add("connected");
        if (statusText) statusText.textContent = "已連接";
    } else {
        element.classList.remove("connected");
        if (statusText) statusText.textContent = "未連接";
    }
}

// 修改設置初始化函數
function initSettings() {
    try {
        const clearLocalStorageBtn = document.getElementById("clearLocalStorage");
        const autoSaveHistory = document.getElementById("autoSaveHistory");
        const showNotifications = document.getElementById("showNotifications");
        
        // 保存到dom對象
        dom.settings = {
            clearLocalStorageBtn,
            autoSaveHistory,
            showNotifications
        };
        
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
        
        // 設置選項加載保存的設置
        if (autoSaveHistory) {
            const savedValue = localStorage.getItem("autoSaveHistory");
            autoSaveHistory.checked = savedValue === null ? true : (savedValue === "true");
            
            autoSaveHistory.addEventListener("change", () => {
                localStorage.setItem("autoSaveHistory", autoSaveHistory.checked);
            });
        }
        
        if (showNotifications) {
            const savedValue = localStorage.getItem("showNotifications");
            showNotifications.checked = savedValue === null ? true : (savedValue === "true");
            
            showNotifications.addEventListener("change", () => {
                localStorage.setItem("showNotifications", showNotifications.checked);
            });
        }
        
        // 檢查 API 狀態
        checkAPIStatus();
        console.log("設置功能初始化完成");
    } catch (error) {
        console.error("設置功能初始化失敗:", error);
    }
}

// 修復主題初始化
function initTheme() {
    try {
        const themeToggle = document.getElementById("themeToggle");
        const themeTransitionOverlay = document.getElementById("themeTransitionOverlay");
        
        if (!themeToggle) {
            console.warn("主題切換按鈕未找到，跳過主題初始化");
            return;
        }
        
        // 加載保存的主題設置
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark") {
            document.body.classList.add("dark-theme");
        }
        
        // 添加主題切換事件監聽
        themeToggle.addEventListener("click", () => {
            if (themeTransitionOverlay) {
                themeTransitionOverlay.classList.add("active");
                
                if (document.body.classList.contains("dark-theme")) {
                    themeTransitionOverlay.classList.add("dark-to-light");
                } else {
                    themeTransitionOverlay.classList.add("light-to-dark");
                }
            }
            
            // 延遲切換主題，使過渡動畫可見
            setTimeout(() => {
                document.body.classList.toggle("dark-theme");
                
                // 保存主題設置
                if (document.body.classList.contains("dark-theme")) {
                    localStorage.setItem("theme", "dark");
                } else {
                    localStorage.setItem("theme", "light");
                }
                
                // 更新 iframe 主題
                updateIframeTheme();
                
                if (themeTransitionOverlay) {
                    // 移除過渡動畫
                    setTimeout(() => {
                        themeTransitionOverlay.classList.remove("active", "light-to-dark", "dark-to-light");
                    }, 600);
                }
            }, 300);
        });
        
        console.log("主題功能初始化完成");
    } catch (error) {
        console.error("主題功能初始化失敗:", error);
    }
}

// 安全的通知顯示函數
function showNotification(message, type = "info", duration = 3000) {
    try {
        // 檢查是否啟用通知
        const showNotificationsEnabled = localStorage.getItem("showNotifications");
        if (showNotificationsEnabled === "false") return;
        
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        
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
        
        document.body.appendChild(notification);
        
        // 添加動畫效果
        setTimeout(() => {
            notification.classList.add("show");
        }, 10);
        
        // 自動關閉
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.classList.remove("show");
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
    } catch (error) {
        console.error("顯示通知失敗:", error);
    }
}

// 修正 DOM 初始化函數
function initDOM() {
    try {
        console.log("初始化DOM元素...");
        
        // 建立安全的元素選取函數
        const getSafeElement = (id) => {
            const el = document.getElementById(id);
            if (!el) console.warn(`元素 #${id} 未找到`);
            return el;
        };

        // 初始化全局 DOM 物件
        dom = {
            translation: {
                inputText: getSafeElement("inputText"),
                result: getSafeElement("result"),
                sourceLang: getSafeElement("sourceLang"),
                targetLang: getSafeElement("targetLang"),
                translateButton: getSafeElement("translateButton"),
                clearTextButton: getSafeElement("clearTextButton"),
                swapLangButton: getSafeElement("swapLang"),
                copyResultButton: getSafeElement("copyResultButton"),
                clearResultButton: getSafeElement("clearResultButton")
            },
            progress: {
                container: getSafeElement("progressContainer"),
                bar: getSafeElement("progressBar")
            },
            image: {
                dropArea: getSafeElement("imageDropArea"),
                input: getSafeElement("imageInput"),
                canvas: getSafeElement("imageCanvas"),
                extractTextButton: getSafeElement("extractTextButton"),
                extractedText: getSafeElement("extractedText"),
                translateExtractedButton: getSafeElement("translateExtractedButton"),
                uploadImageButton: getSafeElement("uploadImageButton"),
                enhanceContrastButton: getSafeElement("enhanceContrastButton"),
                grayscaleButton: getSafeElement("grayscaleButton"),
                resetImageButton: getSafeElement("resetImageButton"),
                clearImageButton: getSafeElement("clearImageButton"),
                ocrLanguageSelect: getSafeElement("ocrLanguageSelect")
            }
        };

        // 檢查關鍵DOM元素
        const checkKeysElements = () => {
            if (!dom.translation.inputText || !dom.translation.result || !dom.translation.translateButton) {
                console.error("翻譯所需的關鍵DOM元素缺失");
                return false;
            }
            return true;
        };

        // 驗證DOM初始化結果
        const isValid = checkKeysElements();
        console.log("DOM元素初始化" + (isValid ? "成功" : "存在問題"));
        return isValid;
        
    } catch (error) {
        console.error("DOM初始化失敗:", error);
        return false;
    }
}

// 2. 添加缺失的圖片處理函數
function enhanceImageContrast() {
    try {
        if (!dom?.image?.canvas) {
            console.error("圖片畫布元素未初始化");
            return;
        }
        
        const canvas = dom.image.canvas;
        if (!canvas.width) {
            console.warn("沒有已載入的圖片");
            return;
        }
        
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 簡單對比度增強
        const contrast = 1.5; // 對比度因子
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = ((data[i] / 255 - 0.5) * contrast + 0.5) * 255;     // 紅
            data[i+1] = ((data[i+1] / 255 - 0.5) * contrast + 0.5) * 255; // 綠
            data[i+2] = ((data[i+2] / 255 - 0.5) * contrast + 0.5) * 255; // 藍
        }
        
        ctx.putImageData(imageData, 0, 0);
        showNotification("已增強圖片對比度", "success");
    } catch (error) {
        console.error("增強對比度失敗:", error);
        showNotification("增強對比度失敗", "error");
    }
}

function convertImageToGrayscale() {
    try {
        if (!dom?.image?.canvas) {
            console.error("圖片畫布元素未初始化");
            return;
        }
        
        const canvas = dom.image.canvas;
        if (!canvas.width) {
            console.warn("沒有已載入的圖片");
            return;
        }
        
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i+1] + data[i+2]) / 3;
            data[i] = avg;     // 紅
            data[i+1] = avg;   // 綠
            data[i+2] = avg;   // 藍
        }
        
        ctx.putImageData(imageData, 0, 0);
        showNotification("已轉換為灰階", "success");
    } catch (error) {
        console.error("轉換灰階失敗:", error);
        showNotification("轉換灰階失敗", "error");
    }
}

function resetImage() {
    try {
        if (!dom?.image?.canvas) {
            console.error("圖片畫布元素未初始化");
            return;
        }
        
        const canvas = dom.image.canvas;
        if (!canvas.width || !canvas.originalImage) {
            console.warn("沒有可重置的圖片");
            return;
        }
        
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas.originalImage, 0, 0, canvas.width, canvas.height);
        showNotification("已重置圖片", "success");
    } catch (error) {
        console.error("重置圖片失敗:", error);
        showNotification("重置圖片失敗", "error");
    }
}

// 更新進度條函數
function updateProgressBar(progress) {
    try {
        // 安全獲取進度條元素
        const progressBar = dom?.progress?.bar || document.getElementById("progressBar");
        const progressContainer = dom?.progress?.container || document.getElementById("progressContainer");
        
        if (!progressBar || !progressContainer) {
            console.warn("進度條元素未找到");
            return;
        }
        
        // 確保進度值在 0-100 範圍內
        const safeProgress = Math.min(100, Math.max(0, progress));
        
        // 更新進度條寬度
        progressBar.style.width = `${safeProgress}%`;
        
        // 顯示進度條
        progressContainer.style.display = "block";
        
        // 進度完成後自動隱藏
        if (safeProgress >= 100) {
            setTimeout(() => {
                progressContainer.style.display = "none";
                progressBar.style.width = "0%";
            }, 500);
        } else if (safeProgress <= 0) {
            // 進度為0時也隱藏
            setTimeout(() => {
                progressContainer.style.display = "none";
            }, 500);
        }
    } catch (error) {
        console.error("更新進度條失敗:", error);
    }
}
