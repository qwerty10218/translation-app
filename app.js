document.addEventListener("DOMContentLoaded", () => {
    // 配置
    const API_CONFIG = {
        URL: "https://free.v36.cm/v1/chat/completions",
        KEY: "your-api-key-here", // 这里不要暴露真实 API Key
        TIMEOUT: 15000
    };

    // 获取 DOM 元素
    const dom = {
        // 标签页
        tabs: document.querySelectorAll(".tab-button"),
        tabContents: document.querySelectorAll(".tab-content"),
        
        // 文本翻译相关元素
        inputText: document.getElementById("inputText"),
        translateBtn: document.getElementById("translateButton"),
        result: document.getElementById("result"),
        sourceLang: document.getElementById("sourceLang"),
        targetLang: document.getElementById("targetLang"),
        swapLang: document.getElementById("swapLang"),

        // 图片翻译相关元素
        imageInput: document.getElementById("imageInput"),
        imageDropArea: document.getElementById("imageDropArea"),
        imageCanvas: document.getElementById("imageCanvas"),
        extractTextBtn: document.getElementById("extractTextButton"),
        translateExtractedBtn: document.getElementById("translateExtractedButton"),
        extractedText: document.getElementById("extractedText"),
    };

    // 初始化应用
    function init() {
        initTabs();
        initTextTranslation();
        initImageTranslation();
    }

    // 标签页切换功能
    function initTabs() {
        dom.tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                // 切换激活状态
                dom.tabs.forEach(t => t.classList.remove("active"));
                dom.tabContents.forEach(c => c.classList.remove("active"));

                tab.classList.add("active");
                const tabId = tab.getAttribute("data-tab");
                document.getElementById(tabId).classList.add("active");

                // 清除结果
                dom.result.textContent = "";
                dom.extractedText.textContent = "";
            });
        });
    }

    // 文本翻译功能初始化
    function initTextTranslation() {
        dom.translateBtn.addEventListener("click", handleTranslation);
        dom.swapLang.addEventListener("click", swapLanguages);
        dom.inputText.addEventListener("input", validateTranslationInput);
    }

    // 交换语言
    function swapLanguages() {
        const temp = dom.sourceLang.value;
        dom.sourceLang.value = dom.targetLang.value;
        dom.targetLang.value = temp;

        if (dom.sourceLang.value === dom.targetLang.value) {
            dom.targetLang.selectedIndex = (dom.targetLang.selectedIndex + 1) % dom.targetLang.options.length;
        }

        validateTranslationInput();
    }

    // 确保翻译按钮状态正确
    function validateTranslationInput() {
        dom.translateBtn.disabled = !dom.inputText.value.trim();
    }

    // 处理翻译请求
    async function handleTranslation() {
        const text = dom.inputText.value.trim();
        if (text.length === 0) {
            alert("請輸入要翻譯的內容");
            return;
        }

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
            dom.result.textContent = data.choices[0]?.message?.content || "翻譯失敗";
        } catch (error) {
            dom.result.textContent = "請求失敗：" + error.message;
        }
    }

    init();
});
