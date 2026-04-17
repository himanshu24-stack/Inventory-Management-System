let allProducts = [];
let allCategories = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentFilteredProducts = [];

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

async function loadProducts() {
    const res = await apiCall('/products', 'GET');
    if (res.data.success) {
        allProducts = res.data.data;

        // Handle URL parameters for Dashboard redirects
        const urlParams = new URLSearchParams(window.location.search);
        let filterStr = urlParams.get('filter') || sessionStorage.getItem('inventoryFilter');
        let categoryStr = urlParams.get('category');
        sessionStorage.removeItem('inventoryFilter');

        if (filterStr === 'low-stock') {
            const filtered = allProducts.filter(p => Number(p.stock) <= Number(p.min_stock_level) && Number(p.stock) > 0);
            renderProducts(filtered);
            showToast('Showing Low Stock items', 'info');
        } else if (filterStr === 'out-of-stock') {
            const filtered = allProducts.filter(p => Number(p.stock) === 0);
            renderProducts(filtered);
            showToast('Showing Out of Stock items', 'info');
        } else if (categoryStr) {
            const decodedCat = decodeURIComponent(categoryStr);
            const filtered = allProducts.filter(p => p.category_name === decodedCat);
            renderProducts(filtered);
            showToast(`Showing items in ${decodedCat}`, 'info');
            // Auto fill search bar as well so user knows it's filtered
            document.getElementById('searchInput').value = decodedCat;
        } else {
            renderProducts(allProducts);
        }
    } else {
        showToast('Failed to load products', 'error');
    }
}

function renderProducts(products) {
    if (products) {
        currentFilteredProducts = products;
    }

    const totalItems = currentFilteredProducts.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = currentFilteredProducts.slice(startIndex, endIndex);

    const tbody = document.getElementById('productsBody');
    tbody.innerHTML = '';

    const selectAllProductsEl = document.getElementById('selectAllProducts');
    if (selectAllProductsEl) {
        selectAllProductsEl.checked = false;
    }
    updateSelectedCount();

    // Update pagination UI
    const pageStartEl = document.getElementById('pageStart');
    const pageEndEl = document.getElementById('pageEnd');
    const totalItemsEl = document.getElementById('totalItems');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    const firstBtn = document.getElementById('firstPageBtn');
    const lastBtn = document.getElementById('lastPageBtn');

    if (pageStartEl) {
        pageStartEl.textContent = totalItems === 0 ? 0 : startIndex + 1;
        pageEndEl.textContent = endIndex;
        totalItemsEl.textContent = totalItems;
        prevBtn.disabled = currentPage === 1 || totalItems === 0;
        nextBtn.disabled = currentPage === totalPages || totalItems === 0;

        if (firstBtn) firstBtn.disabled = currentPage === 1 || totalItems === 0;
        if (lastBtn) lastBtn.disabled = currentPage === totalPages || totalItems === 0;
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
                <input type="checkbox" value="${p.id}" class="product-checkbox w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" onchange="updateSelectedCount()">
            </td>
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
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <button onclick="editProduct(${p.id})" class="text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors p-1" title="Edit">
                    <i class="ph ph-pencil-simple text-lg"></i>
                </button>
                <button onclick="deleteProduct(${p.id})" class="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 ml-1" title="Delete">
                    <i class="ph ph-trash text-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterProducts(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.category_name && p.category_name.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
    );
    currentPage = 1;
    renderProducts(filtered);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderProducts();
    }
}

function nextPage() {
    const totalPages = Math.ceil(currentFilteredProducts.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderProducts();
    }
}

function firstPage() {
    if (currentPage !== 1) {
        currentPage = 1;
        renderProducts();
    }
}

function lastPage() {
    const totalPages = Math.ceil(currentFilteredProducts.length / itemsPerPage);
    if (currentPage !== totalPages && totalPages > 0) {
        currentPage = totalPages;
        renderProducts();
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

    // Set default threshold from settings
    const defaultThreshold = localStorage.getItem('defaultLowStockThreshold') || '5';
    document.getElementById('minStockLevel').value = defaultThreshold;

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

function toggleSelectAllProducts() {
    const selectAllCheckbox = document.getElementById('selectAllProducts');
    const checkboxes = document.querySelectorAll('.product-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    const dBtn = document.getElementById('deleteSelectedBtn');
    if (dBtn) {
        if (checkboxes.length > 0) {
            dBtn.classList.remove('hidden');
        } else {
            dBtn.classList.add('hidden');
        }
    }
}

async function deleteSelectedProducts() {
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (confirm(`Are you sure you want to delete ${checkboxes.length} products?`)) {
        let successCount = 0;
        let failCount = 0;

        for (const cb of Array.from(checkboxes)) {
            const res = await apiCall(`/products/${cb.value}`, 'DELETE');
            if (res.data.success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        if (successCount > 0) {
            showToast(`${successCount} product(s) deleted successfully.`, 'success');
        }
        if (failCount > 0) {
            showToast(`${failCount} product(s) failed to delete.`, 'error');
        }

        loadProducts();
        const selectAllCheckbox = document.getElementById('selectAllProducts');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        updateSelectedCount();
    }
}

async function exportProducts() {
    try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        showToast('Processing export...', 'info');

        const response = await fetch(`${API_BASE}/products/export`, {
            method: 'GET',
            headers
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'inventory_products.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showToast('Export successful!', 'success');
        } else {
            showToast('Export failed', 'error');
        }
    } catch (error) {
        showToast('Export error', 'error');
    }
}

async function importProducts(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        showToast('Processing import...', 'info');

        const response = await fetch(`${API_BASE}/products/import`, {
            method: 'POST',
            headers,
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            showToast(data.message || 'Import successful!', 'success');
            loadProducts();
            loadCategories();
        } else {
            showToast(data.message || 'Import failed', 'error');
        }
    } catch (error) {
        showToast('Import error', 'error');
    } finally {
        event.target.value = ''; // Reset file input
    }
}
