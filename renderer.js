const DEFAULT_ADS =
  'https://seller-vn.tiktok.com/ads-creation/dashboard?origin=SC_ads_tab_button_PC&btm_pre_unit_params=%7B%22btm_origin%22%3A%22sidebar_menu_Qu%E1%BA%A3ng+c%C3%A1o+c%E1%BB%ADa+h%C3%A0ng%22%7D';
const DEFAULT_ORDERS =
  'https://seller-vn.tiktok.com/order?selected_sort=6&tab=all&time_order_created[]=1791738000000&time_order_created[]=1791767991999';

let shops = [];
let activeId = null;
let activeTab = 'ads'; // 'ads' | 'orders'
let editingId = null;
const views = {}; // key "shopId:tab" -> <webview>

const $ = (id) => document.getElementById(id);
const content = $('content');

async function persist() {
  await window.api.saveShops(shops);
}

let draggedIndex = null;

async function moveShop(fromIndex, delta) {
  const toIndex = fromIndex + delta;
  if (toIndex < 0 || toIndex >= shops.length) return;
  const [moved] = shops.splice(fromIndex, 1);
  shops.splice(toIndex, 0, moved);
  await persist();
  renderList();
}

function renderList() {
  const list = $('shopList');
  list.innerHTML = '';
  shops.forEach((s, index) => {
    const el = document.createElement('div');
    el.className = 'shop' + (s.id === activeId ? ' active' : '');
    el.setAttribute('draggable', 'true');
    el.dataset.id = s.id;
    el.dataset.index = index;

    el.innerHTML = `
      <span class="drag-handle" title="Kéo thả để đổi thứ tự">⠿</span>
      <div class="dot"></div>
      <span class="name" title="${s.name}"></span>
      <div class="reorder-actions">
        <button class="move-btn move-up" title="Di chuyển lên trên" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button class="move-btn move-down" title="Di chuyển xuống dưới" ${index === shops.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
    `;

    el.querySelector('.dot').style.background = s.color;
    el.querySelector('.name').textContent = s.name;

    // Nut di chuyen len / xuong
    const upBtn = el.querySelector('.move-up');
    const downBtn = el.querySelector('.move-down');

    upBtn.onclick = (e) => {
      e.stopPropagation();
      moveShop(index, -1);
    };

    downBtn.onclick = (e) => {
      e.stopPropagation();
      moveShop(index, 1);
    };

    // Click mo gian hang
    el.onclick = (e) => {
      if (e.target.closest('.move-btn')) return;
      openShop(s.id);
    };

    // Keo tha doi thu tu (Drag & Drop)
    el.addEventListener('dragstart', (e) => {
      draggedIndex = index;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedIndex = null;
      document.querySelectorAll('.shop').forEach((item) => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedIndex === null || draggedIndex === index) return;
      const rect = el.getBoundingClientRect();
      const isTop = (e.clientY - rect.top) < (rect.height / 2);
      el.classList.toggle('drag-over-top', isTop);
      el.classList.toggle('drag-over-bottom', !isTop);
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      el.classList.remove('drag-over-top', 'drag-over-bottom');
      if (draggedIndex === null || draggedIndex === index) return;

      const rect = el.getBoundingClientRect();
      const isTop = (e.clientY - rect.top) < (rect.height / 2);

      const [movedItem] = shops.splice(draggedIndex, 1);
      let targetIdx = shops.indexOf(s);
      if (!isTop) targetIdx += 1;
      shops.splice(targetIdx, 0, movedItem);

      draggedIndex = null;
      await persist();
      renderList();
    });

    list.appendChild(el);
  });
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function getView(shop, tab = activeTab) {
  const key = shop.id + ':' + tab;
  if (!views[key]) {
    const wv = document.createElement('webview');
    // Moi gian 1 partition rieng dung chung cho ca 2 tab de giu phien dang nhap
    wv.setAttribute('partition', 'persist:shop-' + shop.id);
    wv.setAttribute('useragent', CHROME_UA);
    wv.setAttribute('allowpopups', '');
    wv.className = 'hidden';
    wv.src = tab === 'orders'
      ? (shop.ordersUrl || DEFAULT_ORDERS)
      : (shop.adsUrl || shop.sellerUrl || DEFAULT_ADS);
    content.appendChild(wv);
    views[key] = wv;
  }
  return views[key];
}

function showCurrent() {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  const shop = shops.find((s) => s.id === activeId);
  const has = !!shop;
  $('empty').classList.toggle('hidden', has);
  $('topbar').classList.toggle('hidden', !has);
  $('colorBar').style.background = has ? shop.color : '#444';
  if (!has) return;
  $('shopTitle').textContent = shop.name;
  $('shopTitle').style.color = shop.color;

  $('tabAdsBtn').classList.toggle('active', activeTab === 'ads');
  $('tabOrdersBtn').classList.toggle('active', activeTab === 'orders');

  const curWv = getView(shop, activeTab);
  curWv.classList.remove('hidden');
  try {
    updateZoomLabel(curWv.getZoomFactor() || 1.0);
  } catch {
    updateZoomLabel(1.0);
  }
}

function switchTab(tab) {
  if (activeTab === tab) return;
  activeTab = tab;
  showCurrent();
}

$('tabAdsBtn').onclick = () => switchTab('ads');
$('tabOrdersBtn').onclick = () => switchTab('orders');

function openShop(id) {
  activeId = id;
  renderList();
  showCurrent();
}

function currentView() {
  const shop = shops.find((s) => s.id === activeId);
  return shop ? views[shop.id + ':' + activeTab] : null;
}

// ---- Zoom Controls ----
function updateZoomLabel(factor) {
  const lbl = $('zoomResetBtn');
  if (lbl) lbl.textContent = Math.round((factor || 1.0) * 100) + '%';
}

function applyZoom(delta) {
  const v = currentView();
  if (!v) return;
  try {
    let current = v.getZoomFactor() || 1.0;
    let next = Math.round((current + delta) * 10) / 10;
    next = Math.max(0.5, Math.min(2.5, next));
    v.setZoomFactor(next);
    updateZoomLabel(next);
  } catch {}
}

function resetZoom() {
  const v = currentView();
  if (!v) return;
  try {
    v.setZoomFactor(1.0);
    updateZoomLabel(1.0);
  } catch {}
}

$('zoomOutBtn').onclick = () => applyZoom(-0.1);
$('zoomInBtn').onclick = () => applyZoom(0.1);
$('zoomResetBtn').onclick = () => resetZoom();

window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    if (e.deltaY < 0) applyZoom(0.1);
    else applyZoom(-0.1);
  }
}, { passive: false });

$('reloadBtn').onclick = () => currentView() && currentView().reload();
$('backBtn').onclick = () => {
  const v = currentView();
  if (v && v.canGoBack()) v.goBack();
};

// ---- Dong / mo danh sach gian hang (Sidebar) ----
const sidebar = $('sidebar');
const toggleBtn = $('toggleSidebarBtn');

function setSidebarCollapsed(collapsed) {
  sidebar.classList.toggle('collapsed', collapsed);
  toggleBtn.textContent = collapsed ? '▶' : '◀';
  toggleBtn.title = collapsed ? 'Mở danh sách gian hàng' : 'Thu gọn danh sách gian hàng';
  localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
}

toggleBtn.onclick = () => {
  const isCollapsed = sidebar.classList.contains('collapsed');
  setSidebarCollapsed(!isCollapsed);
};

if (localStorage.getItem('sidebar_collapsed') === '1') {
  setSidebarCollapsed(true);
}

// ---- Them / sua gian ----
function openDialog(shop) {
  editingId = shop ? shop.id : null;
  $('dlgTitle').textContent = shop ? 'Sửa gian hàng' : 'Thêm gian hàng';
  $('fName').value = shop ? shop.name : '';
  $('fAds').value = shop ? (shop.adsUrl || shop.sellerUrl || DEFAULT_ADS) : DEFAULT_ADS;
  $('fOrders').value = shop ? (shop.ordersUrl || DEFAULT_ORDERS) : DEFAULT_ORDERS;
  $('fColor').value = shop ? shop.color : randomColor();
  $('dlg').showModal();
}

function randomColor() {
  const palette = ['#0f9d94', '#e5484d', '#f5a524', '#3e63dd', '#8e4ec6', '#30a46c', '#d6409f', '#12a594'];
  return palette[shops.length % palette.length];
}

$('addBtn').onclick = () => openDialog(null);
$('editBtn').onclick = () => openDialog(shops.find((s) => s.id === activeId));
$('cancelBtn').onclick = () => $('dlg').close();

$('saveBtn').onclick = async () => {
  const name = $('fName').value.trim();
  if (!name) return $('fName').focus();

  const data = {
    name,
    adsUrl: $('fAds').value.trim() || DEFAULT_ADS,
    ordersUrl: $('fOrders').value.trim() || DEFAULT_ORDERS,
    color: $('fColor').value
  };
  if (editingId) {
    const s = shops.find((x) => x.id === editingId);
    const adsChanged = (s.adsUrl || s.sellerUrl) !== data.adsUrl;
    const ordersChanged = (s.ordersUrl || DEFAULT_ORDERS) !== data.ordersUrl;
    Object.assign(s, data);

    const adsKey = s.id + ':ads';
    if (adsChanged && views[adsKey]) {
      views[adsKey].remove();
      delete views[adsKey];
    }
    const ordersKey = s.id + ':orders';
    if (ordersChanged && views[ordersKey]) {
      views[ordersKey].remove();
      delete views[ordersKey];
    }
  } else {
    const id = Date.now().toString(36);
    shops.push({ id, ...data });
    activeId = id;
  }
  await persist();
  $('dlg').close();
  renderList();
  showCurrent();
};

// ---- Dang xuat / xoa ----
$('logoutBtn').onclick = async () => {
  const shop = shops.find((s) => s.id === activeId);
  if (!shop) return;
  if (!confirm('Đăng xuất gian "' + shop.name + '"? Lần sau phải đăng nhập lại.')) return;
  await window.api.clearSession(shop.id);
  [':ads', ':orders'].forEach((suffix) => {
    const key = shop.id + suffix;
    if (views[key]) views[key].reload();
  });
};

$('deleteBtn').onclick = async () => {
  const shop = shops.find((s) => s.id === activeId);
  if (!shop) return;
  if (!confirm('Xóa gian "' + shop.name + '" khỏi app? (cũng xóa phiên đăng nhập đã lưu)')) return;
  await window.api.clearSession(shop.id);
  [':ads', ':orders'].forEach((suffix) => {
    const key = shop.id + suffix;
    if (views[key]) {
      views[key].remove();
      delete views[key];
    }
  });
  shops = shops.filter((s) => s.id !== shop.id);
  activeId = shops.length ? shops[0].id : null;
  await persist();
  renderList();
  showCurrent();
};

(async function init() {
  shops = await window.api.getShops();
  if (shops.length) activeId = shops[0].id;
  renderList();
  showCurrent();
})();
