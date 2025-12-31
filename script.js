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
        renderProductsList(result.products);
    } else {
        container.innerHTML = '<p class="loading">商品が見つかりませんでした</p>';
    }
}

function renderProductsList(products) {
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
      <a href="${p.affiliateUrl}" target="_blank" class="btn btn-secondary">商品を見る</a>
    </div>
  `).join('');
}

function searchProductsWithTrend(keyword) {
    // 商品ページに移動して検索
    document.querySelector('[data-page="products"]').click();
    document.getElementById('product-search-input').value = keyword;
    searchProducts(keyword);
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

    // 初期データ読み込み
    loadDashboard();
});
