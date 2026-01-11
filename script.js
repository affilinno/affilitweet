/**
 * AffilTweet Dashboard - JavaScript
 */

// ============================================
// API通信
// ============================================

async function apiGet(action) {
    const url = `${CONFIG.GAS_API_URL}?action=${action}&apiKey=${CONFIG.API_KEY}`;
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('通信エラーが発生しました', 'error');
        return null;
    }
}

async function apiPost(action, data = {}) {
    try {
        const response = await fetch(CONFIG.GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action, apiKey: CONFIG.API_KEY, ...data })
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('通信エラーが発生しました', 'error');
        return null;
    }
}

// ============================================
// ページナビゲーション
// ============================================

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.dataset.page;

            // ナビアクティブ状態を更新
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // ページを切り替え
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${pageName}`).classList.add('active');

            // ページ固有のデータ読み込み
            loadPageData(pageName);
        });
    });
}

function loadPageData(pageName) {
    switch (pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'trends':
            loadTrends();
            break;
        case 'products':
            // 検索時に読み込み
            break;
        case 'posts':
            loadPosts();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ============================================
// ダッシュボード
// ============================================

async function loadDashboard() {
    // 統計を読み込み
    const statsResult = await apiGet('getStats');
    if (statsResult && statsResult.success) {
        const stats = statsResult.data;
        document.getElementById('stat-total-posts').textContent = stats.totalPosts || 0;
        document.getElementById('stat-x-posts').textContent = stats.xPosts || 0;
        document.getElementById('stat-threads-posts').textContent = stats.threadsPosts || 0;
        document.getElementById('stat-impressions').textContent = formatNumber(stats.totalImpressions || 0);
    }

    // 最新トレンドを読み込み
    const trendsResult = await apiGet('getTrends');
    if (trendsResult && trendsResult.success) {
        renderLatestTrends(trendsResult.data.slice(0, 5));
    }

    // 最新投稿を読み込み
    const postsResult = await apiGet('getPosts');
    if (postsResult && postsResult.success) {
        renderLatestPosts(postsResult.data.slice(0, 5));
    }
}

function renderLatestTrends(trends) {
    const container = document.getElementById('latest-trends');
    if (!trends || trends.length === 0) {
        container.innerHTML = '<p class="loading">トレンドがありません</p>';
        return;
    }

    container.innerHTML = trends.map(t => `
    <div class="list-item">
      <div class="list-item-content">
        <h4>🔥 ${escapeHtml(t.keyword)}</h4>
        <p>${escapeHtml(t.reason || '')}</p>
      </div>
      <span class="badge ${t.used ? 'badge-success' : ''}">${t.used ? '使用済' : '未使用'}</span>
    </div>
  `).join('');
}

function renderLatestPosts(posts) {
    const container = document.getElementById('latest-posts');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p class="loading">投稿がありません</p>';
        return;
    }

    container.innerHTML = posts.map(p => `
    <div class="list-item">
      <div class="list-item-content">
        <h4>${escapeHtml(p.content.substring(0, 50))}...</h4>
        <p>${formatDate(p.postedAt)}</p>
      </div>
      <span class="badge badge-${p.sns}">${p.sns.toUpperCase()}</span>
    </div>
  `).join('');
}

// 自動投稿実行
document.getElementById('btn-run-scheduled')?.addEventListener('click', runScheduledPosts);

async function runScheduledPosts() {
    const countSelect = document.getElementById('scheduled-post-count');
    const count = parseInt(countSelect.value) || 1;

    if (!confirm(`自動投稿を${count}回実行しますか？\n（トレンド取得→商品検索→投稿を${count}回繰り返します）`)) {
        return;
    }

    showToast(`自動投稿を${count}回実行中...`, 'info');

    const result = await apiPost('runScheduledPost', { count: count });

    if (result && result.success) {
        const successCount = result.results.filter(r => r.success).length;
        const failCount = result.results.filter(r => !r.success).length;

        if (failCount === 0) {
            showToast(`✅ ${successCount}回の投稿が完了しました！`, 'success');
        } else {
            showToast(`⚠️ ${successCount}回成功、${failCount}回失敗`, 'warning');
        }

        // ダッシュボードを再読み込み
        loadDashboard();
    } else {
        showToast('自動投稿に失敗しました: ' + (result?.error || '不明なエラー'), 'error');
    }
}

// ============================================
// トレンド
// ============================================

async function loadTrends() {
    const container = document.getElementById('trends-list');
    container.innerHTML = '<div class="loading">読み込み中...</div>';

    const result = await apiGet('getTrends');
    if (result && result.success) {
        renderTrendsList(result.data);
    } else {
        container.innerHTML = '<p class="loading">トレンドの読み込みに失敗しました</p>';
    }
}

function renderTrendsList(trends) {
    const container = document.getElementById('trends-list');
    if (!trends || trends.length === 0) {
        container.innerHTML = '<p class="loading">トレンドがありません</p>';
        return;
    }

    container.innerHTML = trends.map(t => `
    <div class="list-item">
      <div class="list-item-content">
        <h4>🔥 ${escapeHtml(t.keyword)}</h4>
        <p>${escapeHtml(t.reason || '')} | ${formatDate(t.fetchedAt)}</p>
      </div>
      <div>
        <span class="badge ${t.used ? 'badge-success' : ''}">${t.used ? '使用済' : '未使用'}</span>
        <button class="btn btn-secondary" onclick="searchProductsWithTrend('${escapeHtml(t.keyword)}')">商品検索</button>
      </div>
    </div>
  `).join('');
}

async function fetchNewTrends() {
    showToast('トレンドを取得中...', 'info');
    const result = await apiPost('fetchTrends');
    if (result && result.trends) {
        showToast(`${result.trends.length}件のトレンドを取得しました`, 'success');
        loadDashboard();
        loadTrends();
    } else {
        showToast('トレンドの取得に失敗しました', 'error');
    }
}

// ============================================
// 商品
// ============================================

async function searchProducts(keyword) {
    const container = document.getElementById('products-list');
    container.innerHTML = '<div class="loading">検索中...</div>';

    const result = await apiPost('searchProducts', { keyword });
    if (result && result.products) {
        renderProductsList(result.products, keyword);
    } else {
        container.innerHTML = '<p class="loading">商品が見つかりませんでした</p>';
    }
}

function renderProductsList(products, keyword) {
    const container = document.getElementById('products-list');
    if (!products || products.length === 0) {
        container.innerHTML = '<p class="loading">商品がありません</p>';
        return;
    }

    container.innerHTML = products.map(p => `
    <div class="list-item">
      <div class="list-item-content">
        <h4>${escapeHtml(p.productName)}</h4>
        <p>💰 ${formatNumber(p.price)}円 | ${p.category}</p>
      </div>
      <div class="product-actions" style="display: flex; gap: 8px; flex-direction: column; align-items: flex-end;">
        <a href="${p.affiliateUrl}" target="_blank" class="btn btn-secondary" style="font-size: 0.8rem; padding: 4px 8px;">商品を見る</a>
        <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
          <button class="btn" style="background: #000; color: #fff; font-size: 0.8rem; padding: 4px 8px;" onclick="triggerManualPost('${escapeHtml(p.productName)}', 'x', '${escapeHtml(keyword)}')">X投稿</button>
          <button class="btn" style="background: #101010; color: #fff; border: 1px solid #333; font-size: 0.8rem; padding: 4px 8px;" onclick="triggerManualPost('${escapeHtml(p.productName)}', 'threads', '${escapeHtml(keyword)}')">Threads投稿</button>
          <button class="btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 0.8rem; padding: 4px 8px;" onclick="triggerManualPost('${escapeHtml(p.productName)}', 'both', '${escapeHtml(keyword)}')">両方投稿</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function triggerManualPost(productName, sns, keyword) {
    // snsが'both'の場合は両方に投稿
    const snsLabel = sns === 'both' ? 'X＆Threads' : sns.toUpperCase();

    if (!confirm(`${snsLabel}に投稿しますか？\nキーワード: ${keyword}`)) return;

    showToast(`${snsLabel}に投稿中...`, 'info');

    const product = currentProducts.find(p => p.productName === productName);
    if (!product) {
        showToast('商品データの取得に失敗しました', 'error');
        return;
    }

    if (sns === 'both') {
        // 両方投稿
        const xResult = await apiPost('manualPostRaw', {
            trendKeyword: keyword,
            product: product,
            sns: 'x'
        });

        const threadsResult = await apiPost('manualPostRaw', {
            trendKeyword: keyword,
            product: product,
            sns: 'threads'
        });

        if (xResult?.success && threadsResult?.success) {
            showToast('X＆Threads両方に投稿しました！', 'success');
        } else if (xResult?.success) {
            showToast('Xに投稿しました（Threads失敗）', 'warning');
        } else if (threadsResult?.success) {
            showToast('Threadsに投稿しました（X失敗）', 'warning');
        } else {
            showToast('両方の投稿に失敗しました', 'error');
        }
    } else {
        // 単独投稿
        const result = await apiPost('manualPostRaw', {
            trendKeyword: keyword,
            product: product,
            sns: sns
        });

        if (result && result.success) {
            showToast('投稿しました！', 'success');
        } else {
            showToast('投稿に失敗しました: ' + (result?.message || '不明なエラー'), 'error');
        }
    }
}

// 検索結果を保持する変数
let currentProducts = [];

// searchProductsも更新してcurrentProductsに保存
async function searchProducts(keyword) {
    const container = document.getElementById('products-list');
    container.innerHTML = '<div class="loading">検索中...</div>';

    const result = await apiPost('searchProducts', { keyword });
    if (result && result.products) {
        currentProducts = result.products; // 保存
        renderProductsList(result.products, keyword);
    } else {
        currentProducts = [];
        container.innerHTML = '<p class="loading">商品が見つかりませんでした</p>';
    }
}

function searchProductsWithTrend(keyword) {
    // 商品ページに移動して検索
    document.querySelector('[data-page="products"]').click();
    document.getElementById('product-search-input').value = keyword;
    searchProducts(keyword);
}

// ============================================
// 楽天トラベル
// ============================================

// トラベル検索結果を保持
let currentTravelProducts = [];

async function searchTravel(area) {
    const container = document.getElementById('travel-list');
    container.innerHTML = '<div class="loading">検索中...</div>';

    const result = await apiPost('searchTravel', { keyword: area });
    if (result && result.products && result.products.length > 0) {
        currentTravelProducts = result.products;
        renderTravelList(result.products, area);
    } else {
        currentTravelProducts = [];
        container.innerHTML = '<p class="loading">ホテルが見つかりませんでした</p>';
    }
}

function renderTravelList(hotels, area) {
    const container = document.getElementById('travel-list');
    if (!hotels || hotels.length === 0) {
        container.innerHTML = '<p class="loading">ホテルがありません</p>';
        return;
    }

    container.innerHTML = hotels.map(h => `
    <div class="list-item" style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; margin-bottom: 8px;">
      <div class="list-item-content">
        <h4>🏨 ${escapeHtml(h.productName)}</h4>
        <p>📍 ${escapeHtml(h.area || area)} | 💰 ${formatNumber(h.price)}円〜</p>
      </div>
      <div class="product-actions" style="display: flex; gap: 8px; flex-direction: column; align-items: flex-end;">
        <a href="${h.affiliateUrl}" target="_blank" class="btn btn-secondary" style="font-size: 0.8rem; padding: 4px 8px;">ホテル詳細</a>
        <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
          <button class="btn" style="background: #000; color: #fff; font-size: 0.8rem; padding: 4px 8px;" onclick="triggerTravelPost('${escapeHtml(h.productName)}', 'x', '${escapeHtml(area)}')">X投稿</button>
          <button class="btn" style="background: #101010; color: #fff; border: 1px solid #333; font-size: 0.8rem; padding: 4px 8px;" onclick="triggerTravelPost('${escapeHtml(h.productName)}', 'threads', '${escapeHtml(area)}')">Threads投稿</button>
          <button class="btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 0.8rem; padding: 4px 8px;" onclick="triggerTravelPost('${escapeHtml(h.productName)}', 'both', '${escapeHtml(area)}')">両方投稿</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function triggerTravelPost(hotelName, sns, area) {
    const snsLabel = sns === 'both' ? 'X＆Threads' : sns.toUpperCase();

    if (!confirm(`${snsLabel}に「${area}のおすすめホテル」として投稿しますか？`)) return;

    showToast(`${snsLabel}に投稿中...`, 'info');

    const hotel = currentTravelProducts.find(h => h.productName === hotelName);
    if (!hotel) {
        showToast('ホテルデータの取得に失敗しました', 'error');
        return;
    }

    const trendKeyword = `${area} 旅行`;

    if (sns === 'both') {
        const xResult = await apiPost('manualPostRaw', {
            trendKeyword: trendKeyword,
            product: hotel,
            sns: 'x'
        });

        const threadsResult = await apiPost('manualPostRaw', {
            trendKeyword: trendKeyword,
            product: hotel,
            sns: 'threads'
        });

        if (xResult?.success && threadsResult?.success) {
            showToast('X＆Threads両方に投稿しました！', 'success');
        } else if (xResult?.success) {
            showToast('Xに投稿しました（Threads失敗）', 'warning');
        } else if (threadsResult?.success) {
            showToast('Threadsに投稿しました（X失敗）', 'warning');
        } else {
            showToast('両方の投稿に失敗しました', 'error');
        }
    } else {
        const result = await apiPost('manualPostRaw', {
            trendKeyword: trendKeyword,
            product: hotel,
            sns: sns
        });

        if (result && result.success) {
            showToast('投稿しました！', 'success');
        } else {
            showToast('投稿に失敗しました: ' + (result?.message || '不明なエラー'), 'error');
        }
    }
}

// ============================================
// 投稿履歴
// ============================================

async function loadPosts() {
    const container = document.getElementById('posts-list');
    container.innerHTML = '<div class="loading">読み込み中...</div>';

    const result = await apiGet('getPosts');
    if (result && result.success) {
        renderPostsList(result.data);
    } else {
        container.innerHTML = '<p class="loading">投稿履歴の読み込みに失敗しました</p>';
    }
}

function renderPostsList(posts) {
    const container = document.getElementById('posts-list');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p class="loading">投稿履歴がありません</p>';
        return;
    }

    container.innerHTML = posts.map(p => `
    <div class="list-item">
      <div class="list-item-content">
        <h4>${escapeHtml(p.content.substring(0, 80))}...</h4>
        <p>🏷️ ${escapeHtml(p.trendKeyword)} | ${formatDate(p.postedAt)}</p>
      </div>
      <div>
        <span class="badge badge-${p.sns}">${p.sns.toUpperCase()}</span>
        <span class="badge badge-${p.status === 'posted' ? 'success' : 'failed'}">${p.status}</span>
      </div>
    </div>
  `).join('');
}

// ============================================
// 設定
// ============================================

async function loadSettings() {
    const result = await apiGet('getConfig');
    if (result && result.success) {
        const config = result.data;

        // 値を設定
        setValue('setting-ai-model', config.AI_MODEL?.value || 'gemini');
        setChecked('setting-x-enabled', config.X_POST_ENABLED?.value);
        setChecked('setting-threads-enabled', config.THREADS_POST_ENABLED?.value);
        setValue('setting-post-times', config.POST_TIMES?.value || '08:00,12:30,21:00');

        setChecked('setting-cat-product', config.CATEGORY_PRODUCT?.value);
        setChecked('setting-cat-book', config.CATEGORY_BOOK?.value);
        setChecked('setting-cat-cd', config.CATEGORY_CD?.value);
        setChecked('setting-cat-dvd', config.CATEGORY_DVD?.value);
        setChecked('setting-cat-game', config.CATEGORY_GAME?.value);
        setChecked('setting-cat-travel', config.CATEGORY_TRAVEL?.value);

        setValue('setting-prompt-trend', config.PROMPT_TREND?.value || '');
        setValue('setting-prompt-x', config.PROMPT_X_POST?.value || '');
        setValue('setting-prompt-threads', config.PROMPT_THREADS_POST?.value || '');
    }
}

async function saveSettings() {
    const configs = {
        AI_MODEL: getValue('setting-ai-model'),
        X_POST_ENABLED: getChecked('setting-x-enabled'),
        THREADS_POST_ENABLED: getChecked('setting-threads-enabled'),
        POST_TIMES: getValue('setting-post-times'),
        CATEGORY_PRODUCT: getChecked('setting-cat-product'),
        CATEGORY_BOOK: getChecked('setting-cat-book'),
        CATEGORY_CD: getChecked('setting-cat-cd'),
        CATEGORY_DVD: getChecked('setting-cat-dvd'),
        CATEGORY_GAME: getChecked('setting-cat-game'),
        CATEGORY_TRAVEL: getChecked('setting-cat-travel'),
        PROMPT_TREND: getValue('setting-prompt-trend'),
        PROMPT_X_POST: getValue('setting-prompt-x'),
        PROMPT_THREADS_POST: getValue('setting-prompt-threads')
    };

    showToast('設定を保存中...', 'info');
    const result = await apiPost('updateConfig', { configs });
    if (result && result.success) {
        showToast('設定を保存しました', 'success');
    } else {
        showToast('設定の保存に失敗しました', 'error');
    }
}

// ============================================
// ユーティリティ
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

function formatNumber(num) {
    return new Intl.NumberFormat('ja-JP').format(num);
}

function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('ja-JP');
}

function getValue(id) {
    return document.getElementById(id)?.value || '';
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

function getChecked(id) {
    return document.getElementById(id)?.checked || false;
}

function setChecked(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = value === true || value === 'TRUE';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================
// 初期化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();

    // イベントリスナー
    document.getElementById('btn-fetch-trends')?.addEventListener('click', fetchNewTrends);
    document.getElementById('btn-fetch-trends-2')?.addEventListener('click', fetchNewTrends);
    document.getElementById('btn-search-products')?.addEventListener('click', () => {
        const keyword = document.getElementById('product-search-input').value;
        if (keyword) searchProducts(keyword);
    });
    document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);
    document.getElementById('btn-setup-triggers')?.addEventListener('click', setupTriggers);
    document.getElementById('btn-delete-triggers')?.addEventListener('click', deleteTriggers);

    // 初期データ読み込み
    loadDashboard();
});

async function setupTriggers() {
    if (!confirm('現在の「投稿時間」設定に基づいて、自動投稿トリガーを設定・更新しますか？')) return;

    showToast('トリガーを設定中...', 'info');
    const result = await apiPost('setupTriggers');

    if (result && result.success) {
        showToast(result.message, 'success');
    } else {
        showToast('トリガー設定に失敗しました', 'error');
    }
}

async function deleteTriggers() {
    if (!confirm('すべての自動投稿トリガーを削除して停止しますか？')) return;

    showToast('トリガーを削除中...', 'info');
    const result = await apiPost('deleteTriggers');

    if (result && result.success) {
        showToast(result.message, 'success');
    } else {
        showToast('トリガー削除に失敗しました', 'error');
    }
}
