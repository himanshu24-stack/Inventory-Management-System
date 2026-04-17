let allProducts = [];
let allCategories = [];

document.addEventListener('DOMContentLoaded', () => {
    // Set User Info

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString(undefined, options);

    loadCategories();
    loadProducts();

    // Event Listeners
    document.getElementById('productForm').addEventListener('submit', saveProduct);
    document.getElementById('searchInput').addEventListener('input', filterProducts);
});

async function loadCategories() {
    const res = await apiCall('/products/categories/all', 'GET');
    if (res.data.success) {
        allCategories = res.data.data;
        const select = document.getElementById('categoryId');

        // Add option to create new
        select.innerHTML = '<option value="">Select Category</option>';
        allCategories.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
        select.innerHTML += '<option value="new">+ Add New Category</option>';

        select.addEventListener('change', async (e) => {
            if (e.target.value === 'new') {
                e.target.value = '';
                const newCat = prompt("Enter new Category name:");
                if (newCat && newCat.trim() !== '') {
                    const resCat = await apiCall('/products/categories', 'POST', { name: newCat.trim() });
                    if (resCat.data.success) {
                        showToast('Category created!', 'success');
                        await loadCategories();
                        document.getElementById('categoryId').value = resCat.data.data.id;
                    } else {
                        showToast(resCat.data.message || 'Error creating category', 'error');
                    }
                }
            }
        });
    }
}

let outOfStockData = [];
let lowStockData = [];
let currentFilteredOut = [];
let currentFilteredLow = [];

let currentPageOut = 1;
let currentPageLow = 1;
const itemsPerPage = 10;

async function loadProducts() {
    const res = await apiCall('/products', 'GET');
    if (res.data.success) {
        allProducts = res.data.data;
        outOfStockData = allProducts.filter(p => Number(p.stock) === 0);
        lowStockData = allProducts.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.min_stock_level));

        currentFilteredOut = outOfStockData;
        currentFilteredLow = lowStockData;

        renderOutTable();
        renderLowTable();

        // Update tab badges
        const outTabBadge = document.getElementById('outTabBadge');
        if (outTabBadge) outTabBadge.textContent = outOfStockData.length;
        const lowTabBadge = document.getElementById('lowTabBadge');
        if (lowTabBadge) lowTabBadge.textContent = lowStockData.length;
    } else {
        showToast('Failed to load products', 'error');
    }
}

function renderTable(tableId, data, currentPage) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    let actualPage = currentPage;
    if (actualPage > totalPages) actualPage = totalPages;
    if (actualPage < 1) actualPage = 1;

    if (tableId === 'outOfStockBody') {
        currentPageOut = actualPage;
    } else {
        currentPageLow = actualPage;
    }

    const startIndex = (actualPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = data.slice(startIndex, endIndex);

    // Update pagination UI dynamically based on the table
    const prefix = tableId === 'outOfStockBody' ? 'out' : 'low';
    const pageStartEl = document.getElementById(`${prefix}PageStart`);
    const pageEndEl = document.getElementById(`${prefix}PageEnd`);
    const totalItemsEl = document.getElementById(`${prefix}TotalItems`);
    const prevBtn = document.getElementById(`prevPageBtn${prefix === 'out' ? 'Out' : 'Low'}`);
    const nextBtn = document.getElementById(`nextPageBtn${prefix === 'out' ? 'Out' : 'Low'}`);

    const firstBtn = document.getElementById(`firstPageBtn${prefix === 'out' ? 'Out' : 'Low'}`);
    const lastBtn = document.getElementById(`lastPageBtn${prefix === 'out' ? 'Out' : 'Low'}`);

    if (pageStartEl) {
        pageStartEl.textContent = totalItems === 0 ? 0 : startIndex + 1;
        pageEndEl.textContent = endIndex;
        totalItemsEl.textContent = totalItems;
        prevBtn.disabled = actualPage === 1 || totalItems === 0;
        nextBtn.disabled = actualPage === totalPages || totalItems === 0;

        if (firstBtn) firstBtn.disabled = actualPage === 1 || totalItems === 0;
        if (lastBtn) lastBtn.disabled = actualPage === totalPages || totalItems === 0;
    }

    if (paginatedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-slate-500">No products found</td></tr>';
        return;
    }

    paginatedItems.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group";

        let statusBadge = '';
        if (Number(p.stock) === 0) {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Out of Stock</span>`;
        } else if (Number(p.stock) <= Number(p.min_stock_level)) {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/30"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Low Stock</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Stock</span>`;
        }

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <i class="ph ph-package text-xl"></i>
                    </div>
                    <div>
                        <div class="font-medium text-slate-900 dark:text-white">${p.name}</div>
                        <div class="text-xs text-slate-500 font-mono mt-0.5">${p.barcode || 'NO-SKU'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">${p.category_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">${formatCurrency(p.price)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right font-medium ${p.stock <= p.min_stock_level && p.stock > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}">${p.stock}</td>
            <td class="px-6 py-4 whitespace-nowrap">${statusBadge}</td>
            <td class="px-6 py-4 whitespace-nowrap flex items-center justify-end gap-2">
                <input type="number" id="updateStock_${p.id}" value="${p.stock}" class="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none text-slate-900 dark:text-white text-center">
                <button onclick="quickUpdateStock(${p.id})" class="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm shadow-primary-500/30">
                    Update
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderOutTable() {
    renderTable('outOfStockBody', currentFilteredOut, currentPageOut);
}

function renderLowTable() {
    renderTable('lowStockBody', currentFilteredLow, currentPageLow);
}

function filterProducts(e) {
    const term = e.target.value.toLowerCase();

    currentFilteredOut = outOfStockData.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.category_name && p.category_name.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
    );

    currentFilteredLow = lowStockData.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.category_name && p.category_name.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
    );

    currentPageOut = 1;
    currentPageLow = 1;

    renderOutTable();
    renderLowTable();
}

// Pagination Controls
function prevPageOut() {
    if (currentPageOut > 1) {
        currentPageOut--;
        renderOutTable();
    }
}

function nextPageOut() {
    const totalPages = Math.ceil(currentFilteredOut.length / itemsPerPage);
    if (currentPageOut < totalPages) {
        currentPageOut++;
        renderOutTable();
    }
}

function prevPageLow() {
    if (currentPageLow > 1) {
        currentPageLow--;
        renderLowTable();
    }
}

function nextPageLow() {
    const totalPages = Math.ceil(currentFilteredLow.length / itemsPerPage);
    if (currentPageLow < totalPages) {
        currentPageLow++;
        renderLowTable();
    }
}

function firstPageOut() {
    if (currentPageOut !== 1) {
        currentPageOut = 1;
        renderOutTable();
    }
}

function lastPageOut() {
    const totalPages = Math.ceil(currentFilteredOut.length / itemsPerPage);
    if (currentPageOut !== totalPages && totalPages > 0) {
        currentPageOut = totalPages;
        renderOutTable();
    }
}

function firstPageLow() {
    if (currentPageLow !== 1) {
        currentPageLow = 1;
        renderLowTable();
    }
}

function lastPageLow() {
    const totalPages = Math.ceil(currentFilteredLow.length / itemsPerPage);
    if (currentPageLow !== totalPages && totalPages > 0) {
        currentPageLow = totalPages;
        renderLowTable();
    }
}

// Tabs Logic
function switchTab(tab) {
    const tabBtnOut = document.getElementById('tabBtnOut');
    const tabBtnLow = document.getElementById('tabBtnLow');
    const paneOut = document.getElementById('paneOut');
    const paneLow = document.getElementById('paneLow');

    if (tab === 'out') {
        paneOut.classList.remove('hidden');
        paneOut.classList.add('block');
        paneLow.classList.remove('block');
        paneLow.classList.add('hidden');

        tabBtnOut.classList.add('border-orange-500', 'text-orange-600', 'bg-orange-50');
        tabBtnOut.classList.remove('border-transparent', 'text-slate-500', 'hover:bg-slate-50');

        tabBtnLow.classList.remove('border-red-500', 'text-red-600', 'bg-red-50');
        tabBtnLow.classList.add('border-transparent', 'text-slate-500', 'hover:bg-slate-50');
    } else {
        paneLow.classList.remove('hidden');
        paneLow.classList.add('block');
        paneOut.classList.remove('block');
        paneOut.classList.add('hidden');

        tabBtnLow.classList.add('border-red-500', 'text-red-600', 'bg-red-50');
        tabBtnLow.classList.remove('border-transparent', 'text-slate-500', 'hover:bg-slate-50');

        tabBtnOut.classList.remove('border-orange-500', 'text-orange-600', 'bg-orange-50');
        tabBtnOut.classList.add('border-transparent', 'text-slate-500', 'hover:bg-slate-50');
    }
}

// Modal Logic
let html5QrcodeScanner = null;

function openScanModal() {
    document.getElementById('scanModal').classList.remove('hidden');
    document.getElementById('scanResult').textContent = '';

    // Initialize Scanner using HTML5 Qrcode
    html5QrcodeScanner = new Html5QrcodeScanner("reader", {
        fps: 15,
        qrbox: { width: 300, height: 150 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [0] // Restrict to camera only
    }, false);

    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeScanModal() {
    document.getElementById('scanModal').classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().then(() => {
            html5QrcodeScanner = null;
        }).catch(err => {
            html5QrcodeScanner = null;
        });
    }
}

async function onScanSuccess(decodedText, decodedResult) {
    // Stop scanning once we get a code
    closeScanModal();
    showToast(`Barcode Scanned: ${decodedText}`, 'info');

    // Check if product exists via API
    const res = await apiCall(`/products/${decodedText}`, 'GET');

    if (res.data && res.data.success) {
        editProduct(res.data.data.id);
        showToast('Product already added! You can update its details here.', 'success');
    } else {
        openProductModal();
        document.getElementById('barcode').value = decodedText;
        showToast('New product detected. Please add details.', 'info');
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode("hiddenReader");

    showToast('Scanning image...', 'info');
    try {
        const decodedText = await html5QrCode.scanFile(file, true);
        // Ensure successful scan closes the modal as camera would
        closeScanModal();
        onScanSuccess(decodedText, null);
    } catch (err) {
        showToast('Could not find barcode in image. Try another image.', 'error');
    }

    event.target.value = '';
}

function onScanFailure(error) {
    // silently handle
}

function openProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('barcode').value = '';
    document.getElementById('modalTitle').textContent = 'Add Product';
    document.getElementById('productModal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('productModal').classList.add('hidden');
}



async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const isEdit = id !== '';

    const payload = {
        name: document.getElementById('name').value,
        barcode: document.getElementById('barcode').value || null,
        category_id: document.getElementById('categoryId').value || null,
        price: parseFloat(document.getElementById('price').value),
        stock: parseInt(document.getElementById('stock').value),
        min_stock_level: parseInt(document.getElementById('minStockLevel').value)
    };

    const endpoint = isEdit ? `/products/${id}` : '/products';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiCall(endpoint, method, payload);

    if (res.data.success) {
        showToast(isEdit ? 'Product updated!' : 'Product added!', 'success');
        closeProductModal();
        loadProducts();
    } else {
        showToast(res.data.message || 'Error saving product', 'error');
    }
}

async function editProduct(id) {
    const p = allProducts.find(product => product.id === id);
    if (!p) return;

    document.getElementById('productId').value = p.id;
    document.getElementById('name').value = p.name;
    document.getElementById('barcode').value = p.barcode || '';
    document.getElementById('categoryId').value = p.category_id || '';
    document.getElementById('price').value = p.price;
    document.getElementById('stock').value = p.stock;
    document.getElementById('minStockLevel').value = p.min_stock_level;

    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productModal').classList.remove('hidden');
}

async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        const res = await apiCall(`/products/${id}`, 'DELETE');
        if (res.data.success) {
            showToast('Product deleted!', 'success');
            loadProducts();
        } else {
            showToast(res.data.message || 'Error deleting product', 'error');
        }
    }
}

async function quickUpdateStock(id) {
    const inputEle = document.getElementById(`updateStock_${id}`);
    const newStock = parseInt(inputEle.value);
    if (isNaN(newStock) || newStock < 0) {
        showToast('Please enter a valid stock amount', 'error');
        return;
    }
    const p = allProducts.find(product => product.id === id);
    if (!p) return;

    const payload = {
        name: p.name,
        barcode: p.barcode,
        category_id: p.category_id,
        price: p.price,
        stock: newStock,
        min_stock_level: p.min_stock_level
    };

    const res = await apiCall(`/products/${id}`, 'PUT', payload);
    if (res.data.success) {
        showToast('Stock updated successfully!', 'success');
        loadProducts();
    } else {
        showToast(res.data.message || 'Error updating stock', 'error');
    }
}
