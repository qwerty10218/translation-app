document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827", // 這裡不要暴露真實 API Key
        TIMEOUT: 15000
    };

    // 獲取 DOM 元素
    const dom = {
        // 標籤頁
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        
        // 文本翻譯相關元素
        inputText: document.getElementById("inputText"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        swapLang: document.getElementById("swapLang"),

        // 圖片翻譯相關元素
        imageInput: document.getElementById("imageInput"),
        imageCanvas: document.getElementById("imageCanvas"),
        extractTextBtn: document.getElementById("extractTextButton"),
        translateExtractedBtn: document.getElementById("translateExtractedButton"),
        extractedText: document.getElementById("extractedText"),
    };

    // 初始化應用
    function init() {
        initTabs();
        initTextTranslation();
        initImageTranslation();
    }

    // 標籤頁切換功能
    function initTabs() {
        dom.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                dom.tabs.forEach(t => t.classList.remove("active"));
                dom.tabContents.forEach(c => c.classList.remove("active"));

                tab.classList.add("active");
                const tabId = tab.getAttribute("data-tab");
                document.getElementById(tabId).classList.add("active");

                dom.result.textContent = "";
                dom.extractedText.textContent = "";
            });
        });
    }

    // 文本翻譯功能初始化
    function initTextTranslation() {
        dom.translateBtn.addEventListener("click", handleTranslation);
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", validateTranslationInput);
    }

    // 交換語言
    function swapLanguages() {
        const temp = dom.sourceLang.value;
        dom.sourceLang.value = dom.targetLang.value;
        dom.targetLang.value = temp;

        if (dom.sourceLang.value === dom.targetLang.value) {
            dom.targetLang.selectedIndex = (dom.targetLang.selectedIndex + 1) % dom.targetLang.options.length;
        }

        validateTranslationInput();
    }

    // 確保翻譯按鈕狀態正確
    function validateTranslationInput() {
        dom.translateBtn.disabled = !dom.inputText.value.trim();
    }

    // 進行文本翻譯
    async function handleTranslation() {
        const text = dom.inputText.value.trim();
        if (text.length === 0) {
            alert("請輸入要翻譯的內容");
            return;
        }

        dom.result.textContent = "翻譯中...";
        const prompt = `請將以下${dom.sourceLang.value}文本翻譯成${dom.targetLang.value}，只返回翻譯結果：\n\n${text}`;
        try {
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }]
                })
            });

            const data = await response.json();

            if (!data.choices || data.choices.length === 0) {
                dom.result.textContent = "翻譯失敗：API 未返回有效結果";
                return;
            }

            dom.result.textContent = data.choices[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            dom.result.textContent = "請求失敗：" + error.message;
        }
    }

    // 初始化圖片翻譯功能
    function initImageTranslation() {
        dom.imageInput.addEventListener("change", handleImageUpload);
        dom.extractTextBtn.addEventListener("click", extractTextFromImage);
        dom.translateExtractedBtn.addEventListener("click", translateExtractedText);
    }

    // 處理圖片上傳
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.match('image.*')) {
            alert("請上傳圖片文件");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = dom.imageCanvas;
                const ctx = canvas.getContext("2d");

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, img.width, img.height);
                
                dom.extractTextBtn.disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // OCR 文字識別
    async function extractTextFromImage() {
        dom.extractTextBtn.disabled = true;
        dom.translateExtractedBtn.disabled = true;
        dom.extractedText.textContent = "識別中...";

        try {
            const { data } = await Tesseract.recognize(
                dom.imageCanvas,
                "chi_tra+eng",
                { logger: (m) => console.log(m) }
            );

            dom.extractedText.textContent = data.text.trim();
            dom.translateExtractedBtn.disabled = !data.text.trim();
        } catch (error) {
            dom.extractedText.textContent = "識別失敗：" + error.message;
        } finally {
            dom.extractTextBtn.disabled = false;
        }
    }

    // 翻譯擷取的文字
    async function translateExtractedText() {
        const extractedText = dom.extractedText.textContent.trim();
        if (!extractedText) {
            alert("沒有可翻譯的文字");
            return;
        }

        dom.extractedText.textContent = "翻譯中...";
        try {
            const prompt = `請將以下文本翻譯成${dom.targetLang.value}，只返回翻譯結果：\n\n${extractedText}`;
            const response = await fetch(API_CONFIG.URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_CONFIG.KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: prompt }]
                })
            });

            const data = await response.json();
            dom.extractedText.textContent = data.choices[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            dom.extractedText.textContent = "請求失敗：" + error.message;
        }
    }

    // 啟動應用
    init();
});
