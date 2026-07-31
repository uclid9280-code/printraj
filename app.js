/**
 * Aadhaar Operations & Request Tracking System
 * Complete Data Management Engine with IndexedDB & LocalStorage Persistence
 * Added: Operator & Retailer Delete functionality
 */

(function () {
    // --- Database & State Management ---
    const DB_NAME = 'AadhaarTrackerDB';
    const DB_VERSION = 1;
    let dbInstance = null;

    // Default Seed Data
const defaultOperators = [];

const defaultRetailers = [];

const defaultRecords = [];

    // Local State Cache
    let state = {
        records: [],
        operators: [],
        retailers: [],
        activeTab: 'dashboard',
        currentFilter: {
            status: 'ALL',
            operator: 'ALL',
            retailer: 'ALL',
            service: 'ALL',
            search: ''
        }
    };

    // --- IndexedDB Helper Methods ---
    function initDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not supported, falling back to LocalStorage');
                loadFromLocalStorage();
                resolve();
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('records')) {
                    db.createObjectStore('records', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('operators')) {
                    db.createObjectStore('operators', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('retailers')) {
                    db.createObjectStore('retailers', { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                loadAllDataFromDB().then(resolve);
            };

            request.onerror = (e) => {
                console.error('IndexedDB Error:', e);
                loadFromLocalStorage();
                resolve();
            };
        });
    }

    async function loadAllDataFromDB() {
        if (!dbInstance) return loadFromLocalStorage();

        try {
            const records = await getAllFromStore('records');
            const operators = await getAllFromStore('operators');
            const retailers = await getAllFromStore('retailers');

            if (operators.length === 0) {
                await saveArrayToStore('operators', defaultOperators);
                state.operators = defaultOperators;
            } else {
                state.operators = operators;
            }

            if (retailers.length === 0) {
                await saveArrayToStore('retailers', defaultRetailers);
                state.retailers = defaultRetailers;
            } else {
                state.retailers = retailers;
            }

            if (records.length === 0) {
                await saveArrayToStore('records', defaultRecords);
                state.records = defaultRecords;
            } else {
                state.records = records;
            }

            syncToLocalStorageBackup();
        } catch (err) {
            console.error('Error loading DB:', err);
            loadFromLocalStorage();
        }
    }

    function getAllFromStore(storeName) {
        return new Promise((resolve) => {
            const tx = dbInstance.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    function saveArrayToStore(storeName, items) {
        return new Promise((resolve) => {
            const tx = dbInstance.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
        });
    }

    function saveItemToStore(storeName, item) {
        return new Promise((resolve) => {
            if (dbInstance) {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                store.put(item);
                tx.oncomplete = () => {
                    syncToLocalStorageBackup();
                    resolve();
                };
            } else {
                syncToLocalStorageBackup();
                resolve();
            }
        });
    }

    function removeItemFromStore(storeName, id) {
        return new Promise((resolve) => {
            if (dbInstance) {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                store.delete(id);
                tx.oncomplete = () => {
                    syncToLocalStorageBackup();
                    resolve();
                };
            } else {
                syncToLocalStorageBackup();
                resolve();
            }
        });
    }

    function syncToLocalStorageBackup() {
        localStorage.setItem('aadhaar_records', JSON.stringify(state.records));
        localStorage.setItem('aadhaar_operators', JSON.stringify(state.operators));
        localStorage.setItem('aadhaar_retailers', JSON.stringify(state.retailers));
        localStorage.setItem('aadhaar_last_sync', new Date().toISOString());

        const syncElem = document.getElementById('lastSyncTime');
        if (syncElem) {
            syncElem.textContent = 'Saved at ' + new Date().toLocaleTimeString();
        }
    }

    function loadFromLocalStorage() {
        state.records = JSON.parse(localStorage.getItem('aadhaar_records')) || defaultRecords;
        state.operators = JSON.parse(localStorage.getItem('aadhaar_operators')) || defaultOperators;
        state.retailers = JSON.parse(localStorage.getItem('aadhaar_retailers')) || defaultRetailers;
    }

    // --- DOM Elements & Selectors ---
    const navItems = document.querySelectorAll('.nav-item, .mobile-nav-btn');
    const tabViews = document.querySelectorAll('.tab-view');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const globalSearchInput = document.getElementById('globalSearchInput');

    // Stats Elements
    const statTotal = document.getElementById('statTotal');
    const statPending = document.getElementById('statPending');
    const statSuccess = document.getElementById('statSuccess');
    const statRejected = document.getElementById('statRejected');

    // Tables
    const dashboardTableBody = document.getElementById('dashboardTableBody');
    const mainTableBody = document.getElementById('mainTableBody');

    // Filter Controls
    const filterStatus = document.getElementById('filterStatus');
    const filterOperator = document.getElementById('filterOperator');
    const filterRetailer = document.getElementById('filterRetailer');
    const filterService = document.getElementById('filterService');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    // Modals & Buttons
    const entryModal = document.getElementById('entryModal');
    const entryForm = document.getElementById('entryForm');
    const quickAddBtn = document.getElementById('quickAddBtn');
    const headerAddBtn = document.getElementById('headerAddBtn');
    const dashboardAddBtn = document.getElementById('dashboardAddBtn');
    const mobileAddFab = document.getElementById('mobileAddFab');
    const closeEntryModal = document.getElementById('closeEntryModal');
    const cancelEntryModal = document.getElementById('cancelEntryModal');

    // Status Modal
    const statusModal = document.getElementById('statusModal');
    const statusForm = document.getElementById('statusForm');
    const closeStatusModal = document.getElementById('closeStatusModal');

    // Person Modal (Retailer/Operator)
    const personModal = document.getElementById('personModal');
    const personForm = document.getElementById('personForm');
    const closePersonModal = document.getElementById('closePersonModal');
    const addOperatorBtn = document.getElementById('addOperatorBtn');
    const addRetailerBtn = document.getElementById('addRetailerBtn');

    // Backup & Receipt
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const downloadBackupBtn = document.getElementById('downloadBackupBtn');
    const importBackupBtn = document.getElementById('importBackupBtn');
    const importFileInput = document.getElementById('importFileInput');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const receiptModal = document.getElementById('receiptModal');
    const closeReceiptModal = document.getElementById('closeReceiptModal');
    const closeReceiptBtn = document.getElementById('closeReceiptBtn');
    const doPrintBtn = document.getElementById('doPrintBtn');

    // --- App Initializer ---
    async function initApp() {
        await initDatabase();
        setupEventListeners();
        populateDropdowns();
        renderAll();
        updateDateBadge();
    }

    function updateDateBadge() {
        const badge = document.getElementById('currentDateBadge');
        if (badge) {
            const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
            badge.textContent = new Date().toLocaleDateString('hi-IN', options);
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Tab Navigation
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tab = item.getAttribute('data-tab');
                if (tab) switchTab(tab);
            });
        });

        // Theme Toggle
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('aadhaar_theme', newTheme);
        });

        // Load Saved Theme
        const savedTheme = localStorage.getItem('aadhaar_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Search Input
        globalSearchInput.addEventListener('input', (e) => {
            state.currentFilter.search = e.target.value.toLowerCase();
            renderAll();
        });

        // Filter Selects
        filterStatus.addEventListener('change', (e) => { state.currentFilter.status = e.target.value; renderMainTable(); });
        filterOperator.addEventListener('change', (e) => { state.currentFilter.operator = e.target.value; renderMainTable(); });
        filterRetailer.addEventListener('change', (e) => { state.currentFilter.retailer = e.target.value; renderMainTable(); });
        filterService.addEventListener('change', (e) => { state.currentFilter.service = e.target.value; renderMainTable(); });

        resetFiltersBtn.addEventListener('click', () => {
            filterStatus.value = 'ALL';
            filterOperator.value = 'ALL';
            filterRetailer.value = 'ALL';
            filterService.value = 'ALL';
            globalSearchInput.value = '';
            state.currentFilter = { status: 'ALL', operator: 'ALL', retailer: 'ALL', service: 'ALL', search: '' };
            renderAll();
        });

        // Quick Pending Filter on Dashboard
        const btnFilterPending = document.getElementById('btnFilterPending');
        if (btnFilterPending) {
            btnFilterPending.addEventListener('click', () => {
                filterStatus.value = 'PENDING';
                state.currentFilter.status = 'PENDING';
                switchTab('records');
            });
        }

        // Add Modal Open Buttons
        [quickAddBtn, headerAddBtn, dashboardAddBtn, mobileAddFab].forEach(btn => {
            if (btn) btn.addEventListener('click', () => openEntryModal());
        });

        // Modal Close Actions
        closeEntryModal.addEventListener('click', () => hideModal(entryModal));
        cancelEntryModal.addEventListener('click', () => hideModal(entryModal));
        closeStatusModal.addEventListener('click', () => hideModal(statusModal));
        document.getElementById('cancelStatusModal').addEventListener('click', () => hideModal(statusModal));
        closePersonModal.addEventListener('click', () => hideModal(personModal));
        document.getElementById('cancelPersonModal').addEventListener('click', () => hideModal(personModal));
        closeReceiptModal.addEventListener('click', () => hideModal(receiptModal));
        closeReceiptBtn.addEventListener('click', () => hideModal(receiptModal));

        // Form Submissions
        entryForm.addEventListener('submit', handleEntryFormSubmit);
        statusForm.addEventListener('submit', handleStatusFormSubmit);
        personForm.addEventListener('submit', handlePersonFormSubmit);

        // Status Select Change in Entry Form for Reject Reason toggle
        const entryStatus = document.getElementById('entryStatus');
        const rejectReasonGroup = document.getElementById('rejectReasonGroup');
        entryStatus.addEventListener('change', (e) => {
            rejectReasonGroup.style.display = e.target.value === 'REJECTED' ? 'block' : 'none';
        });

        const updateStatusSelect = document.getElementById('updateStatusSelect');
        const updateReasonGroup = document.getElementById('updateReasonGroup');
        updateStatusSelect.addEventListener('change', (e) => {
            updateReasonGroup.style.display = e.target.value === 'REJECTED' ? 'block' : 'none';
        });

        // Add Person Modals
        addOperatorBtn.addEventListener('click', () => openPersonModal('OPERATOR'));
        addRetailerBtn.addEventListener('click', () => openPersonModal('RETAILER'));

        // Backup & Restore
        downloadBackupBtn.addEventListener('click', exportFullBackupJSON);
        exportCsvBtn.addEventListener('click', exportRecordsCSV);
        importBackupBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', handleImportJSON);
        clearDataBtn.addEventListener('click', handleClearData);
        doPrintBtn.addEventListener('click', () => window.print());
    }

    // --- Tab Switcher ---
    function switchTab(tabId) {
        state.activeTab = tabId;
        navItems.forEach(item => {
            const itemTab = item.getAttribute('data-tab');
            item.classList.toggle('active', itemTab === tabId);
        });
        tabViews.forEach(view => {
            view.classList.toggle('active', view.id === `view-${tabId}`);
        });
        renderAll();
    }

    // --- Render Engine ---
    function renderAll() {
        populateDropdowns();
        renderStats();
        renderDashboardTable();
        renderMainTable();
        renderOperatorsGrid();
        renderRetailersGrid();
    }

    function populateDropdowns() {
        const entryRetailer = document.getElementById('entryRetailer');
        const entryOperator = document.getElementById('entryOperator');
        const updateOperatorSelect = document.getElementById('updateOperatorSelect');

        // Populate Retailer Options
        const retOptions = state.retailers.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        entryRetailer.innerHTML = retOptions || '<option value="">No Retailers</option>';

        const filterRetOpts = '<option value="ALL">Sabhi Retailers</option>' + state.retailers.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        filterRetailer.innerHTML = filterRetOpts;

        // Populate Operator Options
        const opOptions = state.operators.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        entryOperator.innerHTML = opOptions || '<option value="">No Operators</option>';
        updateOperatorSelect.innerHTML = opOptions;

        const filterOpOpts = '<option value="ALL">Sabhi Operators</option>' + state.operators.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
        filterOperator.innerHTML = filterOpOpts;
    }

    function renderStats() {
        const total = state.records.length;
        const pending = state.records.filter(r => r.status === 'PENDING').length;
        const success = state.records.filter(r => r.status === 'SUCCESS').length;
        const rejected = state.records.filter(r => r.status === 'REJECTED').length;

        statTotal.textContent = total;
        statPending.textContent = pending;
        statSuccess.textContent = success;
        statRejected.textContent = rejected;
    }

    function filterRecords(records) {
        const { status, operator, retailer, service, search } = state.currentFilter;
        return records.filter(r => {
            if (status !== 'ALL' && r.status !== status) return false;
            if (operator !== 'ALL' && r.operatorId !== operator) return false;
            if (retailer !== 'ALL' && r.retailerId !== retailer) return false;
            if (service !== 'ALL' && r.serviceType !== service) return false;

            if (search) {
                const opName = getOperatorName(r.operatorId).toLowerCase();
                const retName = getRetailerName(r.retailerId).toLowerCase();
                const searchStr = `${r.custName} ${r.custMobile} ${r.aadhaarNumber} ${r.id} ${opName} ${retName} ${r.serviceType}`.toLowerCase();
                if (!searchStr.includes(search)) return false;
            }
            return true;
        });
    }

    function renderDashboardTable() {
        const filtered = filterRecords(state.records).slice(0, 7); // Latest 7
        dashboardTableBody.innerHTML = filtered.length ? filtered.map(r => createTableRowHTML(r)).join('') : `
            <tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-muted);">Koyi record nahi mila</td></tr>
        `;
    }

    function renderMainTable() {
        const filtered = filterRecords(state.records);
        mainTableBody.innerHTML = filtered.length ? filtered.map((r, idx) => createTableRowHTML(r, idx + 1)).join('') : `
            <tr><td colspan="11" style="text-align:center; padding: 32px; color: var(--text-muted);">Koyi record nahi mila. Filters reset karein ya nayi entry add karein.</td></tr>
        `;
    }

    function createTableRowHTML(record, index) {
        const opName = getOperatorName(record.operatorId);
        const retName = getRetailerName(record.retailerId);
        const statusBadge = getStatusBadgeHTML(record.status, record.rejectReason);
        const formattedDate = new Date(record.timestamp).toLocaleString('hi-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        const identityCells = index
            ? `<td><strong>#${index}</strong></td>
                <td><small class="text-muted">${formattedDate}</small></td>
                <td><strong>${escapeHTML(record.custName)}</strong></td>
                <td>📞 ${escapeHTML(record.custMobile)}</td>`
            : `<td><small class="text-muted">${formattedDate}</small></td>
                <td>
                    <strong>${escapeHTML(record.custName)}</strong><br>
                    <small class="text-muted">📞 ${escapeHTML(record.custMobile)}</small>
                </td>`;

        return `
            <tr>
                ${identityCells}
                <td><code>${escapeHTML(record.aadhaarNumber || 'N/A')}</code></td>
                <td><span class="person-tag">${escapeHTML(record.serviceType)}</span></td>
                <td><span class="person-tag">🏪 ${escapeHTML(retName)}</span></td>
                <td><span class="person-tag">👤 ${escapeHTML(opName)}</span></td>
                ${index ? `<td>${getPaymentBadgeHTML(record)}</td>` : ''}
                <td>${statusBadge}</td>
                <td>
                    <div class="action-btns">
                        <button class="icon-action" onclick="app.openStatusModal('${record.id}')" title="Change Status">
                            ⚡
                        </button>
                        <button class="icon-action" onclick="app.openReceiptModal('${record.id}')" title="Print Slip Receipt">
                            🖨️
                        </button>
                        <button class="icon-action" onclick="app.editRecord('${record.id}')" title="Edit Entry">
                            ✏️
                        </button>
                        <button class="icon-action" onclick="app.togglePayment('${record.id}')" title="Payment Paid / Unpaid">
                            💰
                        </button>
                        <button class="icon-action" onclick="app.deleteRecord('${record.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function getStatusBadgeHTML(status, reason) {
        if (status === 'PENDING') {
            return `<span class="status-badge pending">⏳ Pending</span>`;
        } else if (status === 'SUCCESS') {
            return `<span class="status-badge success">✅ Success</span>`;
        } else if (status === 'REJECTED') {
            return `<span class="status-badge rejected" title="${escapeHTML(reason || '')}">❌ Rejected ${reason ? `(${escapeHTML(reason)})` : ''}</span>`;
        }
        return status;
    }

    function getRecordAmount(record) {
        const amount = Number(record.amount);
        return isNaN(amount) ? 0 : amount;
    }

    function formatAmount(amount) {
        return '₹' + Number(amount || 0).toLocaleString('hi-IN');
    }

    function getPaymentBadgeHTML(record) {
        const amount = getRecordAmount(record);
        if (!amount) return '<span class="text-muted">—</span>';
        const isPaid = record.paymentStatus === 'PAID';
        return `<strong>${formatAmount(amount)}</strong><br>
            <span class="status-badge ${isPaid ? 'success' : 'pending'}">${isPaid ? '✅ Paid' : '⏳ Unpaid'}</span>`;
    }

    function renderOperatorsGrid() {
        const grid = document.getElementById('operatorsGrid');
        grid.innerHTML = state.operators.map(op => {
            const opRecords = state.records.filter(r => r.operatorId === op.id);
            const successCount = opRecords.filter(r => r.status === 'SUCCESS').length;
            const totalAmount = opRecords.reduce((sum, r) => sum + getRecordAmount(r), 0);
            const paidAmount = opRecords.filter(r => r.paymentStatus === 'PAID').reduce((sum, r) => sum + getRecordAmount(r), 0);
            const dueAmount = totalAmount - paidAmount;

            return `
                <div class="person-card">
                    <div class="person-header">
                        <div class="avatar">${op.name.charAt(0)}</div>
                        <div>
                            <h4>${escapeHTML(op.name)}</h4>
                            <small class="text-muted">📞 ${escapeHTML(op.phone || 'N/A')} | 📍 ${escapeHTML(op.location || 'N/A')}</small>
                        </div>
                    </div>
                    <div class="person-stats">
                        <div class="p-stat">
                            <span>Total Slips</span>
                            <h4>${opRecords.length}</h4>
                        </div>
                        <div class="p-stat">
                            <span>Success Slips</span>
                            <h4 class="success-text">${successCount}</h4>
                        </div>
                        <div class="p-stat">
                            <span>Total Payment</span>
                            <h4>${formatAmount(totalAmount)}</h4>
                        </div>
                        <div class="p-stat">
                            <span>Paid</span>
                            <h4 class="success-text">${formatAmount(paidAmount)}</h4>
                        </div>
                        <div class="p-stat">
                            <span>Baaki (Due)</span>
                            <h4 class="danger-text">${formatAmount(dueAmount)}</h4>
                        </div>
                    </div>
                    <div style="margin-top: 14px; text-align: right;">
                        <button class="btn btn-danger-outline btn-sm" onclick="app.deleteOperator('${op.id}')">
                            🗑️ Delete Operator
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderRetailersGrid() {
        const grid = document.getElementById('retailersGrid');
        grid.innerHTML = state.retailers.map(ret => {
            const retRecords = state.records.filter(r => r.retailerId === ret.id);
            const successCount = retRecords.filter(r => r.status === 'SUCCESS').length;

            return `
                <div class="person-card">
                    <div class="person-header">
                        <div class="avatar" style="background: rgba(16, 185, 129, 0.2); color: var(--success);">${ret.name.charAt(0)}</div>
                        <div>
                            <h4>${escapeHTML(ret.name)}</h4>
                            <small class="text-muted">📞 ${escapeHTML(ret.phone || 'N/A')} | 🏬 ${escapeHTML(ret.location || 'N/A')}</small>
                        </div>
                    </div>
                    <div class="person-stats">
                        <div class="p-stat">
                            <span>Sent Requests</span>
                            <h4>${retRecords.length}</h4>
                        </div>
                        <div class="p-stat">
                            <span>Completed</span>
                            <h4 class="success-text">${successCount}</h4>
                        </div>
                    </div>
                    <div style="margin-top: 14px; text-align: right;">
                        <button class="btn btn-danger-outline btn-sm" onclick="app.deleteRetailer('${ret.id}')">
                            🗑️ Delete Retailer
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- Helpers ---
    function getOperatorName(id) {
        const op = state.operators.find(o => o.id === id);
        return op ? op.name : 'Unknown Operator';
    }

    function getRetailerName(id) {
        const ret = state.retailers.find(r => r.id === id);
        return ret ? ret.name : 'Unknown Retailer';
    }

    function showModal(modalElem) {
        modalElem.classList.add('active');
    }

    function hideModal(modalElem) {
        modalElem.classList.remove('active');
    }

    function escapeHTML(str) {
        return (str || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // --- Form Handlers ---
    function openEntryModal(editRecord = null) {
        const modalTitle = document.getElementById('modalTitle');
        const entryId = document.getElementById('entryId');
        const custName = document.getElementById('custName');
        const custMobile = document.getElementById('custMobile');
        const serviceType = document.getElementById('serviceType');
        const aadhaarNumber = document.getElementById('aadhaarNumber');
        const entryRetailer = document.getElementById('entryRetailer');
        const entryOperator = document.getElementById('entryOperator');
        const entryStatus = document.getElementById('entryStatus');
        const rejectReason = document.getElementById('rejectReason');
        const rejectReasonGroup = document.getElementById('rejectReasonGroup');
        const entryNotes = document.getElementById('entryNotes');
        const entryAmount = document.getElementById('entryAmount');
        const entryPaymentStatus = document.getElementById('entryPaymentStatus');

        if (editRecord) {
            modalTitle.textContent = 'Aadhaar Record Edit Karein';
            entryId.value = editRecord.id;
            custName.value = editRecord.custName;
            custMobile.value = editRecord.custMobile;
            serviceType.value = editRecord.serviceType;
            aadhaarNumber.value = editRecord.aadhaarNumber;
            entryRetailer.value = editRecord.retailerId;
            entryOperator.value = editRecord.operatorId;
            entryStatus.value = editRecord.status;
            rejectReason.value = editRecord.rejectReason || '';
            rejectReasonGroup.style.display = editRecord.status === 'REJECTED' ? 'block' : 'none';
            entryNotes.value = editRecord.notes || '';
            entryAmount.value = getRecordAmount(editRecord) || '';
            entryPaymentStatus.value = editRecord.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';
        } else {
            modalTitle.textContent = 'Nayi Aadhaar Entry / Slip Request Add Karein';
            entryForm.reset();
            entryId.value = '';
            rejectReasonGroup.style.display = 'none';
        }

        showModal(entryModal);
    }

    async function handleEntryFormSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('entryId').value || 'AAD-' + Math.floor(1000 + Math.random() * 9000);
        const custName = document.getElementById('custName').value.trim();
        const custMobile = document.getElementById('custMobile').value.trim();
        const serviceType = document.getElementById('serviceType').value;
        const aadhaarNumber = document.getElementById('aadhaarNumber').value.trim();
        const retailerId = document.getElementById('entryRetailer').value;
        const operatorId = document.getElementById('entryOperator').value;
        const status = document.getElementById('entryStatus').value;
        const rejectReason = document.getElementById('rejectReason').value.trim();
        const notes = document.getElementById('entryNotes').value.trim();
        const amount = Number(document.getElementById('entryAmount').value) || 0;
        const paymentStatus = document.getElementById('entryPaymentStatus').value;

        const recordObj = {
            id,
            custName,
            custMobile,
            serviceType,
            aadhaarNumber,
            retailerId,
            operatorId,
            status,
            rejectReason: status === 'REJECTED' ? rejectReason : '',
            notes,
            amount,
            paymentStatus,
            timestamp: new Date().toISOString()
        };

        const existingIndex = state.records.findIndex(r => r.id === id);
        if (existingIndex >= 0) {
            state.records[existingIndex] = recordObj;
        } else {
            state.records.unshift(recordObj);
        }

        await saveItemToStore('records', recordObj);
        hideModal(entryModal);
        renderAll();
    }

    function openStatusModal(recordId) {
        const record = state.records.find(r => r.id === recordId);
        if (!record) return;

        document.getElementById('statusRecordId').value = record.id;
        document.getElementById('updateStatusSelect').value = record.status;
        document.getElementById('updateOperatorSelect').value = record.operatorId;
        document.getElementById('updateReasonInput').value = record.rejectReason || '';
        document.getElementById('updateAmountInput').value = getRecordAmount(record) || '';
        document.getElementById('updatePaymentSelect').value = record.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';

        const summaryBox = document.getElementById('statusSummaryBox');
        summaryBox.innerHTML = `
            <strong>${escapeHTML(record.custName)}</strong> (📞 ${record.custMobile})<br>
            <small>Aadhaar/EID: ${escapeHTML(record.aadhaarNumber || 'N/A')} | Service: ${record.serviceType}</small>
        `;

        document.getElementById('updateReasonGroup').style.display = record.status === 'REJECTED' ? 'block' : 'none';
        showModal(statusModal);
    }

    async function handleStatusFormSubmit(e) {
        e.preventDefault();
        const recordId = document.getElementById('statusRecordId').value;
        const newStatus = document.getElementById('updateStatusSelect').value;
        const newOperator = document.getElementById('updateOperatorSelect').value;
        const newReason = document.getElementById('updateReasonInput').value.trim();
        const newAmount = Number(document.getElementById('updateAmountInput').value) || 0;
        const newPaymentStatus = document.getElementById('updatePaymentSelect').value;

        const record = state.records.find(r => r.id === recordId);
        if (record) {
            record.status = newStatus;
            record.operatorId = newOperator;
            record.rejectReason = newStatus === 'REJECTED' ? newReason : '';
            record.amount = newAmount;
            record.paymentStatus = newPaymentStatus;
            await saveItemToStore('records', record);
        }

        hideModal(statusModal);
        renderAll();
    }

    function openPersonModal(type) {
        document.getElementById('personType').value = type;
        document.getElementById('personModalTitle').textContent = type === 'OPERATOR' ? 'Naya Operator Add Karein' : 'Naya Retailer Add Karein';
        personForm.reset();
        showModal(personModal);
    }

    async function handlePersonFormSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('personType').value;
        const name = document.getElementById('personName').value.trim();
        const phone = document.getElementById('personPhone').value.trim();
        const location = document.getElementById('personLocation').value.trim();

        const personObj = {
            id: (type === 'OPERATOR' ? 'op_' : 'ret_') + Date.now(),
            name,
            phone,
            location
        };

        if (type === 'OPERATOR') {
            state.operators.push(personObj);
            await saveItemToStore('operators', personObj);
        } else {
            state.retailers.push(personObj);
            await saveItemToStore('retailers', personObj);
        }

        hideModal(personModal);
        renderAll();
    }

    function openReceiptModal(recordId) {
        const record = state.records.find(r => r.id === recordId);
        if (!record) return;

        const opName = getOperatorName(record.operatorId);
        const retName = getRetailerName(record.retailerId);
        const formattedDate = new Date(record.timestamp).toLocaleString('hi-IN');

        document.getElementById('receiptPrintDate').textContent = formattedDate;
        document.getElementById('receiptContent').innerHTML = `
            <div class="receipt-row"><span>Token ID:</span><strong>${record.id}</strong></div>
            <div class="receipt-row"><span>Customer Name:</span><strong>${escapeHTML(record.custName)}</strong></div>
            <div class="receipt-row"><span>Mobile No:</span><strong>${record.custMobile}</strong></div>
            <div class="receipt-row"><span>Aadhaar/EID:</span><strong>${escapeHTML(record.aadhaarNumber || 'N/A')}</strong></div>
            <div class="receipt-row"><span>Service Type:</span><strong>${record.serviceType}</strong></div>
            <div class="receipt-row"><span>Retailer Name:</span><strong>${escapeHTML(retName)}</strong></div>
            <div class="receipt-row"><span>Operator Name:</span><strong>${escapeHTML(opName)}</strong></div>
            <div class="receipt-row"><span>Current Status:</span><strong>${record.status} ${record.rejectReason ? `(${record.rejectReason})` : ''}</strong></div>
            <div class="receipt-row"><span>Payment Amount:</span><strong>${formatAmount(getRecordAmount(record))} (${record.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'})</strong></div>
        `;

        showModal(receiptModal);
    }

    async function togglePayment(recordId) {
        const record = state.records.find(r => r.id === recordId);
        if (!record) return;

        if (!getRecordAmount(record)) {
            const input = prompt('Operator ko kitna payment dena h? (₹ amount daalein)', '');
            if (input === null) return;
            const amount = Number(input);
            if (!amount || amount < 0) return alert('Sahi amount daalein.');
            record.amount = amount;
            record.paymentStatus = 'UNPAID';
        } else {
            record.paymentStatus = record.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
        }

        await saveItemToStore('records', record);
        renderAll();
    }

    async function deleteRecord(recordId) {
        if (confirm('Kya aap sach me iss record ko delete karna chahte hain?')) {
            state.records = state.records.filter(r => r.id !== recordId);
            await removeItemFromStore('records', recordId);
            renderAll();
        }
    }

    async function deleteOperator(opId) {
        if (confirm('Kya aap iss Operator ko delete karna chahte hain?')) {
            state.operators = state.operators.filter(o => o.id !== opId);
            await removeItemFromStore('operators', opId);
            renderAll();
        }
    }

    async function deleteRetailer(retId) {
        if (confirm('Kya aap iss Retailer ko delete karna chahte hain?')) {
            state.retailers = state.retailers.filter(r => r.id !== retId);
            await removeItemFromStore('retailers', retId);
            renderAll();
        }
    }

    // --- Export / Import Backup ---
    function exportFullBackupJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `Aadhaar_Tracker_Backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    function exportRecordsCSV() {
        if (!state.records.length) return alert('Export karne ke liye koyi record nahi h.');

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Date,Customer Name,Mobile,Aadhaar/EID,Service,Retailer,Operator,Status,Reject Reason,Payment Amount,Payment Status,Notes\n";

        state.records.forEach(r => {
            const opName = getOperatorName(r.operatorId).replace(/,/g, '');
            const retName = getRetailerName(r.retailerId).replace(/,/g, '');
            const row = [
                r.id,
                new Date(r.timestamp).toLocaleString(),
                `"${r.custName}"`,
                r.custMobile,
                `"${r.aadhaarNumber || ''}"`,
                `"${r.serviceType}"`,
                `"${retName}"`,
                `"${opName}"`,
                r.status,
                `"${r.rejectReason || ''}"`,
                getRecordAmount(r),
                r.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
                `"${r.notes || ''}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Aadhaar_Records_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function handleImportJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported.records && Array.isArray(imported.records)) {
                    state.records = imported.records;
                    state.operators = imported.operators || defaultOperators;
                    state.retailers = imported.retailers || defaultRetailers;

                    await saveArrayToStore('records', state.records);
                    await saveArrayToStore('operators', state.operators);
                    await saveArrayToStore('retailers', state.retailers);

                    alert('Backup successfully restore ho gaya!');
                    renderAll();
                } else {
                    alert('Invalid Backup File Format');
                }
            } catch (err) {
                alert('File read error: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    async function handleClearData() {
        if (confirm('DHYAN DEIN: Saara local data delete ho jayega. Kya aap aage badhna chahte hain?')) {
            state.records = [];
            if (dbInstance) {
                const tx = dbInstance.transaction(['records'], 'readwrite');
                tx.objectStore('records').clear();
            }
            localStorage.removeItem('aadhaar_records');
            renderAll();
            alert('Saara data clear kar diya gaya hai.');
        }
    }

    // Export methods to Global scope for onclick handlers
    window.app = {
        openStatusModal,
        openReceiptModal,
        editRecord: (id) => openEntryModal(state.records.find(r => r.id === id)),
        deleteRecord,
        togglePayment,
        deleteOperator,
        deleteRetailer
    };

    // Initialize when DOM Ready
    document.addEventListener('DOMContentLoaded', initApp);
})();
