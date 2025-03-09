document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        GPT_URL: "https://free.v36.cm/v1/chat/completions",
        GPT_KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827",
        HUGGINGFACE_URL: "https://qwerty10218-gary-translate.hf.space/api/translate",
        GRADIO_URL: "https://qwerty10218-gary-translate.hf.space/gradio_api/predict",
        TIMEOUT: 60000 // 60秒超時
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
        swapLang: document.getElementById("swapLang"),
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
        clearAllButton: document.getElementById("clearAllButton"),
        clearImageButton: document.getElementById("clearImageButton"),
        themeToggle: document.getElementById("themeToggle"),
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
        initTabs();
        initTextTranslation();
        initImageTranslation();
        initDragAndDrop();
        initButtons();
        initTheme();
        // 初始檢查翻譯按鈕狀態
        validateTranslationInput();
        // 設置文本區域高度
        dom.inputText.style.height = "150px";
        // 默認禁用圖片相關按鈕
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        initVoiceRecognition();
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
                    .then(() => alert("已複製到剪貼簿"))
                    .catch(err => alert("複製失敗: " + err));
            }
        });
        
        // 清除結果按鈕
        dom.clearResultButton.addEventListener("click", () => {
            dom.result.textContent = "";
        });
        
        // 清除全部按鈕
        dom.clearAllButton.addEventListener("click", () => {
            dom.inputText.value = "";
            dom.result.textContent = "";
            validateTranslationInput();
        });
        
        // 清除圖片按鈕
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

    function initTextTranslation() {
        // 修正: 不直接傳遞事件對象，而是使用箭頭函數
        let lastTranslationTime = 0;
        dom.translateBtn.addEventListener("click", async () => {
            const now = Date.now();
            // 強制等待至少 3 秒才能發起下一次請求
            if (now - lastTranslationTime < 3000) {
                alert("請稍等片刻再進行下一次翻譯請求");
                return;
            }
            lastTranslationTime = now;
            await handleTranslation();
        });
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", validateTranslationInput);
        
        // 語言選擇改變時檢查翻譯按鈕狀態
        dom.sourceLang.addEventListener("change", validateTranslationInput);
        dom.targetLang.addEventListener("change", validateTranslationInput);
    }

    function swapLanguages() {
        [dom.sourceLang.value, dom.targetLang.value] = [dom.targetLang.value, dom.sourceLang.value];
        validateTranslationInput();
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

    async function handleTranslation(extractedText = null) {
        // 修正: 確保 extractedText 是字符串而不是事件對象
        if (extractedText && typeof extractedText === 'object' && extractedText.type === 'click') {
            extractedText = null; // 如果是事件對象，設為 null，使用輸入框中的文本
        }
        
        const text = extractedText || dom.inputText.value.trim();
        if (!text) {
            alert("請輸入要翻譯的內容");
            return;
        }
        
        // 再次檢查源語言和目標語言是否相同
        if (dom.sourceLang.value === dom.targetLang.value) {
            alert("源語言和目標語言不能相同");
            return;
        }

        dom.result.textContent = "翻譯中...";
        dom.progressBar.style.width = "0%";
        dom.progressBar.parentElement.style.display = "block";

        // 開始進度條動畫
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            dom.progressBar.style.width = `${progress}%`;
        }, 300);

        try {
            const selectedModel = dom.modelSelect.value;
            let response;
            
            // 根據選擇的模型使用不同的API
            if (selectedModel.startsWith('gpt')) {
                // 使用OpenAI API
                response = await fetch(API_CONFIG.GPT_URL, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${API_CONFIG.GPT_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [{
                            role: "user",
                            content: `請專業地將以下 ${dom.sourceLang.value} 文本翻譯成 ${dom.targetLang.value}：\n\n${text}`
                        }],
                        timeout: API_CONFIG.TIMEOUT
                    }),
                    signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
                });
                
                if (!response.ok) {
                    throw new Error(`GPT API錯誤! 狀態: ${response.status}`);
                }
                
                const data = await response.json();
                dom.result.textContent = data.choices?.[0]?.message?.content || "翻譯失敗";
            } 
            else if (selectedModel === 'helsinki-quick' || selectedModel === 'qwen-advanced') {
                // 添加重試機制
                let retryCount = 0;
                const maxRetries = 3;
                let lastError = null;
                let success = false;
                
                while (retryCount < maxRetries && !success) {
                    try {
                        // 使用Hugging Face Space API
                        const sourceLang = convertToAPILanguageCode(dom.sourceLang.value);
                        const targetLang = convertToAPILanguageCode(dom.targetLang.value);
                        
                        // 先嘗試REST API
                        try {
                            console.log(`嘗試REST API（第${retryCount + 1}次）...`);
                            
                            // 更新狀態
                            dom.result.textContent = retryCount > 0 ? 
                                `翻譯中...正在重試 (${retryCount + 1}/${maxRetries})` : 
                                "翻譯中...";
                                
                            response = await fetch(API_CONFIG.HUGGINGFACE_URL, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    text: text,
                                    source_lang: sourceLang,
                                    target_lang: targetLang,
                                    model: selectedModel === 'helsinki-quick' ? 'helsinki' : 'qwen'
                                }),
                                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
                            });
                            
                            if (response.ok) {
                                const data = await response.json();
                                dom.result.textContent = data.translation || "翻譯失敗";
                                success = true;
                                break;
                            } else if (response.status === 503) {
                                console.log("REST API 返回503，服務暫時不可用，等待重試...");
                                throw new Error(`Hugging Face API暫時不可用 (503)`);
                            } else {
                                throw new Error(`REST API錯誤: ${response.status}`);
                            }
                        } catch (restError) {
                            console.log("REST API失敗，嘗試Gradio API...");
                            
                            // 如果REST API失敗，嘗試Gradio API
                            response = await fetch(API_CONFIG.GRADIO_URL, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    data: [
                                        text,
                                        sourceLang, 
                                        targetLang,
                                        selectedModel === 'helsinki-quick' ? 'helsinki' : 'qwen'
                                    ]
                                }),
                                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
                            });
                            
                            if (response.ok) {
                                const gradioData = await response.json();
                                dom.result.textContent = gradioData.data || "翻譯失敗";
                                success = true;
                                break;
                            } else if (response.status === 503) {
                                console.log("Gradio API 返回503，服務暫時不可用，等待重試...");
                                throw new Error(`Hugging Face Gradio API暫時不可用 (503)`);
                            } else {
                                throw new Error(`Gradio API錯誤: ${response.status}`);
                            }
                        }
                    } catch (error) {
                        lastError = error;
                        retryCount++;
                        
                        if (retryCount < maxRetries) {
                            const waitTime = 2000 * retryCount; // 漸增等待時間
                            console.log(`等待${waitTime/1000}秒後進行第${retryCount + 1}次重試...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                }
                
                // 如果所有重試都失敗
                if (!success) {
                    throw lastError || new Error("所有API請求都失敗");
                }
            }
        } catch (error) {
            clearInterval(progressInterval);
            console.error("翻譯錯誤:", error);
            
            // 更友好的錯誤訊息
            if (error.message.includes('503')) {
                dom.result.textContent = `Hugging Face服務暫時繁忙，請稍後再試或使用GPT模型`;
            } else if (error.message.includes('timeout')) {
                dom.result.textContent = `請求超時，可能是網絡問題或服務器負載過高`;
            } else {
                dom.result.textContent = `請求失敗：${error.message}`;
            }
            
            // 如果是使用Hugging Face模型失敗，建議用戶嘗試GPT模型
            if (dom.modelSelect.value.includes('helsinki') || dom.modelSelect.value.includes('qwen')) {
                setTimeout(() => {
                    if (confirm("Hugging Face模型翻譯失敗，是否嘗試使用GPT模型？")) {
                        dom.modelSelect.value = "gpt-3.5-turbo";
                        handleTranslation(text);
                    }
                }, 1000);
            }
        } finally {
            clearInterval(progressInterval);
            dom.progressBar.style.width = "100%";
            
            setTimeout(() => {
                dom.progressBar.parentElement.style.display = "none";
            }, 1000);
        }
    }

    function initImageTranslation() {
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        // 修正: 使用箭頭函數避免傳遞事件對象
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
                
                // 調整畫布尺寸，保持比例但不超過容器
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
                
                // 儲存原始圖像數據
                canvas.originalImage = img;
                canvas.originalWidth = width;
                canvas.originalHeight = height;
                
                // 初始化選擇區域
                initSelectionArea(canvas);
                
                dom.extractTextBtn.disabled = false;
            };
            img.onerror = () => alert("圖片載入失敗，請使用其他圖片。");
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // 初始化圖像選擇區域功能
    function initSelectionArea(canvas) {
        const ctx = canvas.getContext("2d");
        let isSelecting = false;
        let selectionStart = { x: 0, y: 0 };
        let selectionEnd = { x: 0, y: 0 };
        let currentSelection = null;
        
        // 清除之前的事件監聽器（如果有）
        canvas.removeEventListener("mousedown", canvas.mousedownHandler);
        canvas.removeEventListener("mousemove", canvas.mousemoveHandler);
        canvas.removeEventListener("mouseup", canvas.mouseupHandler);
        
        // 滑鼠按下事件
        canvas.mousedownHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            selectionStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            selectionEnd = { ...selectionStart };
            isSelecting = true;
            
            // 清除先前的選擇區域
            if (currentSelection) {
                redrawImage();
                currentSelection = null;
            }
        };
        
        // 滑鼠移動事件
        canvas.mousemoveHandler = (e) => {
            if (!isSelecting) return;
            
            const rect = canvas.getBoundingClientRect();
            selectionEnd = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            // 重新繪製圖像和選擇框
            redrawImage();
            drawSelectionBox();
        };
        
        // 滑鼠放開事件
        canvas.mouseupHandler = () => {
            if (isSelecting) {
                isSelecting = false;
                
                // 確保選擇區域有效（不是點擊）
                if (Math.abs(selectionStart.x - selectionEnd.x) > 10 && 
                    Math.abs(selectionStart.y - selectionEnd.y) > 10) {
                    
                    // 保存當前的選擇區域
                    currentSelection = {
                        x: Math.min(selectionStart.x, selectionEnd.x),
                        y: Math.min(selectionStart.y, selectionEnd.y),
                        width: Math.abs(selectionEnd.x - selectionStart.x),
                        height: Math.abs(selectionEnd.y - selectionStart.y)
                    };
                    
                    // 顯示提示信息
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
                    
                    // 移除之前的提示信息
                    const prevInfo = document.querySelector(".selection-info");
                    if (prevInfo) prevInfo.remove();
                    
                    dom.imageTab.appendChild(selectionInfo);
                    setTimeout(() => selectionInfo.remove(), 3000);
                } else {
                    // 如果只是點擊，重置選擇
                    currentSelection = null;
                    redrawImage();
                }
            }
        };
        
        // 重新繪製原始圖像
        function redrawImage() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvas.originalImage, 0, 0, canvas.width, canvas.height);
        }
        
        // 繪製選擇框
        function drawSelectionBox() {
            const x = Math.min(selectionStart.x, selectionEnd.x);
            const y = Math.min(selectionStart.y, selectionEnd.y);
            const width = Math.abs(selectionEnd.x - selectionStart.x);
            const height = Math.abs(selectionEnd.y - selectionStart.y);
            
            // 繪製半透明覆蓋層
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 清除選擇區域（使其透明）
            ctx.clearRect(x, y, width, height);
            
            // 繪製選擇框邊界
            ctx.strokeStyle = "#2196F3";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
        }
        
        // 添加事件監聽器
        canvas.addEventListener("mousedown", canvas.mousedownHandler);
        canvas.addEventListener("mousemove", canvas.mousemoveHandler);
        canvas.addEventListener("mouseup", canvas.mouseupHandler);
        
        // 把當前選擇保存到 canvas 對象上
        canvas.getCurrentSelection = () => currentSelection;
    }

    async function extractTextFromImage() {
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        
        // 檢查是否有圖片
        if (!dom.imageCanvas.width) {
            alert("請先上傳圖片");
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

            // 獲取選擇區域（如果有）
            const selection = dom.imageCanvas.getCurrentSelection();
            let imageData;
            
            if (selection) {
                // 創建臨時 canvas 來獲取選定區域的圖像數據
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = selection.width;
                tempCanvas.height = selection.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // 從原圖中複製選定區域
                tempCtx.drawImage(
                    dom.imageCanvas, 
                    selection.x, selection.y, selection.width, selection.height,
                    0, 0, selection.width, selection.height
                );
                
                imageData = tempCanvas;
            } else {
                // 使用整個圖像
                imageData = dom.imageCanvas;
            }

            // 獲取選擇的OCR語言
            const ocrLang = dom.ocrLanguageSelect ? dom.ocrLanguageSelect.value : 'chi_tra+eng';
            
            // 設置 Tesseract 進度回調
            const { createWorker } = Tesseract;
            const worker = await createWorker({
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        progressBar.style.width = `${progress.progress * 100}%`;
                    }
                },
                langPath: 'https://tessdata.projectnaptha.com/4.0.0'  // 使用最新的語言數據
            });

            // 載入選擇的語言
            await worker.loadLanguage(ocrLang);
            await worker.initialize(ocrLang);
            
            // 設置更精確的 OCR 參數
            await worker.setParameters({
                preserve_interword_spaces: '1',
                tessedit_pageseg_mode: '6',  // 假設為整齊的文本塊
                tessedit_char_whitelist: ''  // 允許所有字符
            });
            
            const { data } = await worker.recognize(imageData);
            await worker.terminate();

            // 移除進度條
            progressContainer.remove();

            let recognizedText = data.text.trim();
            if (!recognizedText) {
                dom.extractedText.textContent = "未能識別出文字，請嘗試調整選擇區域或上傳清晰的圖片";
            } else {
                // 後處理以提高準確性
                recognizedText = recognizedText
                    .replace(/(\r\n|\n|\r){2,}/gm, '\n\n')  // 合併多餘的換行
                    .replace(/[^\S\r\n]+/g, ' ')  // 合併多餘的空格
                    .trim();
                
                dom.extractedText.textContent = recognizedText;
                dom.translateExtractedBtn.disabled = false;
                
                // 添加編輯按鈕
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
                
                // 添加直接翻譯按鈕的功能提示
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
                
                // 檢測到的語言提示
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
                
                // 聚焦「翻譯擷取文字」按鈕
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

        // 圖片翻譯也需要檢查源語言和目標語言是否相同
        if (dom.sourceLang.value === dom.targetLang.value) {
            alert("源語言和目標語言不能相同");
            return;
        }

        // 修正: 確保我們傳遞的是文本而不是事件
        await handleTranslation(extractedText);
    }

    // 清除圖片相關數據
    function clearImageData() {
        // 清除圖片
        const canvas = dom.imageCanvas;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.display = "none";
        
        // 清除擷取文字
        if (dom.extractedText) {
            dom.extractedText.textContent = "";
        }
        
        // 重置按鈕狀態
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        
        // 清除 input 值
        dom.imageInput.value = "";
    }

    // 初始化主題設置
    function initTheme() {
        // 檢查本地存儲中是否有主題偏好
        const savedTheme = localStorage.getItem('theme');
        
        // 如果有已保存的主題偏好
        if (savedTheme) {
            document.documentElement.className = savedTheme;
        } else {
            // 否則檢查系統偏好
            const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
            if (prefersDarkScheme.matches) {
                document.documentElement.classList.add('dark-theme');
            }
        }
        
        // 監聽主題切換按鈕點擊
        dom.themeToggle.addEventListener('click', () => {
            if (document.documentElement.classList.contains('dark-theme')) {
                document.documentElement.classList.remove('dark-theme');
                document.documentElement.classList.add('light-theme');
                localStorage.setItem('theme', 'light-theme');
                dom.themeToggle.textContent = '🌓'; // 月亮圖標表示可以切換到深色模式
            } else {
                document.documentElement.classList.remove('light-theme');
                document.documentElement.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark-theme');
                dom.themeToggle.textContent = '☀️'; // 太陽圖標表示可以切換到淺色模式
            }
        });
        
        // 根據當前主題設置按鈕圖標
        if (document.documentElement.classList.contains('dark-theme')) {
            dom.themeToggle.textContent = '☀️';
        } else {
            dom.themeToggle.textContent = '🌓';
        }
        
        // 監聽系統主題變化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) { // 只有在用戶沒有手動設置主題時響應系統變化
                if (e.matches) {
                    document.documentElement.classList.add('dark-theme');
                    dom.themeToggle.textContent = '☀️';
                } else {
                    document.documentElement.classList.remove('dark-theme');
                    dom.themeToggle.textContent = '🌓';
                }
            }
        });
    }

    // 初始化語音識別功能
    function initVoiceRecognition() {
        // 獲取DOM元素
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
        
        // 如果瀏覽器不支持語音識別，顯示錯誤消息
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            voiceStatus.textContent = "您的瀏覽器不支持語音識別功能，請使用Chrome或Edge瀏覽器";
            voiceStatus.style.color = "#cc3333";
            startVoiceBtn.disabled = true;
            return;
        }
        
        // 創建語音識別對象
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        // 設置語音識別參數
        recognition.continuous = true;
        recognition.interimResults = true;
        
        // 創建音頻分析器
        let audioContext;
        let analyser;
        let microphone;
        let bars = [];
        let isRecording = false;
        let animationId;
        
        // 創建視覺化條形圖
        function createBars() {
            voiceVisualizer.innerHTML = '';
            const barCount = 50; // 調整條形數量
            
            for (let i = 0; i < barCount; i++) {
                const bar = document.createElement('div');
                bar.className = 'voice-bar';
                voiceVisualizer.appendChild(bar);
                bars.push(bar);
            }
        }
        
        // 更新視覺化
        function updateVisualizer(dataArray) {
            if (!isRecording) return;
            
            for (let i = 0; i < bars.length; i++) {
                const index = Math.floor(i * (dataArray.length / bars.length));
                const value = dataArray[index] / 128; // 緩衝區值為0-255
                const height = Math.max(5, value * 100); // 最小高度為5px，最大100px
                bars[i].style.height = `${height}px`;
            }
            
            animationId = requestAnimationFrame(() => updateVisualizer(dataArray));
        }
        
        // 開始錄音
        startVoiceBtn.addEventListener('click', () => {
            try {
                if (!isRecording) {
                    // 設置語言
                    recognition.lang = dom.sourceLang.value === '中文' ? 'zh-TW' : 'en-US';
                    
                    // 開始語音識別
                    recognition.start();
                    
                    isRecording = true;
                    voiceStatus.textContent = "正在錄音...";
                    document.querySelector('.voice-container').classList.add('recording');
                    
                    // 變更按鈕狀態
                    startVoiceBtn.disabled = true;
                    stopVoiceBtn.disabled = false;
                    useVoiceTextBtn.disabled = true;
                    
                    // 設置音頻處理
                    if (!audioContext) {
                        audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        analyser = audioContext.createAnalyser();
                        analyser.fftSize = 256;
                    }
                    
                    // 創建條形圖
                    createBars();
                    
                    // 獲取麥克風
                    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                        .then(stream => {
                            microphone = audioContext.createMediaStreamSource(stream);
                            microphone.connect(analyser);
                            
                            const bufferLength = analyser.frequencyBinCount;
                            const dataArray = new Uint8Array(bufferLength);
                            
                            // 更新視覺化
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
        
        // 停止錄音
        stopVoiceBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
                isRecording = false;
                
                // 斷開音頻連接
                if (microphone) {
                    microphone.disconnect();
                    microphone = null;
                }
                
                // 停止動畫
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                
                // 更新UI
                voiceStatus.textContent = "錄音已停止";
                document.querySelector('.voice-container').classList.remove('recording');
                
                // 重置條形圖
                bars.forEach(bar => bar.style.height = '5px');
                
                // 變更按鈕狀態
                startVoiceBtn.disabled = false;
                stopVoiceBtn.disabled = true;
                useVoiceTextBtn.disabled = voiceTranscript.textContent.trim() === '';
            }
        });
        
        // 使用識別文本
        useVoiceTextBtn.addEventListener('click', () => {
            const recognizedText = voiceTranscript.textContent.trim();
            if (recognizedText) {
                // 切換到文本翻譯標籤頁
                document.querySelector('.tab-button[data-tab="textTab"]').click();
                
                // 設置文本
                dom.inputText.value = recognizedText;
                
                // 觸發翻譯
                validateTranslationInput();
                
                // 聚焦翻譯按鈕
                dom.translateBtn.focus();
            }
        });
        
        // 清除按鈕
        clearVoiceBtn.addEventListener('click', () => {
            voiceTranscript.textContent = '';
            useVoiceTextBtn.disabled = true;
            
            // 重置條形圖
            bars.forEach(bar => bar.style.height = '5px');
        });
        
        // 擴大視覺化區域
        expandVoiceBtn.addEventListener('click', () => {
            const currentHeight = parseInt(window.getComputedStyle(voiceContainer).height);
            voiceContainer.style.height = `${currentHeight + 50}px`;
        });
        
        // 縮小視覺化區域
        shrinkVoiceBtn.addEventListener('click', () => {
            const currentHeight = parseInt(window.getComputedStyle(voiceContainer).height);
            if (currentHeight > 100) {
                voiceContainer.style.height = `${currentHeight - 50}px`;
            }
        });
        
        // 語音識別結果事件
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
            
            // 更新語音識別文本
            if (finalTranscript) {
                // 如果有最終結果，添加到先前結果後面
                const previousText = voiceTranscript.textContent;
                voiceTranscript.textContent = previousText + finalTranscript + ' ';
                useVoiceTextBtn.disabled = false;
            } else if (interimTranscript) {
                // 臨時結果顯示為斜體
                const previousText = voiceTranscript.textContent;
                voiceTranscript.innerHTML = previousText + '<i>' + interimTranscript + '</i>';
            }
        };
        
        // 語音識別錯誤事件
        recognition.onerror = (event) => {
            console.error("語音識別錯誤:", event.error);
            voiceStatus.textContent = `錯誤: ${event.error}`;
            voiceStatus.style.color = "#cc3333";
            
            // 重置錄音狀態
            isRecording = false;
            startVoiceBtn.disabled = false;
            stopVoiceBtn.disabled = true;
            document.querySelector('.voice-container').classList.remove('recording');
        };
        
        // 語音識別結束事件
        recognition.onend = () => {
            if (isRecording) {
                // 如果用戶沒有手動停止，自動重新開始
                recognition.start();
            }
        };
        
        // 創建初始條形圖
        createBars();
    }

    // 編輯提取的文本
    function editExtractedText() {
        const currentText = dom.extractedText.textContent;
        
        // 創建編輯界面
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
        
        // 隱藏編輯按鈕
        const editButton = document.getElementById('editExtractedButton');
        if (editButton) editButton.style.display = 'none';
        
        // 保存編輯
        saveButton.addEventListener('click', () => {
            const editedText = editArea.value.trim();
            dom.extractedText.textContent = editedText;
            if (editButton) editButton.style.display = 'inline-block';
            
            // 啟用翻譯按鈕（如果有文本）
            dom.translateExtractedBtn.disabled = !editedText;
        });
        
        // 取消編輯
        cancelButton.addEventListener('click', () => {
            dom.extractedText.textContent = currentText;
            if (editButton) editButton.style.display = 'inline-block';
        });
        
        // 聚焦到文本區域
        editArea.focus();
    }

    // 語言代碼轉換為語言名稱
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

    // 添加語言代碼轉換函數
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

    init();
});
