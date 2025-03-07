// 使用免費代理繞過 CORS（僅用於測試）
const PROXY_URL = 'https://cors-anywhere.herokuapp.com/';
const API_URL = 'https://free.v36.cm';
const API_KEY = 'sk-TvndIpBUNiRsow2f892949F550B741CbBc16A098FcCc7827'; // 臨時寫死，正式環境需替換為後端方案

document.getElementById('translateButton').addEventListener('click', async () => {
    const text = document.getElementById('inputText').value;
    const sourceLang = document.getElementById('sourceLang').value;
    const targetLang = document.getElementById('targetLang').value;
    const tone = document.getElementById('tone').value;
    const resultDiv = document.getElementById('result');

    if (!text) {
        resultDiv.textContent = '請輸入文字';
        return;
    }

    try {
        resultDiv.textContent = '翻譯中...';
        const response = await fetch(PROXY_URL + API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest' // 避免代理攔截
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'user',
                    content: `請將以下${sourceLang}翻譯成${targetLang}，語氣為${tone}：${text}`
                }]
            })
        });

        const data = await response.json();
        resultDiv.textContent = data.choices[0].message.content;
    } catch (error) {
        resultDiv.textContent = `錯誤：${error.message}`;
    }
});
