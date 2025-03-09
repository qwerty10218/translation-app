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
        imageTab: document.getElementById("imageTab") // 添加缺少的 imageTab 元素引用
    };

    function init() {
        initTabs();
        initTextTranslation();
        initImageTranslation();
        initDragAndDrop();
        initButtons();
        // 初始檢查翻譯按鈕狀態
        validateTranslationInput();
        // 設置文本區域高度
        dom.inputText.style.height = "150px";
        // 默認禁用圖片相關按鈕
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
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
        dom.translateBtn.addEventListener("click", () => handleTranslation());
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
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: dom.modelSelect.value,
                    messages: [{
                        role: "user",
                        content: `請專業地將以下 ${dom.sourceLang.value} 文本翻譯成 ${dom.targetLang.value}：\n\n${text}`
                    }],
                    timeout: API_CONFIG.TIMEOUT
                }),
                signal: AbortSignal.timeout(API_CONFIG.TIMEOUT)
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            dom.result.textContent = data.choices?.[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            clearInterval(progressInterval);
            dom.result.textContent = `請求失敗：${error.message}`;
        } finally {
            dom.progressBar.style.width = "100%";
            setTimeout(() => {
                dom.progressBar.parentElement.style.display = "none";
                dom.progressBar.style.width = "0%";
            }, 500);
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
                dom.extractTextBtn.disabled = false;
            };
            img.onerror = () => alert("圖片載入失敗，請使用其他圖片。");
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
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

            // 設置 Tesseract 進度回調
            const { createWorker } = Tesseract;
            const worker = await createWorker({
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        progressBar.style.width = `${progress.progress * 100}%`;
                    }
                }
            });

            await worker.loadLanguage('chi_tra+eng');
            await worker.initialize('chi_tra+eng');
            const { data } = await worker.recognize(dom.imageCanvas);
            await worker.terminate();

            // 移除進度條
            progressContainer.remove();

            dom.extractedText.textContent = data.text.trim() || "未能識別出文字";
            dom.translateExtractedBtn.disabled = !data.text.trim();
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

    init();
});
