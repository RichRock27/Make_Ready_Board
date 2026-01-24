// Data Storage
let appData = {
    moveOuts: [],
    vacancies: [],
    inspections: [],
    masterList: []
};

// File Paths
const FILES = {
    moveOut: 'Move Out.csv',
    vacancy: 'Unit Vacancy.csv',
    inspection: 'Inspection Detail.csv'
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
    document.getElementById('filter-territory').addEventListener('change', renderDashboard);
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

async function loadData() {
    try {
        const [moveOutData, vacancyData, inspectionData] = await Promise.all([
            fetchCSV(FILES.moveOut),
            fetchCSV(FILES.vacancy),
            fetchCSV(FILES.inspection)
        ]);

        appData.moveOuts = moveOutData;
        appData.vacancies = vacancyData;
        appData.inspections = inspectionData;

        processData();
        renderDashboard();
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Failed to load CSV data. Ensure 'Move Out.csv', 'Unit Vacancy.csv', and 'Inspection Detail.csv' are in the folder.");
    }
}

function fetchCSV(filename) {
    return new Promise((resolve, reject) => {
        Papa.parse(filename, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });
}

function normalizeUnit(unit) {
    if (!unit) return "Unknown";
    // Basic normalization: trim whitespace. 
    // If we find mismatched zeros (5 vs 05) we might need parseInt logic here.
    return unit.toString().trim();
}

function processData() {
    const merged = new Map();
    const getKey = (prop, unit) => `${prop}-${normalizeUnit(unit)}`;

    // 1. Base: Vacancies
    appData.vacancies.forEach(row => {
        if (!row['Property Name'] || row['Property Name'] === 'Total') return;

        const key = getKey(row['Property Name'], row['Unit']);
        merged.set(key, {
            property: row['Property Name'],
            unit: normalizeUnit(row['Unit']),
            moveOutDate: null,
            daysVacant: parseInt(row['Days Vacant']) || 0,
            rentReady: row['Rent Ready'] === 'Yes',
            nextMoveIn: row['Next Move In'],
            postedWeb: row['Posted To Website'] === 'Yes',
            postedNet: row['Posted To Internet'] === 'Yes',
            inspectionStatus: 'NONE',
            inspectionName: '',
            inspectionDate: null
        });
    });

    // 2. Merge Move Outs
    appData.moveOuts.forEach(row => {
        if (!row['Property Name'] || row['Property Name'] === 'Total') return;
        const key = getKey(row['Property Name'], row['Unit']);

        if (!merged.has(key)) {
            // Unit is in Move Out list but NOT in Vacancy list. 
            // It might be rented already? Or data drift.
            // We add it to track "Recent Move Outs" even if not currently vacant.
            merged.set(key, {
                property: row['Property Name'],
                unit: normalizeUnit(row['Unit']),
                moveOutDate: row['Move Out Date'],
                daysVacant: 0,
                rentReady: false,
                nextMoveIn: null,
                postedWeb: false,
                postedNet: false,
                inspectionStatus: 'NONE',
                inspectionName: '',
                inspectionDate: null
            });
        } else {
            merged.get(key).moveOutDate = row['Move Out Date'];
        }
    });

    // 3. Merge Inspections
    // We want to prioritize "Move Out" inspections if multiple exist.
    appData.inspections.forEach(row => {
        if (!row['Property Name']) return;
        const key = getKey(row['Property Name'], row['Unit']);

        if (merged.has(key)) {
            const item = merged.get(key);
            const newName = (row['Inspection Name'] || '').toLowerCase();
            const newStatus = (row['Status'] || 'NEW').toUpperCase();

            // Logic: 
            // 1. If current stored is NONE, take this one.
            // 2. If current is NOT Move Out related, but this one IS, take this one.
            // 3. If both are Move Out related, take the most recent date? (Not implemented, taking latest in file)

            const isMoveOut = newName.includes('move') || newName.includes('out');
            const currentIsMoveOut = (item.inspectionName || '').toLowerCase().includes('move');

            let shouldUpdate = false;
            if (item.inspectionStatus === 'NONE') shouldUpdate = true;
            else if (!currentIsMoveOut && isMoveOut) shouldUpdate = true;
            else if (newStatus !== 'DONE' && item.inspectionStatus === 'DONE') shouldUpdate = true; // Prioritize active work?
            else if (isMoveOut && currentIsMoveOut) shouldUpdate = true; // Overwrite with latest in list (assuming csv is recent-last or random)

            if (shouldUpdate) {
                item.inspectionStatus = newStatus || 'NEW';
                item.inspectionName = row['Inspection Name'];
                item.inspectionDate = row['Inspection Date'];
            }
        }
    });

    appData.masterList = Array.from(merged.values());
    appData.masterList.sort((a, b) => b.daysVacant - a.daysVacant);

    document.getElementById('last-updated-date').innerText = new Date().toLocaleString();
}

function renderDashboard() {
    const tableBody = document.getElementById('table-body');
    const tableHeader = document.querySelector('#main-table thead tr');

    // Reset Header (Reports view might change it)
    tableHeader.innerHTML = `
        <th>Property</th>
        <th>Unit</th>
        <th>Move Out</th>
        <th>Days Vacant</th>
        <th>Inspection</th>
        <th>Rent Ready?</th>
        <th>Posted?</th>
        <th>Actions</th>
    `;

    tableBody.innerHTML = '';

    // Filters
    const terrFilter = document.getElementById('filter-territory').value;
    const readyFilter = document.getElementById('filter-ready').value;
    const inspFilter = document.getElementById('filter-inspection').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    const filtered = appData.masterList.filter(item => {
        if (terrFilter !== 'all') { /* implement territory logic if data available */ }

        if (readyFilter === 'Yes' && !item.rentReady) return false;
        if (readyFilter === 'No' && item.rentReady) return false;

        if (inspFilter !== 'all') {
            if (inspFilter === 'NONE' && item.inspectionStatus !== 'NONE') return false;
            // Fuzzy match for status (e.g. users might have typo in CSV)
            if (inspFilter !== 'NONE' && item.inspectionStatus !== inspFilter) return false;
        }

        if (search) {
            return (`${item.property} ${item.unit}`).toLowerCase().includes(search);
        }
        return true;
    });

    updateStats(filtered);

    filtered.forEach(item => {
        const tr = document.createElement('tr');

        let badge = 'badge-none';
        if (item.inspectionStatus === 'NEW') badge = 'badge-new';
        else if (item.inspectionStatus === 'IN PROGRESS') badge = 'badge-progress';
        else if (item.inspectionStatus === 'DONE') badge = 'badge-done';

        tr.innerHTML = `
            <td><strong>${item.property}</strong></td>
            <td>${item.unit}</td>
            <td>${item.moveOutDate || '-'}</td>
            <td>${item.daysVacant}</td>
            <td>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span class="badge ${badge}">${item.inspectionStatus}</span>
                    <span style="font-size:10px; color:#64748b">${item.inspectionName || ''}</span>
                </div>
            </td>
            <td>
                <span class="status-dot ${item.rentReady ? 'green' : 'red'}"></span>
                ${item.rentReady ? 'Yes' : 'No'}
            </td>
            <td>
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

    // Custom Reports Header
    tableHeader.innerHTML = `
        <th>Report Type</th>
        <th>Count</th>
        <th>Description</th>
        <th>Action</th>
    `;

    tableBody.innerHTML = '';

    const reports = [
        {
            title: 'Units Not Rent Ready',
            filter: i => !i.rentReady,
            desc: 'Vacant units that are not marked as Rent Ready yet.'
        },
        {
            title: 'No Inspection Scheduled',
            filter: i => i.inspectionStatus === 'NONE' || !i.inspectionStatus,
            desc: 'Units with move-outs but no inspection record found.'
        },
        {
            title: 'Inspections In Progress',
            filter: i => i.inspectionStatus === 'IN PROGRESS',
            desc: 'Units currently being inspected or turned.'
        },
        {
            title: 'Long Vacancy (> 90 Days)',
            filter: i => i.daysVacant > 90,
            desc: 'Units vacant for more than 3 months.'
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
                <button onclick="loadReportDetail('${rep.title}')" style="color:var(--accent); background:none; border:1px solid var(--accent); padding:6px 12px; border-radius:4px; cursor:pointer;">
                    View List
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Global for inline onclick
window.loadReportDetail = function (reportTitle) {
    alert("In a full app, this would filter the main dashboard view to show: " + reportTitle);
    // Switch to dashboard and apply filters mock
    document.querySelector('.nav-item[data-view="dashboard"]').click();
    // Simulate setting filters (implementation would require more complex state management)
};

function updateStats(data) {
    const totalVacant = data.length;
    const notReady = data.filter(i => !i.rentReady).length;
    const noInspection = data.filter(i => i.inspectionStatus === 'NONE').length;

    // Avg Days
    const totalDays = data.reduce((sum, i) => sum + i.daysVacant, 0);
    const avgDays = totalVacant ? Math.round(totalDays / totalVacant) : 0;

    document.querySelector('#card-vacant .value').innerText = totalVacant;
    document.querySelector('#card-not-ready .value').innerText = notReady;
    document.querySelector('#card-no-inspection .value').innerText = noInspection;
    document.querySelector('#card-avg-days .value').innerText = avgDays;
}

window.exportData = function () {
    alert("Export functionality placeholder.");
};
