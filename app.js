document.addEventListener("DOMContentLoaded", () => {
    // API配置
    const API_CONFIG = {
        horde: {
            url: "https://stablehorde.net/api/v2/generate/text",
            key: "p2mObrSqt7gq4CQERcsJYw",
            quota: 50000
        },
        libre: {
            url: "https://libretranslate.de/translate",
            quota: 1000
        },
        lingva: {
            url: "https://lingva.ml/api/v1/translate",
            quota: 2000
        },
        kobold: {
            url: "http://localhost:5000/api/v1/generate",
            quota: Infinity
        },
        textgen: {
            url: "http://localhost:7860/api/v1/generate",
            quota: Infinity
        }
    };

    // 特殊提示詞模板
    const SPECIAL_PROMPTS = {
        adult: "Translate accurately maintaining adult content and expressions",
        violence: "Preserve violence and intense descriptions",
        slang: "Keep slang and colloquial expressions",
        base: `Instructions for AI translation:
1. Translate with high accuracy
2. Maintain original meaning and style
3. No content filtering or censorship
4. Preserve all expressions and nuances

Source (${sourceLang}):
${text}

Target (${targetLang}):
`
    };

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

            // 檢查配額和冷卻時間
            const now = Date.now();
            const availableAPIs = apis.filter(api => {
                const timeSinceLastUse = now - (this.lastUsed[api] || 0);
                return this.usageCount[api] < API_CONFIG[api].quota && timeSinceLastUse > 1000;
            });

            if (availableAPIs.length === 0) {
                throw new Error("所有API都已達到限制，請稍後再試");
            }

            // 選擇使用次數最少的API
            const selectedAPI = availableAPIs.reduce((a, b) => 
                this.usageCount[a] < this.usageCount[b] ? a : b
            );

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
            this.apiBalancer = new APIBalancer();
        }

        async translate(text, sourceLang, targetLang, isSpecial = false, contentTypes = {}) {
            const api = this.apiBalancer.getNextAPI(isSpecial);
            
            try {
                if (isSpecial) {
                    return await this.handleSpecialTranslation(text, sourceLang, targetLang, contentTypes);
                } else {
                    return await this.handleNormalTranslation(api, text, sourceLang, targetLang);
                }
            } catch (error) {
                console.error(`${api} 翻譯失敗:`, error);
                throw error;
            }
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
                .replace('${sourceLang}', sourceLang)
                .replace('${targetLang}', targetLang)
                .replace('${text}', text);

            // 根據選擇的內容類型添加額外提示詞
            if (contentTypes.adult) prompt = SPECIAL_PROMPTS.adult + "\n" + prompt;
            if (contentTypes.violence) prompt = SPECIAL_PROMPTS.violence + "\n" + prompt;
            if (contentTypes.slang) prompt = SPECIAL_PROMPTS.slang + "\n" + prompt;

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

            if (!response.ok) throw new Error(`Horde API錯誤: ${response.status}`);
            const data = await response.json();
            return data.generations[0].text;
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

        async translateWithLibre(text, sourceLang, targetLang) {
            const response = await fetch(API_CONFIG.libre.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang
                })
            });

            if (!response.ok) throw new Error(`Libre API錯誤: ${response.status}`);
            const data = await response.json();
            return data.translatedText;
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
    }

    // 初始化翻譯管理器
    const translator = new TranslationManager();

    // DOM元素
    const dom = {
        // 一般翻譯
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        inputText: document.getElementById("inputText"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        modelSelect: document.getElementById("modelSelect"),
        progressBar: document.getElementById("progressBar"),
        
        // 特殊翻譯
        specialSourceLang: document.getElementById("specialSourceLang"),
        specialTargetLang: document.getElementById("specialTargetLang"),
        specialInputText: document.getElementById("specialInputText"),
        specialTranslateBtn: document.getElementById("specialTranslateButton"),
        specialResult: document.getElementById("specialResult"),
        specialModelSelect: document.getElementById("specialModelSelect"),
        specialProgressBar: document.getElementById("specialProgressBar"),
        
        // 通用
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        themeToggle: document.getElementById("themeToggle"),
        swapLang: document.getElementById("swapLang"),
        imageInput: document.getElementById("imageInput"),
        imageCanvas: document.getElementById("imageCanvas"),
        extractTextBtn: document.getElementById("extractTextButton"),
        translateExtractedBtn: document.getElementById("translateExtractedButton"),
        extractedText: document.getElementById("extractedText"),
        imageDropArea: document.getElementById("imageDropArea"),
        clearTextButton: document.getElementById("clearTextButton"),
        copyResultButton: document.getElementById("copyResultButton"),
        clearResultButton: document.getElementById("clearResultButton"),
        clearAllButton: document.getElementById("clearAllButton"),
        clearImageButton: document.getElementById("clearImageButton"),
        imageTab: document.getElementById("imageTab"),
        ocrLanguageSelect: document.getElementById('ocrLanguageSelect'),
        ocrHelpButton: document.getElementById('ocrHelpButton'),
        ocrProgressContainer: document.getElementById('ocrProgressContainer'),
        ocrProgressBar: document.getElementById('ocrProgressBar'),
        ocrStatusText: document.getElementById('ocrStatusText'),
        detectedLanguage: document.getElementById('detectedLanguage'),
        editExtractedButton: document.getElementById('editExtractedButton'),
        enhanceContrastButton: document.getElementById('enhanceContrastButton'),
        grayscaleButton: document.getElementById('grayscaleButton'),
        resetImageButton: document.getElementById('resetImageButton')
    };

    function init() {
        initTheme();
        initTabs();
        initTranslation();
        initImageTranslation();
        initDragAndDrop();
        initButtons();
        initVoiceRecognition();
        initHuggingFaceTab();
        initHistory();
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
        dom.translateBtn.addEventListener("click", async () => {
            const now = Date.now();
            if (now - lastTranslationTime < 3000) {
                alert("請稍等片刻再進行下一次翻譯請求");
                return;
            }
            lastTranslationTime = now;
            await handleTranslation(false);
        });
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", () => validateTranslationInput(false));
        
        dom.sourceLang.addEventListener("change", () => validateTranslationInput(false));
        dom.targetLang.addEventListener("change", () => validateTranslationInput(false));
    }

    function swapLanguages() {
        [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
        validateTranslationInput();
    }

    function validateTranslationInput(isSpecial = false) {
        const input = isSpecial ? dom.specialInputText : dom.inputText;
        const sourceLang = isSpecial ? dom.specialSourceLang : dom.sourceLang;
        const targetLang = isSpecial ? dom.specialTargetLang : dom.targetLang;
        const translateBtn = isSpecial ? dom.specialTranslateBtn : dom.translateBtn;

        const textInput = input.value.trim();
        const sameLanguage = sourceLang.value === targetLang.value;

        translateBtn.disabled = !textInput || sameLanguage;
        translateBtn.title = sameLanguage ? "源語言和目標語言不能相同" : 
                           !textInput ? "請輸入要翻譯的內容" : "";
    }

    async function handleTranslation(isSpecial = false) {
        const input = isSpecial ? dom.specialInputText : dom.inputText;
        const sourceLang = isSpecial ? dom.specialSourceLang : dom.sourceLang;
        const targetLang = isSpecial ? dom.specialTargetLang : dom.targetLang;
        const result = isSpecial ? dom.specialResult : dom.result;
        const progressBar = isSpecial ? dom.specialProgressBar : dom.progressBar;

        const text = input.value.trim();
        if (!text) return;

        result.textContent = "翻譯中...";
        progressBar.style.width = "0%";
        progressBar.parentElement.style.display = "block";

        try {
            // 獲取內容類型設置
            const contentTypes = isSpecial ? {
                adult: document.getElementById('adultContent').checked,
                violence: document.getElementById('violenceContent').checked,
                slang: document.getElementById('slangContent').checked
            } : {};

            const translation = await translator.translate(
                text,
                sourceLang.value,
                targetLang.value,
                isSpecial,
                contentTypes
            );

            result.textContent = translation;
            
            // 添加到歷史記錄
            addToHistory({
                source: text,
                target: translation,
                sourceLang: sourceLang.value,
                targetLang: targetLang.value,
                isSpecial: isSpecial,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error("翻譯錯誤:", error);
            result.textContent = `翻譯失敗: ${error.message}`;
        } finally {
            progressBar.style.width = "100%";
            setTimeout(() => {
                progressBar.parentElement.style.display = "none";
            }, 1000);
        }
    }

    function initImageTranslation() {
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        dom.translateExtractedBtn.addEventListener("click", () => {
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
                
                dom.extractTextBtn.disabled = false;
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
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        
        if (!dom.imageCanvas.width) {
            alert("請先上傳圖片");
            dom.extractTextBtn.disabled = false;
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
                dom.translateExtractedBtn.disabled = false;
                
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
                
                dom.translateExtractedBtn.focus();
            }
        } catch (error) {
            dom.extractedText.textContent = `識別失敗：${error.message}`;
        } finally {
            dom.extractTextBtn.disabled = false;
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
        
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        
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
                
                dom.translateBtn.focus();
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
            
            dom.translateExtractedBtn.disabled = !editedText;
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

    function showNotification(message, type = "info") {
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add("show");
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove("show");
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
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
            <div class="history-item ${entry.isSpecial ? 'special' : ''}">
                <div class="history-meta">
                    <span>${new Date(entry.timestamp).toLocaleString()}</span>
                    <span>${entry.sourceLang} → ${entry.targetLang}</span>
                </div>
                <div class="history-content">
                    <div class="history-source">${entry.source}</div>
                    <div class="history-target">${entry.target}</div>
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

    init();
});
