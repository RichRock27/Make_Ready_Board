// Data Storage
let appData = {
    moveOuts: [],
    vacancies: [],
    inspections: [],
    workOrders: [],
    ticklers: [],
    masterList: []
};

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');

            const view = el.dataset.view;
            switchView(view);
        });
    });

    // Filters
    document.getElementById('filter-property').addEventListener('change', renderDashboard);
    document.getElementById('filter-ready').addEventListener('change', renderDashboard);
    document.getElementById('filter-inspection').addEventListener('change', renderDashboard);
    document.getElementById('search-input').addEventListener('input', renderDashboard);
}

function switchView(viewName) {
    const mainTitle = document.querySelector('header h1');
    const contentPanel = document.querySelector('.content-panel');
    const statsGrid = document.querySelector('.stats-grid');

    if (viewName === 'dashboard') {
        mainTitle.innerText = 'Make Ready Overview';
        statsGrid.style.display = 'grid';
        document.querySelector('.panel-header .actions').style.display = 'flex';
        renderDashboard();
    } else if (viewName === 'reports') {
        mainTitle.innerText = 'Generated Reports';
        statsGrid.style.display = 'none';
        document.querySelector('.panel-header .actions').style.display = 'none';
        renderReports();
    }
}

function loadData() {
    // Show loading state if possible
    const subTitle = document.querySelector('header p');
    if (subTitle) subTitle.innerText = "Loading data from Gmail...";

    google.script.run
        .withSuccessHandler(onDataLoaded)
        .withFailureHandler(onDataLoadError)
        .getData();
}

function onDataLoaded(response) {
    if (response.status !== 'success') {
        console.error("Server Error:", response.message);
        alert("Server reported an error: " + response.message);
        return;
    }

    const data = response.data;
    console.log("Data loaded successfully", data);

    if (data.debug) {
        console.log("Server Debug Logs:", data.debug.join('\n'));
    }

    // Map server data to appData structure
    appData.moveOuts = data.moveOuts || [];
    appData.vacancies = data.vacancies || [];
    appData.inspections = data.inspections || [];
    appData.workOrders = data.workOrders || [];
    // If ticklers are separate in your logic, handle them. 
    // Currently GmailFetcher merges tenant_tickler into moveOuts or doesn't explicitly separate them in the return object 
    // unless we change GmailFetcher. 
    // Looking at GmailFetcher, it adds tenant_tickler data to 'moveOuts'. 
    // So we can leave appData.ticklers empty or alias it if needed.
    appData.ticklers = [];

    document.getElementById('last-updated-date').innerText = data.timestamp || 'Unknown';

    processData();
    renderDashboard();

    const subTitle = document.querySelector('header p');
    if (subTitle) subTitle.innerText = "Data updated: " + (data.timestamp || 'Just now');
}

function onDataLoadError(error) {
    console.error("Connection Error:", error);
    alert("Failed to connect to the server. Please try refreshing.");
}

function normalizeUnit(unit) {
    if (!unit) return "Unknown";
    return unit.toString().trim();
}

function processData() {
    const merged = new Map();
    // Helper to generate unique key
    const getKey = (prop, unit) => `${prop}-${normalizeUnit(unit)}`;

    // 1. BASE: Unit Vacancy (The Truth)
    appData.vacancies.forEach(row => {
        if (!row['Property Name'] || row['Property Name'] === 'Total') return;
        const key = getKey(row['Property Name'], row['Unit']);

        merged.set(key, {
            // IDs
            key: key,
            property: row['Property Name'],
            unit: normalizeUnit(row['Unit']),

            // Vacancy Info
            daysVacant: parseInt(row['Days Vacant']) || 0,
            rentReady: row['Rent Ready'] === 'Yes',
            rentReadyDate: row['Ready For Showing On'] || '',
            availableOn: row['Available On'] || '',
            nextMoveIn: row['Next Move In'],
            postedWeb: row['Posted To Website'] === 'Yes',
            postedNet: row['Posted To Internet'] === 'Yes',

            // Move Out Info (Default to null, fill later)
            moveOutDate: null,
            tenantName: '',

            // Process (Fill later)
            inspectionStatus: 'NONE',
            inspectionDate: null,
            workOrderStatus: 'NONE',
            workOrderEstAmount: null,
            workOrderEstStatus: null
        });
    });

    // 2. ENRICH: Move Out Data (From Move Out.csv OR Tenant Tickler)
    // Using simplistic 'Move Out.csv' for now as primary, falling back to Tickler
    appData.moveOuts.forEach(row => {
        if (!row['Property Name']) return;
        const key = getKey(row['Property Name'], row['Unit']);

        // If unit not in vacancy list, we might still want it if it's a recent move out
        if (!merged.has(key)) {
            merged.set(key, {
                key: key,
                property: row['Property Name'],
                unit: normalizeUnit(row['Unit']),
                daysVacant: 0,
                rentReady: false,
                postedWeb: false,
                postedNet: false,
                moveOutDate: row['Move Out Date'],
                inspectionStatus: 'NONE'
            });
        }

        const item = merged.get(key);
        if (!item.moveOutDate) item.moveOutDate = row['Move Out Date'];
    });

    // 3. ENRICH: Inspections
    appData.inspections.forEach(row => {
        if (!row['Property Name']) return;
        const key = getKey(row['Property Name'], row['Unit']);

        if (merged.has(key)) {
            const item = merged.get(key);
            const status = (row['Status'] || 'NEW').toUpperCase();

            // Logic: Prioritize Active > Done > None. Prioritize "Move Out" inspection types.
            if (item.inspectionStatus === 'NONE') {
                item.inspectionStatus = status;
                item.inspectionDate = row['Inspection Date'];
            }
        }
    });

    // 4. ENRICH: Work Orders (New!)
    appData.workOrders.forEach(row => {
        // Note: Work Order CSV headers might need mapping depending on exact file format
        // Usually: Property, Unit, Status, Estimate Amount
        const prop = row['Property Name'] || row['Property'];
        const unit = normalizeUnit(row['Unit']);
        const key = getKey(prop, unit);

        if (merged.has(key)) {
            const item = merged.get(key);
            // Simple logic: If there is an open WO, flag it
            const status = row['Status'];
            if (status && status !== 'Closed' && status !== 'Cancelled') {
                item.workOrderStatus = status;
                item.workOrderEstAmount = row['Estimate Amount'];
                item.workOrderEstStatus = row['Estimate Approval Status'];
            }
        }
    });

    appData.masterList = Array.from(merged.values());

    // Sort: Days Vacant Descending
    appData.masterList.sort((a, b) => b.daysVacant - a.daysVacant);

    document.getElementById('last-updated-date').innerText = new Date().toLocaleString();
    populatePropertyFilter();
}

function populatePropertyFilter() {
    const select = document.getElementById('filter-property');
    const currentVal = select.value;
    select.innerHTML = '<option value="all">All Properties</option>';
    const properties = [...new Set(appData.masterList.map(i => i.property))].sort();
    properties.forEach(prop => {
        const option = document.createElement('option');
        option.value = prop;
        option.textContent = prop;
        select.appendChild(option);
    });
    if (properties.includes(currentVal)) select.value = currentVal;
}

function renderDashboard() {
    const tableBody = document.getElementById('table-body');
    const tableHeader = document.querySelector('#main-table thead tr');

    // 1. Setup Columns (Enhanced)
    tableHeader.innerHTML = `
        <th>Property</th>
        <th>Unit</th>
        <th>Move Out</th>
        <th>Days Vacant</th>
        <th>Inspection</th>
        <th>Work Order</th>
        <th>Rent Ready?</th>
        <th>Posted?</th>
        <th>Actions</th>
    `;

    tableBody.innerHTML = '';

    // 2. Filter Master List
    const propFilter = document.getElementById('filter-property').value;
    const readyFilter = document.getElementById('filter-ready').value;
    const inspFilter = document.getElementById('filter-inspection').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    const filtered = appData.masterList.filter(item => {
        if (propFilter !== 'all' && item.property !== propFilter) return false;
        if (readyFilter === 'Yes' && !item.rentReady) return false;
        if (readyFilter === 'No' && item.rentReady) return false;
        if (inspFilter !== 'all' && item.inspectionStatus !== inspFilter) return false;

        if (search) {
            return (`${item.property} ${item.unit}`).toLowerCase().includes(search);
        }
        return true;
    });

    updateStats(filtered);

    // 3. Render Rows
    filtered.forEach(item => {
        const tr = document.createElement('tr');

        // Inspection Badge Color
        let inspBadge = 'badge-none';
        if (item.inspectionStatus === 'NEW') inspBadge = 'badge-new';
        else if (item.inspectionStatus === 'IN PROGRESS') inspBadge = 'badge-progress';
        else if (item.inspectionStatus === 'DONE') inspBadge = 'badge-done';

        // Work Order Info (If any)
        let woDisplay = '<span class="badge badge-none">None</span>';
        if (item.workOrderStatus && item.workOrderStatus !== 'NONE') {
            woDisplay = `<div style="display:flex; flex-direction:column; gap:2px;">
                            <span class="badge badge-progress">${item.workOrderStatus}</span>
                            ${item.workOrderEstAmount ? `<span style="font-size:10px;">Est: ${item.workOrderEstAmount}</span>` : ''}
                         </div>`;
        }

        // Alert Stylng for Posted Check
        const alertStyle = (item.rentReady && (!item.postedWeb || !item.postedNet))
            ? 'background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger); border-radius: 4px;'
            : '';

        tr.innerHTML = `
            <td><strong>${item.property}</strong></td>
            <td>${item.unit}</td>
            <td>${item.moveOutDate || '-'}</td>
            <td>${item.daysVacant}</td>
            <td><span class="badge ${inspBadge}">${item.inspectionStatus}</span></td>
            <td>${woDisplay}</td>
            <td>
                <span class="status-dot ${item.rentReady ? 'green' : 'red'}"></span>
                ${item.rentReady ? 'Yes' : 'No'}
            </td>
            <td style="${alertStyle}">
                <div style="display:flex; gap:4px; font-size: 10px;">
                    <span class="badge ${item.postedWeb ? 'badge-new' : 'badge-none'}">WEB</span>
                    <span class="badge ${item.postedNet ? 'badge-new' : 'badge-none'}">NET</span>
                </div>
            </td>
            <td><button class="btn-action"><i class="fa-solid fa-ellipsis"></i></button></td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderReports() {
    const tableBody = document.getElementById('table-body');
    const tableHeader = document.querySelector('#main-table thead tr');

    tableHeader.innerHTML = `
        <th>Report Name</th>
        <th>Count</th>
        <th>Description</th>
        <th>Action</th>
    `;

    tableBody.innerHTML = '';

    // --- DEFINED REPORTS FROM MOVE OUT BOARD ---
    const reports = [
        {
            title: 'Active Move-Outs',
            filter: i => !i.rentReady && i.daysVacant > 0, // Broad definition
            desc: 'Total units in the turnover process (Vacant and not yet Ready).'
        },
        {
            title: 'Pending Inspections',
            filter: i => i.inspectionStatus === 'NEW' || i.inspectionStatus === 'IN PROGRESS',
            desc: 'Units waiting for inspection to be completed.'
        },
        {
            title: 'Awaiting Rent Ready',
            filter: i => !i.rentReady && (i.inspectionStatus === 'DONE'),
            desc: 'Inspection done, but unit is not marked Rent Ready (needs Work Order?).'
        },
        {
            title: 'Vacant & Ready',
            filter: i => i.rentReady,
            desc: 'Units fully ready to lease.'
        },
        {
            title: 'Being Marketed',
            filter: i => i.postedWeb || i.postedNet,
            desc: 'Units currently visible on website or internet.'
        },
        {
            title: 'Long Vacancy (> 90 Days)',
            filter: i => i.daysVacant > 90,
            desc: 'Units staling on the market.'
        }
    ];

    reports.forEach(rep => {
        const count = appData.masterList.filter(rep.filter).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${rep.title}</strong></td>
            <td><span class="badge badge-new" style="font-size:14px">${count}</span></td>
            <td>${rep.desc}</td>
            <td>
                <button style="color:var(--accent); background:none; border:1px solid var(--accent); padding:6px 12px; border-radius:4px; cursor:pointer;" onclick="alert('Filtering feature coming soon!')">
                    View List
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function updateStats(data) {
    const totalVacant = data.length;
    const notReady = data.filter(i => !i.rentReady).length;
    const noInspection = data.filter(i => i.inspectionStatus === 'NONE').length;

    // Avg Days Calculation (Robus)
    const validDayCounts = data.map(i => i.daysVacant).filter(d => !isNaN(d) && d > 0);
    const totalDays = validDayCounts.reduce((a, b) => a + b, 0);
    const avgDays = validDayCounts.length ? Math.round(totalDays / validDayCounts.length) : 0;

    document.querySelector('#card-vacant .value').innerText = totalVacant;
    document.querySelector('#card-not-ready .value').innerText = notReady;
    document.querySelector('#card-no-inspection .value').innerText = noInspection;
    document.querySelector('#card-avg-days .value').innerText = avgDays;
}
