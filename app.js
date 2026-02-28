const STORAGE_KEY = 'mcGovOsDataV4';

const appData = {
    people: {},
    entries: [],
    accounts: [],
    transactions: [],
    credits: [],
    permits: [],
    waterConnections: [],
    waterUsage: [],
    taxes: [],
    bills: [],
    felonies: [],
    arrests: [],
    bolos: [],
    entryBans: [],
    notifications: [],
    bankEntryLogs: [],
    bankProduction: [],
    auditLog: []
};

const verificationState = {
    bank: null,
    water: null,
    bill: null
};

let zCounter = 100;
const windowState = {};
let currentProfileMCID = '';

function generateID(prefix, length = 5) {
    const num = Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
    return `${prefix}-${num}`;
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        Object.assign(appData, parsed);
    } catch {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function getValue(id) {
    return (document.getElementById(id)?.value || '').trim();
}

function getNumber(id) {
    const value = getValue(id);
    return value === '' ? null : Number(value);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function showNode(id) {
    document.getElementById(id)?.classList.remove('hidden');
}

function hideNode(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function clearFormFields(containerId, { keep = [] } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const keepSet = new Set(keep);
    const nodes = container.querySelectorAll('input, select, textarea');
    nodes.forEach(node => {
        const id = node.id || '';
        if (id && keepSet.has(id)) return;
        if (node instanceof HTMLInputElement) {
            if (node.type === 'button' || node.type === 'submit' || node.type === 'hidden') return;
            if (node.type === 'checkbox' || node.type === 'radio') {
                node.checked = false;
            } else {
                node.value = '';
            }
            return;
        }
        if (node instanceof HTMLSelectElement) {
            node.selectedIndex = 0;
            return;
        }
        if (node instanceof HTMLTextAreaElement) {
            node.value = '';
        }
    });

    if (containerId === 'citizenPermitIssue') {
        onPermitTypeChange();
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function ageFromDob(dob) {
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
    return age;
}

function ensurePersonRecord(payload) {
    const existing = payload.mcid && appData.people[payload.mcid] ? appData.people[payload.mcid] : null;
    const mcid = existing?.mcid || payload.mcid || generateID('MCID', 5);
    const dobValue = payload.dob || existing?.personal?.dob || '';
    const calculatedAge = ageFromDob(dobValue);

    appData.people[mcid] = {
        mcid,
        personal: {
            firstName: payload.firstName || existing?.personal?.firstName || '',
            middleName: payload.middleName || existing?.personal?.middleName || '',
            lastName: payload.lastName || existing?.personal?.lastName || '',
            username: payload.username || existing?.personal?.username || '',
            dob: dobValue,
            age: calculatedAge ?? existing?.personal?.age ?? null,
            gender: payload.gender || existing?.personal?.gender || '',
            maritalStatus: payload.maritalStatus || existing?.personal?.maritalStatus || '',
            nationality: payload.nationality || existing?.personal?.nationality || '',
            occupation: payload.occupation || existing?.personal?.occupation || '',
            employer: payload.employer || existing?.personal?.employer || '',
            educationLevel: payload.educationLevel || existing?.personal?.educationLevel || '',
            bloodType: payload.bloodType || existing?.personal?.bloodType || '',
            allergies: payload.allergies || existing?.personal?.allergies || '',
            criminalRecord: payload.criminalRecord || existing?.personal?.criminalRecord || '',
            emergencyName: payload.emergencyName || existing?.personal?.emergencyName || '',
            emergencyRelation: payload.emergencyRelation || existing?.personal?.emergencyRelation || '',
            emergencyContact: payload.emergencyContact || existing?.personal?.emergencyContact || ''
        },
        addresses: {
            residenceX: payload.residenceX ?? existing?.addresses?.residenceX ?? null,
            residenceY: payload.residenceY ?? existing?.addresses?.residenceY ?? null,
            residenceZ: payload.residenceZ ?? existing?.addresses?.residenceZ ?? null,
            mailingAddress: payload.mailingAddress || existing?.addresses?.mailingAddress || ''
        },
        governance: {
            permits: payload.permits || existing?.governance?.permits || '',
            taxId: payload.taxId || existing?.governance?.taxId || '',
            skills: payload.skills || existing?.governance?.skills || '',
            notes: payload.notes || existing?.governance?.notes || ''
        },
        media: {
            mugshotData: payload.mugshotData || existing?.media?.mugshotData || '',
            mugshotName: payload.mugshotName || existing?.media?.mugshotName || ''
        },
        links: {
            entries: existing?.links?.entries || [],
            accounts: existing?.links?.accounts || [],
            permits: existing?.links?.permits || [],
            waterConnections: existing?.links?.waterConnections || [],
            taxes: existing?.links?.taxes || [],
            bills: existing?.links?.bills || [],
            policeCases: existing?.links?.policeCases || []
        },
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    return mcid;
}

function findPerson(query) {
    const q = query.toLowerCase();
    return Object.values(appData.people).find(person => {
        const name = `${person.personal.firstName} ${person.personal.lastName}`.toLowerCase();
        return person.mcid.toLowerCase() === q || name.includes(q) || (person.personal.username || '').toLowerCase() === q;
    }) || null;
}

function getPrimaryAccount(mcid) {
    return appData.accounts.find(account => account.mcid === mcid && account.status === 'Active') || null;
}

function getMCIDSecurityFlags(mcid) {
    const activeBan = appData.entryBans.find(row => row.mcid === mcid && row.status === 'Active');
    const activeBolo = appData.bolos.find(row => row.mcid === mcid && row.status === 'Active');
    return {
        activeBan,
        activeBolo,
        hasFlag: Boolean(activeBan || activeBolo)
    };
}

function closeSystemAlert() {
    hideNode('systemAlert');
}

function showSystemAlert(title, message) {
    setText('systemAlertTitle', title);
    setText('systemAlertMessage', message);
    showNode('systemAlert');
}

function getMCIDValidation(inputValue, { showPopup = false } = {}) {
    const mcid = (inputValue || '').trim();
    if (!mcid) {
        return { ok: false, code: 'empty', mcid, person: null, message: 'Enter MCID.' };
    }

    const person = appData.people[mcid];
    if (!person) {
        return { ok: false, code: 'missing', mcid, person: null, message: 'MCID not found. Try again.' };
    }

    const flags = getMCIDSecurityFlags(mcid);
    if (flags.hasFlag && showPopup) {
        const parts = [];
        if (flags.activeBan) parts.push(`active entry ban (${flags.activeBan.banId})`);
        if (flags.activeBolo) parts.push(`active BOLO (${flags.activeBolo.boloId})`);
        showSystemAlert('Security Alert', `ALERT: ${mcid} is tied to ${parts.join(' and ')}.`);
    }

    return {
        ok: true,
        code: flags.hasFlag ? 'flagged' : 'valid',
        mcid,
        person,
        flags,
        message: flags.hasFlag
            ? `Validated ${mcid}, but this profile has active security flags.`
            : `Validated ${mcid}.`
    };
}

function setMCIDInputStatus(inputId, message, tone) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const statusId = `${inputId}Status`;
    let statusNode = document.getElementById(statusId);

    if (!statusNode) {
        statusNode = document.createElement('div');
        statusNode.id = statusId;
        statusNode.className = 'mcid-inline-status';
        const host = input.closest('.form-group') || input.parentElement;
        host?.appendChild(statusNode);
    }

    statusNode.className = `mcid-inline-status ${tone}`;
    statusNode.textContent = message;
}

function validateMCIDInputField(inputId, options = {}) {
    const value = getValue(inputId);
    if (!value) {
        setMCIDInputStatus(inputId, 'Enter MCID for validation.', 'neutral');
        return;
    }

    const result = getMCIDValidation(value, { showPopup: options.showPopup });
    if (!result.ok) {
        setMCIDInputStatus(inputId, result.message, 'error');
        return;
    }

    setMCIDInputStatus(inputId, result.message, result.code === 'flagged' ? 'warning' : 'success');
}

function setupMCIDRealtimeValidation() {
    const ids = [
        'manageMCID', 'permitMCID', 'citizenDeleteMCID', 'borderDeleteMCID',
        'bankVerifyMCID', 'bankMCID', 'waterVerifyMCID', 'waterMCID', 'waterUsageMCID',
        'billVerifyMCID', 'billMCID', 'taxManualMCID', 'browseUpdateMCID',
        'policeFelonyMCID', 'policeArrestMCID', 'policeBoloMCID', 'policeBanMCID'
    ];

    ids.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        const runValidation = () => validateMCIDInputField(id, { showPopup: true });
        input.addEventListener('change', runValidation);
        input.addEventListener('blur', runValidation);
    });
}

function verifyMCIDForModule(module) {
    const inputId = module === 'bank' ? 'bankVerifyMCID' : module === 'water' ? 'waterVerifyMCID' : 'billVerifyMCID';
    const resultId = module === 'bank' ? 'bankVerifyResult' : module === 'water' ? 'waterVerifyResult' : 'billVerifyResult';
    const mcid = getValue(inputId);

    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) {
        verificationState[module] = null;
        setText(resultId, validation.message);
        return;
    }

    const person = validation.person;
    verificationState[module] = mcid;
    setText(resultId, `Verified: ${mcid} belongs to ${person.personal.firstName} ${person.personal.lastName}.${validation.code === 'flagged' ? ' Security flags present.' : ''}`);

    if (module === 'bank') document.getElementById('bankMCID').value = mcid;
    if (module === 'water') document.getElementById('waterMCID').value = mcid;
    if (module === 'bill') document.getElementById('billMCID').value = mcid;
}

function getDocumentTheme(docType) {
    const themes = {
        passport: { accent: '#0a3f8f', light: '#edf4ff', label: 'Passport Authority', watermark: 'PASSPORT' },
        id: { accent: '#1f5f3c', light: '#eefaf2', label: 'Citizen Registry', watermark: 'CITIZEN ID' },
        bank: { accent: '#6f4b12', light: '#fff7ea', label: 'National Treasury', watermark: 'BANKING' },
        utility: { accent: '#0a5c8c', light: '#e9f8ff', label: 'Water Utility Board', watermark: 'WATER' },
        tax: { accent: '#7b2d5e', light: '#fff0fa', label: 'Tax Authority', watermark: 'TAX NOTICE' },
        bill: { accent: '#813f1f', light: '#fff3ec', label: 'Government Billing Unit', watermark: 'OFFICIAL BILL' },
        security: { accent: '#8a1029', light: '#fff0f3', label: 'Police & NSD Command', watermark: 'SECURITY' },
        profile: { accent: '#274a9c', light: '#eef3ff', label: 'Citizen Master Archive', watermark: 'PROFILE DOSSIER' },
        standard: { accent: '#1e4ba8', light: '#f4f8ff', label: 'Government Archive', watermark: 'OFFICIAL' }
    };
    return themes[docType] || themes.standard;
}

function printDocument(title, subtitle, sections, options = {}) {
    const theme = getDocumentTheme(options.docType || 'standard');
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) return;

    const sectionHtml = sections.map(section => `
        <section class="doc-section">
            <h3>${section.title}</h3>
            ${section.body}
        </section>
    `).join('');

    popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>
                @page { size: A4; margin: 14mm; }
                body { font-family: 'Trebuchet MS', Arial, sans-serif; color: #10264a; background: #f7fbff; }
                .wrap { border: 4px solid ${theme.accent}; padding: 16px; background: #ffffff; }
                .header { border-bottom: 3px solid ${theme.accent}; padding-bottom: 10px; margin-bottom: 12px; }
                .header-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
                .gov { font-size: 12px; letter-spacing: 1px; color: #0f2f73; font-weight: 700; }
                .emblems { display: flex; gap: 6px; font-size: 16px; }
                .emblem { width: 28px; height: 28px; border: 1px solid ${theme.accent}; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px; background: linear-gradient(180deg,#f4f8ff,#d4e3ff); }
                h1 { margin: 6px 0; font-size: 26px; color: ${theme.accent}; }
                .subtitle { font-size: 14px; color: ${theme.accent}; }
                .meta { margin-top: 6px; font-size: 12px; color: #415c92; display: flex; flex-wrap: wrap; gap: 10px; }
                .doc-section { border: 1px solid #b5c6e8; background: ${theme.light}; margin-top: 12px; padding: 10px; }
                .doc-section h3 { margin: 0 0 8px 0; font-size: 15px; color: ${theme.accent}; }
                table { width: 100%; border-collapse: collapse; margin-top: 6px; background: #fff; }
                th { background: linear-gradient(180deg,${theme.accent},#123d9e); color: #fff; font-size: 12px; text-align: left; padding: 6px; }
                td { border: 1px solid #8da4d3; padding: 6px; font-size: 12px; }
                .seal { margin-top: 14px; padding: 8px; border: 2px dashed ${theme.accent}; color: ${theme.accent}; font-size: 12px; text-align: center; }
                .doc-badge { margin-top: 8px; display: inline-block; font-size: 11px; border: 1px solid ${theme.accent}; padding: 4px 8px; color: ${theme.accent}; letter-spacing: 1px; font-weight: 700; }
            </style>
        </head>
        <body>
            <div class="wrap">
                <div class="header">
                    <div class="header-top">
                        <div class="gov">MINECRAFT NATIONAL GOVERNMENT ARCHIVE • ${theme.label}</div>
                        <div class="emblems"><span class="emblem">💎</span><span class="emblem">🗺️</span><span class="emblem">🛡️</span><span class="emblem">🟩</span></div>
                    </div>
                    <h1>${escapeHtml(title)}</h1>
                    <div class="subtitle">${escapeHtml(subtitle)}</div>
                    <div class="meta"><span>Generated: ${new Date().toLocaleString()}</span><span>Authority: Minecraft Central Government</span><span>Document Class: Official</span></div>
                    <div class="doc-badge">${theme.watermark}</div>
                </div>
                ${sectionHtml}
                <div class="seal">Official Government Document • Authorized by Minecraft Government OS</div>
            </div>
        </body>
        </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
}

function printPassportByMCID(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('MCID not found.');

    printDocument('Government Passport', `Citizen ${mcid}`, [
        {
            title: 'Identity',
            body: `<p><strong>MCID:</strong> ${escapeHtml(mcid)}</p>
                   <p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p>
                   <p><strong>DOB:</strong> ${escapeHtml(person.personal.dob || '-')}</p>
                   <p><strong>Nationality:</strong> ${escapeHtml(person.personal.nationality || '-')}</p>
                   <p><strong>Residence Coordinates:</strong> ${escapeHtml(String(person.addresses.residenceX ?? '-'))}, ${escapeHtml(String(person.addresses.residenceY ?? '-'))}, ${escapeHtml(String(person.addresses.residenceZ ?? '-'))}</p>`
        },
        {
            title: 'Government Status',
            body: `<p><strong>Permits:</strong> ${escapeHtml(person.governance.permits || '-')}</p>
                   <p><strong>Tax ID:</strong> ${escapeHtml(person.governance.taxId || '-')}</p>`
        }
    ], { docType: 'passport' });
}

function printCitizenIdByMCIDValue(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('MCID not found.');
    printDocument('Citizen ID Card', `Citizen ${mcid}`, [
        {
            title: 'Card Data',
            body: `<p><strong>MCID:</strong> ${escapeHtml(mcid)}</p>
                   <p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p>
                   <p><strong>Username:</strong> ${escapeHtml(person.personal.username || '-')}</p>
                   <p><strong>Occupation:</strong> ${escapeHtml(person.personal.occupation || '-')}</p>
                   <p><strong>Address:</strong> ${escapeHtml(person.addresses.mailingAddress || '-')}</p>`
        }
    ], { docType: 'id' });
}

function printBankStatementByAccount(account) {
    const person = appData.people[account.mcid];
    const logs = appData.transactions.filter(tx => tx.accountId === account.accountId).slice(0, 30);

    printDocument('Bank Statement', `Account ${account.accountId}`, [
        {
            title: 'Account Summary',
            body: `<p><strong>Account ID:</strong> ${escapeHtml(account.accountId)}</p>
                   <p><strong>MCID:</strong> ${escapeHtml(account.mcid)}</p>
                   <p><strong>Holder:</strong> ${escapeHtml(account.holderName)}</p>
                   <p><strong>Current Balance:</strong> ${account.balance} ${escapeHtml(account.currency || 'Gold Nuggets')}</p>
                   <p><strong>Status:</strong> ${escapeHtml(account.status)}</p>
                   <p><strong>Profile:</strong> ${escapeHtml(person?.personal?.firstName || '')} ${escapeHtml(person?.personal?.lastName || '')}</p>`
        },
        {
            title: 'Recent Transactions',
            body: logs.length
                ? `<table><thead><tr><th>TX</th><th>Date</th><th>Type</th><th>Amount</th><th>Balance After</th></tr></thead><tbody>${logs.map(tx => `<tr><td>${escapeHtml(tx.txId)}</td><td>${escapeHtml(tx.date)}</td><td>${escapeHtml(tx.type)}</td><td>${tx.amount}</td><td>${tx.balanceAfter}</td></tr>`).join('')}</tbody></table>`
                : '<p>No transactions recorded yet.</p>'
        }
    ], { docType: 'bank' });
}

function printDebitCardFromInput(inputId) {
    const q = getValue(inputId);
    const person = findPerson(q);
    let account = appData.accounts.find(a => a.accountId.toLowerCase() === q.toLowerCase());
    if (!account && person) account = getPrimaryAccount(person.mcid);
    if (!account) return alert('No account found.');

    printDocument('Debit Card Certificate', `Account ${account.accountId}`, [
        {
            title: 'Cardholder',
            body: `<p><strong>Account ID:</strong> ${escapeHtml(account.accountId)}</p>
                   <p><strong>MCID:</strong> ${escapeHtml(account.mcid)}</p>
                   <p><strong>Holder:</strong> ${escapeHtml(account.holderName)}</p>
                   <p><strong>Account Type:</strong> ${escapeHtml(account.accountType)}</p>
                   <p><strong>Currency:</strong> ${escapeHtml(account.currency)}</p>`
        }
    ], { docType: 'bank' });
}

function printBankStatementFromInput(inputId) {
    const q = getValue(inputId);
    const person = findPerson(q);
    let account = appData.accounts.find(a => a.accountId.toLowerCase() === q.toLowerCase());
    if (!account && person) account = getPrimaryAccount(person.mcid);
    if (!account) return alert('No account found for statement.');
    printBankStatementByAccount(account);
}

function printWaterStatementByMCID(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('MCID not found.');
    const usage = appData.waterUsage.filter(u => u.mcid === mcid);
    const totalBlocks = usage.reduce((sum, row) => sum + row.blocksUsed, 0);
    const totalCharge = usage.reduce((sum, row) => sum + row.charge, 0);

    printDocument('Water Utility Statement', `Citizen ${mcid}`, [
        { title: 'Summary', body: `<p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p><p><strong>Total Blocks Used:</strong> ${totalBlocks}</p><p><strong>Total Charged:</strong> ${totalCharge} Gold Nuggets</p>` },
        {
            title: 'Usage Lines',
            body: usage.length
                ? `<table><thead><tr><th>Date</th><th>House</th><th>Blocks</th><th>Charge</th><th>TX</th></tr></thead><tbody>${usage.map(row => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.houseId)}</td><td>${row.blocksUsed}</td><td>${row.charge}</td><td>${escapeHtml(row.txId || '-')}</td></tr>`).join('')}</tbody></table>`
                : '<p>No usage records.</p>'
        }
    ], { docType: 'utility' });
}

function printTaxStatementByMCID(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('MCID not found.');
    const taxes = appData.taxes.filter(t => t.mcid === mcid);
    const total = taxes.reduce((sum, row) => sum + row.amount, 0);

    printDocument('Tax Notice', `Citizen ${mcid}`, [
        { title: 'Summary', body: `<p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p><p><strong>Total Taxes Paid:</strong> ${total} Gold Nuggets</p>` },
        {
            title: 'Tax Entries',
            body: taxes.length
                ? `<table><thead><tr><th>Date</th><th>Service</th><th>Amount</th><th>Status</th><th>TX</th></tr></thead><tbody>${taxes.map(t => `<tr><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.service)}</td><td>${t.amount}</td><td>${escapeHtml(t.status)}</td><td>${escapeHtml(t.txId || '-')}</td></tr>`).join('')}</tbody></table>`
                : '<p>No tax records.</p>'
        }
    ], { docType: 'tax' });
}

function printGovernmentBillById(billId) {
    const bill = appData.bills.find(b => b.billId === billId);
    if (!bill) return alert('Bill not found.');
    const person = appData.people[bill.mcid];

    printDocument('Government Bill', `Bill ${bill.billId}`, [
        { title: 'Bill Header', body: `<p><strong>Bill ID:</strong> ${escapeHtml(bill.billId)}</p><p><strong>MCID:</strong> ${escapeHtml(bill.mcid)}</p><p><strong>Name:</strong> ${escapeHtml(person?.personal?.firstName || '')} ${escapeHtml(person?.personal?.lastName || '')}</p><p><strong>Department:</strong> ${escapeHtml(bill.department)}</p><p><strong>Category:</strong> ${escapeHtml(bill.category)}</p><p><strong>Priority:</strong> ${escapeHtml(bill.priority)}</p><p><strong>Due Date:</strong> ${escapeHtml(bill.dueDate || '-')}</p>` },
        { title: 'Cost Breakdown', body: `<table><thead><tr><th>Line</th><th>Amount</th></tr></thead><tbody><tr><td>Base Fee</td><td>${bill.baseFee}</td></tr><tr><td>Labor Fee</td><td>${bill.laborFee}</td></tr><tr><td>Materials Fee</td><td>${bill.materialFee}</td></tr><tr><td>Penalty Fee</td><td>${bill.penaltyFee}</td></tr><tr><td>Discount</td><td>-${bill.discount}</td></tr><tr><td><strong>Total</strong></td><td><strong>${bill.total}</strong></td></tr></tbody></table>` },
        { title: 'Details', body: `<p>${escapeHtml(bill.description || '-')}</p><p><strong>Legal Notes:</strong> ${escapeHtml(bill.legalNotes || '-')}</p><p><strong>Status:</strong> ${escapeHtml(bill.status)}</p><p><strong>TX:</strong> ${escapeHtml(bill.txId || '-')}</p>` }
    ], { docType: 'bill' });
}

function printCitizenProfileByMCID(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('MCID not found.');

    const primaryAccount = getPrimaryAccount(mcid);
    const entries = appData.entries.filter(entry => entry.mcid === mcid).slice(0, 10);
    const permits = appData.permits.filter(permit => permit.mcid === mcid).slice(0, 15);
    const bans = appData.entryBans.filter(row => row.mcid === mcid && row.status === 'Active');
    const bolos = appData.bolos.filter(row => row.mcid === mcid && row.status === 'Active');

    printDocument('Citizen Master Profile', `Full profile ${mcid}`, [
        {
            title: 'Identity Overview',
            body: `<p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p>
                   <p><strong>Username:</strong> ${escapeHtml(person.personal.username || '-')}</p>
                   <p><strong>DOB:</strong> ${escapeHtml(person.personal.dob || '-')}</p>
                   <p><strong>Age:</strong> ${escapeHtml(String(person.personal.age ?? '-'))}</p>
                   <p><strong>Nationality:</strong> ${escapeHtml(person.personal.nationality || '-')}</p>`
        },
        {
            title: 'Address and Residence',
            body: `<p><strong>Mailing Address:</strong> ${escapeHtml(person.addresses.mailingAddress || '-')}</p>
                   <p><strong>Residence Coordinates:</strong> ${escapeHtml(String(person.addresses.residenceX ?? '-'))}, ${escapeHtml(String(person.addresses.residenceY ?? '-'))}, ${escapeHtml(String(person.addresses.residenceZ ?? '-'))}</p>`
        },
        {
            title: 'Government and Banking Links',
            body: `<p><strong>Tax ID:</strong> ${escapeHtml(person.governance.taxId || '-')}</p>
                   <p><strong>Permits Summary:</strong> ${escapeHtml(person.governance.permits || '-')}</p>
                   <p><strong>Primary Account:</strong> ${escapeHtml(primaryAccount?.accountId || 'None')}</p>
                   <p><strong>Active Security Flags:</strong> ${bans.length || bolos.length ? `Ban ${bans.length}, BOLO ${bolos.length}` : 'None'}</p>`
        },
        {
            title: 'Recent Visas and Permits',
            body: `<table><thead><tr><th>Type</th><th>ID</th><th>Issue</th><th>Expiry</th></tr></thead><tbody>
                ${entries.map(entry => `<tr><td>Visa ${escapeHtml(entry.visaType || '-')}</td><td>${escapeHtml(entry.cpid)}</td><td>${escapeHtml(entry.entryDate || '-')}</td><td>${escapeHtml(entry.visaExpiry || '-')}</td></tr>`).join('')}
                ${permits.map(permit => `<tr><td>${escapeHtml(permit.type)}</td><td>${escapeHtml(permit.permitId)}</td><td>${escapeHtml(permit.validFrom || '-')}</td><td>${escapeHtml(permit.validUntil || '-')}</td></tr>`).join('')}
            </tbody></table>`
        }
    ], { docType: 'profile' });
}

function printCitizenProfileByMCIDInput(inputId) {
    const mcid = getValue(inputId);
    if (!mcid) return alert('Enter MCID first.');
    printCitizenProfileByMCID(mcid);
}

function printPoliceNoticeByMCID(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('MCID not found.');

    const felonies = appData.felonies.filter(row => row.mcid === mcid);
    const arrests = appData.arrests.filter(row => row.mcid === mcid);
    const bolos = appData.bolos.filter(row => row.mcid === mcid);
    const bans = appData.entryBans.filter(row => row.mcid === mcid);

    printDocument('NSD Security Notice', `Citizen ${mcid}`, [
        {
            title: 'Subject',
            body: `<p><strong>MCID:</strong> ${escapeHtml(mcid)}</p><p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p><p><strong>Nationality:</strong> ${escapeHtml(person.personal.nationality || '-')}</p><p><strong>Current Open Felonies:</strong> ${felonies.filter(row => row.status !== 'Closed').length}</p>`
        },
        {
            title: 'Felony Cases',
            body: felonies.length
                ? `<table><thead><tr><th>Case ID</th><th>Category</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead><tbody>${felonies.map(row => `<tr><td>${escapeHtml(row.caseId)}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.severity)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.date || '-')}</td></tr>`).join('')}</tbody></table>`
                : '<p>No felony cases linked.</p>'
        },
        {
            title: 'Arrests / Alerts',
            body: `${arrests.length
                ? `<p><strong>Arrests:</strong></p><table><thead><tr><th>Arrest ID</th><th>Case ID</th><th>Date</th><th>Facility</th></tr></thead><tbody>${arrests.map(row => `<tr><td>${escapeHtml(row.arrestId)}</td><td>${escapeHtml(row.caseId || '-')}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.facility || '-')}</td></tr>`).join('')}</tbody></table>`
                : '<p>No arrests linked.</p>'}
                ${bolos.length
                    ? `<p><strong>BOLO Alerts:</strong></p><table><thead><tr><th>BOLO ID</th><th>Threat</th><th>Status</th><th>Issued</th></tr></thead><tbody>${bolos.map(row => `<tr><td>${escapeHtml(row.boloId)}</td><td>${escapeHtml(row.threat)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.date || '-')}</td></tr>`).join('')}</tbody></table>`
                : '<p>No BOLO alerts linked.</p>'}
                ${bans.length
                    ? `<p><strong>Entry Bans:</strong></p><table><thead><tr><th>Ban ID</th><th>Type</th><th>Status</th><th>Start</th><th>End</th></tr></thead><tbody>${bans.map(row => `<tr><td>${escapeHtml(row.banId)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.startDate || '-')}</td><td>${escapeHtml(row.endDate || '-')}</td></tr>`).join('')}</tbody></table>`
                : '<p>No entry bans linked.</p>'}`
        }
    ], { docType: 'security' });
}

function printPoliceNoticeFromInput(inputId) {
    const query = getValue(inputId);
    if (!query) return alert('Enter MCID, name, or case ID.');
    const normalized = query.toLowerCase();

    let mcid = '';
    const person = findPerson(query);
    if (person) mcid = person.mcid;

    if (!mcid) {
        const caseMatch = appData.felonies.find(row => row.caseId.toLowerCase() === normalized)
            || appData.arrests.find(row => (row.caseId || '').toLowerCase() === normalized || (row.arrestId || '').toLowerCase() === normalized)
            || appData.bolos.find(row => row.boloId.toLowerCase() === normalized)
            || appData.entryBans.find(row => row.banId.toLowerCase() === normalized);
        mcid = caseMatch?.mcid || '';
    }

    if (!mcid) return alert('No linked profile found.');
    printPoliceNoticeByMCID(mcid);
}

function printPassportFromInput(inputId) {
    const person = findPerson(getValue(inputId));
    if (!person) return alert('Person not found.');
    printPassportByMCID(person.mcid);
}

function printCitizenIdFromInput(inputId) {
    const person = findPerson(getValue(inputId));
    if (!person) return alert('Person not found.');
    printCitizenIdByMCIDValue(person.mcid);
}

function printCitizenIdByMCID() {
    const mcid = getValue('manageMCID');
    printCitizenIdByMCIDValue(mcid);
}

function printWaterStatementFromInput(inputId) {
    const person = findPerson(getValue(inputId));
    if (!person) return alert('Person not found.');
    printWaterStatementByMCID(person.mcid);
}

function printTaxStatementFromInput(inputId) {
    const person = findPerson(getValue(inputId));
    if (!person) return alert('Person not found.');
    printTaxStatementByMCID(person.mcid);
}

function renderProfilePopupContent(mcid) {
    const person = appData.people[mcid];
    if (!person) {
        setHTML('profilePopupContent', '<p>Profile no longer exists.</p>');
        return;
    }

    const account = getPrimaryAccount(mcid);
    const entries = appData.entries.filter(row => row.mcid === mcid);
    const permits = appData.permits.filter(row => row.mcid === mcid);
    const accounts = appData.accounts.filter(row => row.mcid === mcid);
    const transactions = appData.transactions.filter(row => row.mcid === mcid).slice(0, 20);
    const waterConnections = appData.waterConnections.filter(row => row.mcid === mcid);
    const waterUsage = appData.waterUsage.filter(row => row.mcid === mcid).slice(0, 20);
    const taxes = appData.taxes.filter(row => row.mcid === mcid).slice(0, 20);
    const bills = appData.bills.filter(row => row.mcid === mcid).slice(0, 20);
    const felonies = appData.felonies.filter(row => row.mcid === mcid).slice(0, 20);
    const arrests = appData.arrests.filter(row => row.mcid === mcid).slice(0, 20);
    const bolos = appData.bolos.filter(row => row.mcid === mcid).slice(0, 20);
    const bans = appData.entryBans.filter(row => row.mcid === mcid).slice(0, 20);

    const mugshot = person.media?.mugshotData
        ? `<img src="${person.media.mugshotData}" alt="Mugshot" class="mugshot-preview">`
        : '<div class="mugshot-placeholder">No Mugshot</div>';

    const tableBlock = (title, head, rows) => `
        <div class="card">
            <h3 class="subheading mb-10">${title}</h3>
            ${rows.length
                ? `<table><thead>${head}</thead><tbody>${rows.join('')}</tbody></table>`
                : '<p>No linked records.</p>'}
        </div>
    `;

    setHTML('profilePopupContent', `
        <div class="profile-popup-grid">
            <div>${mugshot}</div>
            <div>
                <p><strong>MCID:</strong> ${escapeHtml(person.mcid)}</p>
                <p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.middleName || '')} ${escapeHtml(person.personal.lastName)}</p>
                <p><strong>Username:</strong> ${escapeHtml(person.personal.username || '-')}</p>
                <p><strong>DOB/Age:</strong> ${escapeHtml(person.personal.dob || '-')} / ${escapeHtml(String(person.personal.age ?? '-'))}</p>
                <p><strong>Gender:</strong> ${escapeHtml(person.personal.gender || '-')}</p>
                <p><strong>Marital Status:</strong> ${escapeHtml(person.personal.maritalStatus || '-')}</p>
                <p><strong>Nationality:</strong> ${escapeHtml(person.personal.nationality || '-')}</p>
                <p><strong>Occupation:</strong> ${escapeHtml(person.personal.occupation || '-')}</p>
                <p><strong>Employer:</strong> ${escapeHtml(person.personal.employer || '-')}</p>
                <p><strong>Education:</strong> ${escapeHtml(person.personal.educationLevel || '-')}</p>
                <p><strong>Blood/Allergies:</strong> ${escapeHtml(person.personal.bloodType || '-')} / ${escapeHtml(person.personal.allergies || '-')}</p>
                <p><strong>Criminal Notes:</strong> ${escapeHtml(person.personal.criminalRecord || '-')}</p>
                <p><strong>Emergency:</strong> ${escapeHtml(person.personal.emergencyName || '-')} (${escapeHtml(person.personal.emergencyRelation || '-')}) ${escapeHtml(person.personal.emergencyContact || '-')}</p>
                <p><strong>Mailing Address:</strong> ${escapeHtml(person.addresses.mailingAddress || '-')}</p>
                <p><strong>Residence Coordinates:</strong> ${escapeHtml(String(person.addresses.residenceX ?? '-'))}, ${escapeHtml(String(person.addresses.residenceY ?? '-'))}, ${escapeHtml(String(person.addresses.residenceZ ?? '-'))}</p>
                <p><strong>Permits Summary:</strong> ${escapeHtml(person.governance.permits || '-')}</p>
                <p><strong>Tax ID:</strong> ${escapeHtml(person.governance.taxId || '-')}</p>
                <p><strong>Skills:</strong> ${escapeHtml(person.governance.skills || '-')}</p>
                <p><strong>Notes:</strong> ${escapeHtml(person.governance.notes || '-')}</p>
                <p><strong>Primary Account:</strong> ${escapeHtml(account?.accountId || 'None')}</p>
            </div>
        </div>

        <div class="inline-row mt-15">
            <button onclick="printPassportByMCID('${escapeHtml(mcid)}')">Passport PDF</button>
            <button onclick="printCitizenIdByMCIDValue('${escapeHtml(mcid)}')">Citizen ID PDF</button>
            <button onclick="printCitizenProfileByMCID('${escapeHtml(mcid)}')">Profile PDF</button>
            <button onclick="printWaterStatementByMCID('${escapeHtml(mcid)}')">Water Statement PDF</button>
            <button onclick="printTaxStatementByMCID('${escapeHtml(mcid)}')">Tax Notice PDF</button>
        </div>

        ${tableBlock('Entries / Visas', '<tr><th>CPID</th><th>Date</th><th>Visa</th><th>Expiry</th><th>Status</th></tr>', entries.map(row => `<tr><td>${escapeHtml(row.cpid)}</td><td>${escapeHtml(row.entryDate || '-')}</td><td>${escapeHtml(row.visaType || '-')}</td><td>${escapeHtml(row.visaExpiry || '-')}</td><td>${escapeHtml(row.status || '-')}</td></tr>`))}
        ${tableBlock('Permits', '<tr><th>ID</th><th>Type</th><th>Valid From</th><th>Valid Until</th><th>Officer</th></tr>', permits.map(row => `<tr><td>${escapeHtml(row.permitId)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.validFrom || '-')}</td><td>${escapeHtml(row.validUntil || '-')}</td><td>${escapeHtml(row.officer || '-')}</td></tr>`))}
        ${tableBlock('Bank Accounts', '<tr><th>Account</th><th>Type</th><th>Balance</th><th>Status</th></tr>', accounts.map(row => `<tr><td>${escapeHtml(row.accountId)}</td><td>${escapeHtml(row.accountType || '-')}</td><td>${row.balance ?? 0}</td><td>${escapeHtml(row.status || '-')}</td></tr>`))}
        ${tableBlock('Transactions', '<tr><th>TX</th><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th></tr>', transactions.map(row => `<tr><td>${escapeHtml(row.txId)}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.type || '-')}</td><td>${row.amount ?? 0}</td><td>${row.balanceAfter ?? 0}</td></tr>`))}
        ${tableBlock('Water', '<tr><th>House</th><th>Connection</th><th>Last Usage</th><th>Charge</th></tr>', waterConnections.map(conn => {
            const usage = waterUsage.find(u => u.houseId === conn.houseId);
            return `<tr><td>${escapeHtml(conn.houseId)}</td><td>${escapeHtml(conn.connectionId)}</td><td>${escapeHtml(usage?.date || '-')}</td><td>${usage?.charge ?? 0}</td></tr>`;
        }))}
        ${tableBlock('Taxes', '<tr><th>ID</th><th>Date</th><th>Service</th><th>Amount</th><th>Status</th></tr>', taxes.map(row => `<tr><td>${escapeHtml(row.taxId)}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.service || '-')}</td><td>${row.amount ?? 0}</td><td>${escapeHtml(row.status || '-')}</td></tr>`))}
        ${tableBlock('Bills', '<tr><th>ID</th><th>Date</th><th>Category</th><th>Total</th><th>Status</th></tr>', bills.map(row => `<tr><td>${escapeHtml(row.billId)}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.category || '-')}</td><td>${row.total ?? 0}</td><td>${escapeHtml(row.status || '-')}</td></tr>`))}
        ${tableBlock('Police / NSD', '<tr><th>Type</th><th>ID</th><th>Status</th><th>Date</th><th>Notes</th></tr>', [
            ...felonies.map(row => `<tr><td>Felony</td><td>${escapeHtml(row.caseId)}</td><td>${escapeHtml(row.status || '-')}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.category || '-')}</td></tr>`),
            ...arrests.map(row => `<tr><td>Arrest</td><td>${escapeHtml(row.arrestId)}</td><td>Registered</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.charges || '-')}</td></tr>`),
            ...bolos.map(row => `<tr><td>BOLO</td><td>${escapeHtml(row.boloId)}</td><td>${escapeHtml(row.status || '-')}</td><td>${escapeHtml(row.date || '-')}</td><td>${escapeHtml(row.threat || '-')}</td></tr>`),
            ...bans.map(row => `<tr><td>Entry Ban</td><td>${escapeHtml(row.banId)}</td><td>${escapeHtml(row.status || '-')}</td><td>${escapeHtml(row.startDate || '-')}</td><td>${escapeHtml(row.reason || '-')}</td></tr>`)
        ])}
    `);
}

function openProfilePopup(mcid) {
    const person = appData.people[mcid];
    if (!person) return alert('Profile not found.');
    currentProfileMCID = mcid;
    renderProfilePopupContent(mcid);

    const popupWindow = document.querySelector('#profilePopup .profile-popup-inner.window');
    if (popupWindow) {
        const width = Math.min(820, Math.floor(window.innerWidth * 0.94));
        const height = Math.min(620, Math.floor(window.innerHeight * 0.86));
        popupWindow.style.left = `${Math.max(10, Math.floor((window.innerWidth - width) / 2))}px`;
        popupWindow.style.top = `${Math.max(10, Math.floor((window.innerHeight - height) / 2))}px`;
        popupWindow.style.width = `${width}px`;
        popupWindow.style.height = `${height}px`;
    }

    showNode('profilePopup');
}

function closeProfilePopup() {
    currentProfileMCID = '';
    hideNode('profilePopup');
}

function showSection(groupClass, id) {
    document.querySelectorAll(`.${groupClass}`).forEach(node => node.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
}

function showBorderSection(section) { showSection('border-section', `border${section.charAt(0).toUpperCase() + section.slice(1)}`); }
function showCitizenSection(section) { showSection('citizen-section', `citizen${section.charAt(0).toUpperCase() + section.slice(1)}`); }
function showWaterSection(section) { showSection('water-section', `water${section.charAt(0).toUpperCase() + section.slice(1)}`); }
function showTaxSection(section) { showSection('tax-section', `tax${section.charAt(0).toUpperCase() + section.slice(1)}`); }
function showBrowseSection(section) { showSection('browse-section', `browse${section.charAt(0).toUpperCase() + section.slice(1)}`); }
function showPoliceSection(section) { showSection('police-section', `police${section.charAt(0).toUpperCase() + section.slice(1)}`); }
function showBankingSection(section) {
    if (section === 'transactions') return showSection('banking-section', 'bankTransactions');
    if (section === 'credits') return showSection('banking-section', 'bankCredits');
    showSection('banking-section', `bank${section.charAt(0).toUpperCase() + section.slice(1)}`);
}

function profileButton(mcid) {
    return `<button onclick="openProfilePopup('${escapeHtml(mcid)}')">Open</button>`;
}

function getExpiryStatus(dateValue) {
    if (!dateValue) return { className: 'expiry-unknown', label: 'No Expiry', daysLeft: null };
    const now = new Date();
    const end = new Date(dateValue);
    if (Number.isNaN(end.getTime())) return { className: 'expiry-unknown', label: 'Unknown', daysLeft: null };

    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

    if (daysLeft < 0) return { className: 'expiry-expired', label: 'Expired', daysLeft };
    if (daysLeft <= 7) return { className: 'expiry-warning', label: `Expiring in ${daysLeft}d`, daysLeft };
    return { className: 'expiry-active', label: `Active (${daysLeft}d left)`, daysLeft };
}

function buildPermitVisaRows() {
    const permitRows = appData.permits.map(permit => ({
        group: 'Permit',
        id: permit.permitId,
        mcid: permit.mcid,
        type: permit.type,
        issued: permit.validFrom || permit.issuedAt?.slice(0, 10) || '-',
        expires: permit.validUntil || '',
        status: getExpiryStatus(permit.validUntil)
    }));

    const visaRows = appData.entries.map(entry => ({
        group: 'Visa',
        id: entry.cpid,
        mcid: entry.mcid,
        type: entry.visaType || 'Visa',
        issued: entry.entryDate || '-',
        expires: entry.visaExpiry || '',
        status: getExpiryStatus(entry.visaExpiry)
    }));

    return [...permitRows, ...visaRows].sort((a, b) => String(b.issued).localeCompare(String(a.issued)));
}

function generateExpiryNotifications() {
    const rows = buildPermitVisaRows().filter(row => row.status.className === 'expiry-expired' || row.status.className === 'expiry-warning');
    const now = Date.now();
    const keyed = new Map(appData.notifications.map(note => [note.sourceKey, note]));

    const next = rows.map(row => {
        const sourceKey = `${row.group}:${row.id}`;
        const existing = keyed.get(sourceKey);
        const statusLabel = row.status.label;
        const changed = existing && existing.statusLabel !== statusLabel;

        return {
            id: existing?.id || generateID('N', 6),
            sourceKey,
            mcid: row.mcid,
            title: `${row.group} Expiry Alert`,
            message: `${row.group} ${row.id} for ${row.mcid} is ${statusLabel}.`,
            statusLabel,
            expires: row.expires || '',
            daysLeft: row.status.daysLeft,
            createdAt: existing?.createdAt || new Date().toISOString(),
            snoozedUntil: changed ? '' : (existing?.snoozedUntil || ''),
            dismissed: changed ? false : Boolean(existing?.dismissed)
        };
    });

    appData.notifications = next;

    const unseen = appData.notifications.filter(note => {
        if (note.dismissed) return false;
        if (!note.snoozedUntil) return true;
        const due = new Date(note.snoozedUntil).getTime();
        return Number.isFinite(due) ? due <= now : true;
    }).length;

    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = String(unseen);
        badge.classList.toggle('hidden', unseen === 0);
    }
}

function renderNotificationCenter() {
    const node = document.getElementById('notificationList');
    if (!node) return;

    const now = Date.now();
    const rows = appData.notifications.filter(note => {
        if (note.dismissed) return false;
        if (!note.snoozedUntil) return true;
        const due = new Date(note.snoozedUntil).getTime();
        return Number.isFinite(due) ? due <= now : true;
    });

    if (!rows.length) {
        node.innerHTML = '<p>No notifications.</p>';
        return;
    }

    node.innerHTML = rows.map(note => `
        <div class="notification-item">
            <div>
                <strong>${escapeHtml(note.title)}</strong>
                <p>${escapeHtml(note.message)}</p>
                <p class="notification-meta">Expiry: ${escapeHtml(note.expires || '-')}</p>
            </div>
            <div class="inline-row">
                <button onclick="postponeNotification('${escapeHtml(note.id)}')">Postpone</button>
                <button onclick="deleteNotification('${escapeHtml(note.id)}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function toggleNotificationCenter() {
    const center = document.getElementById('notificationCenter');
    if (!center) return;
    center.classList.toggle('hidden');
    if (!center.classList.contains('hidden')) renderNotificationCenter();
}

function deleteNotification(notificationId) {
    const target = appData.notifications.find(note => note.id === notificationId);
    if (!target) return;
    target.dismissed = true;
    target.snoozedUntil = '';
    saveState();
    refreshAllViews();
}

function postponeNotification(notificationId) {
    const target = appData.notifications.find(note => note.id === notificationId);
    if (!target) return;
    const until = new Date();
    until.setDate(until.getDate() + 3);
    target.snoozedUntil = until.toISOString();
    saveState();
    refreshAllViews();
}

function clearAllNotifications() {
    appData.notifications.forEach(note => {
        note.dismissed = true;
        note.snoozedUntil = '';
    });
    saveState();
    refreshAllViews();
}

function renderEntryLogs() {
    const body = document.getElementById('entryLogsBody');
    if (!body) return;
    if (!appData.entries.length) {
        body.innerHTML = '<tr><td colspan="7">No customs records yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.entries.map(entry => `<tr><td>${escapeHtml(entry.cpid)}</td><td>${escapeHtml(entry.mcid)}</td><td>${escapeHtml(entry.fullName)}</td><td>${escapeHtml(entry.entryDate)}</td><td>${escapeHtml(entry.visaType)}</td><td>${escapeHtml(entry.status)}</td><td>${profileButton(entry.mcid)}</td></tr>`).join('');
}

function renderCitizenDirectory() {
    const body = document.getElementById('citizenDirectoryBody');
    if (!body) return;
    const people = Object.values(appData.people);
    if (!people.length) {
        body.innerHTML = '<tr><td colspan="6">No citizens yet.</td></tr>';
        return;
    }
    body.innerHTML = people.map(person => `<tr><td>${escapeHtml(person.mcid)}</td><td>${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</td><td>${escapeHtml(person.personal.dob || '-')}</td><td>${escapeHtml(person.personal.occupation || '-')}</td><td>${person.links.accounts.length}</td><td>${profileButton(person.mcid)}</td></tr>`).join('');
}

function renderTransactionLogs() {
    const body = document.getElementById('transactionLogBody');
    if (!body) return;
    if (!appData.transactions.length) {
        body.innerHTML = '<tr><td colspan="7">No transactions yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.transactions.slice(0, 100).map(tx => `<tr><td>${escapeHtml(tx.txId)}</td><td>${escapeHtml(tx.date)}</td><td>${escapeHtml(tx.mcid)}</td><td>${escapeHtml(tx.accountId)}</td><td>${escapeHtml(tx.type)}</td><td>${tx.amount}</td><td>${tx.balanceAfter}</td></tr>`).join('');
}

function renderCreditLogs() {
    const body = document.getElementById('creditLogBody');
    if (!body) return;
    if (!appData.credits.length) {
        body.innerHTML = '<tr><td colspan="7">No active credits.</td></tr>';
        return;
    }
    body.innerHTML = appData.credits.map(credit => `<tr><td>${escapeHtml(credit.creditId)}</td><td>${escapeHtml(credit.mcid)}</td><td>${escapeHtml(credit.accountId)}</td><td>${credit.principal}</td><td>${credit.rate}%</td><td>${credit.term}</td><td>${escapeHtml(credit.status)}</td></tr>`).join('');
}

function renderBankLogs() {
    const body = document.getElementById('bankEntryLogBody');
    if (!body) return;
    if (!appData.bankEntryLogs.length) {
        body.innerHTML = '<tr><td colspan="4">No bank entry logs yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.bankEntryLogs.slice(0, 50).map(log => `<tr><td>${escapeHtml(log.date)}</td><td>${escapeHtml(log.time)}</td><td>${escapeHtml(log.user)}</td><td>${escapeHtml(log.action)}</td></tr>`).join('');
}

function renderBankProduction() {
    const body = document.getElementById('bankProductionBody');
    if (!body) return;
    if (!appData.bankProduction.length) {
        body.innerHTML = '<tr><td colspan="4">No production entries. Add facility output.</td></tr>';
        return;
    }
    body.innerHTML = appData.bankProduction.map(row => `<tr><td>${escapeHtml(row.facility)}</td><td>${escapeHtml(row.resource)}</td><td>${row.quantity}</td><td>${escapeHtml(row.updated)}</td></tr>`).join('');
}

function renderPermitLogs() {
    const body = document.getElementById('permitLogBody');
    if (!body) return;
    if (!appData.permits.length) {
        body.innerHTML = '<tr><td colspan="6">No permits issued yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.permits.slice(0, 80).map(permit => {
        const expiry = getExpiryStatus(permit.validUntil);
        return `<tr class="${expiry.className}"><td>${escapeHtml(permit.permitId)}</td><td>${escapeHtml(permit.mcid)}</td><td>${escapeHtml(permit.type)}</td><td>${escapeHtml(permit.validUntil || '-')}</td><td>${escapeHtml(permit.officer || '-')}</td><td>${permit.fileName ? `<span>${escapeHtml(permit.fileName)}</span>` : '-'}</td></tr>`;
    }).join('');
}

function renderPermitVisaBrowser() {
    const body = document.getElementById('permitVisaBody');
    if (!body) return;

    const rows = buildPermitVisaRows();
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="8">No permits or visas yet.</td></tr>';
        return;
    }

    body.innerHTML = rows.slice(0, 180).map(row => `<tr class="${row.status.className}"><td>${escapeHtml(row.group)}</td><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.mcid)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.issued || '-')}</td><td>${escapeHtml(row.expires || '-')}</td><td>${escapeHtml(row.status.label)}</td><td>${appData.people[row.mcid] ? profileButton(row.mcid) : '-'}</td></tr>`).join('');
}

function renderExpiryNoticeBoard() {
    const rows = buildPermitVisaRows();
    const flagged = rows.filter(row => row.status.className === 'expiry-expired' || row.status.className === 'expiry-warning').slice(0, 8);

    const message = !flagged.length
        ? 'No permit/visa expiry alerts.'
        : flagged.map(row => `${row.group} ${row.id} (${row.mcid}) - ${row.status.label}`).join(' | ');

    setText('permitVisaNotice', message);
    setText('expiryNoticeBoard', message);
}

function renderWaterLogs() {
    const body = document.getElementById('waterLogsBody');
    if (!body) return;
    if (!appData.waterUsage.length) {
        body.innerHTML = '<tr><td colspan="6">No water usage records yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.waterUsage.map(row => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.mcid)}</td><td>${escapeHtml(row.houseId)}</td><td>${row.blocksUsed}</td><td>${row.charge}</td><td>${escapeHtml(row.txId || '-')}</td></tr>`).join('');
}

function renderTaxLogs() {
    const body = document.getElementById('taxLogsBody');
    if (!body) return;
    if (!appData.taxes.length) {
        body.innerHTML = '<tr><td colspan="6">No tax logs yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.taxes.map(tax => `<tr><td>${escapeHtml(tax.date)}</td><td>${escapeHtml(tax.mcid)}</td><td>${escapeHtml(tax.service)}</td><td>${tax.amount}</td><td>${escapeHtml(tax.status)}</td><td>${escapeHtml(tax.txId || '-')}</td></tr>`).join('');
}

function renderBillLogs() {
    const body = document.getElementById('billLogBody');
    if (!body) return;
    if (!appData.bills.length) {
        body.innerHTML = '<tr><td colspan="6">No bills issued yet.</td></tr>';
        return;
    }
    body.innerHTML = appData.bills.slice(0, 80).map(bill => `<tr><td>${escapeHtml(bill.billId)}</td><td>${escapeHtml(bill.mcid)}</td><td>${escapeHtml(bill.category)}</td><td>${bill.total}</td><td>${escapeHtml(bill.status)}</td><td><button onclick="printGovernmentBillById('${escapeHtml(bill.billId)}')">Print PDF</button></td></tr>`).join('');
}

function renderPoliceLogs() {
    const body = document.getElementById('policeLogBody');
    if (!body) return;

    const rows = [];
    appData.felonies.forEach(row => rows.push({ type: 'Felony', id: row.caseId, mcid: row.mcid, status: row.status, date: row.date || '-', profile: row.mcid }));
    appData.arrests.forEach(row => rows.push({ type: 'Arrest', id: row.arrestId, mcid: row.mcid, status: 'Registered', date: row.date || '-', profile: row.mcid }));
    appData.bolos.forEach(row => rows.push({ type: 'BOLO', id: row.boloId, mcid: row.mcid, status: row.status, date: row.date || '-', profile: row.mcid }));
    appData.entryBans.forEach(row => rows.push({ type: 'Entry Ban', id: row.banId, mcid: row.mcid, status: row.status, date: row.startDate || '-', profile: row.mcid }));

    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="6">No police records yet.</td></tr>';
        return;
    }

    body.innerHTML = rows.slice(0, 120).map(row => `<tr><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.mcid)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.date)}</td><td>${appData.people[row.profile] ? profileButton(row.profile) : '-'}</td></tr>`).join('');
}

function refreshDashboards() {
    const people = Object.values(appData.people);
    setText('customsTotalEntries', String(appData.entries.length));
    setText('customsActiveVisitors', String(appData.entries.filter(entry => entry.status === 'Active').length));
    setText('customsFlaggedCases', String(appData.entries.filter(entry => (entry.criminalDeclaration || '').trim() !== '').length));

    setText('citizenTotalCount', String(people.length));
    setText('citizenLinkedAccounts', String(people.reduce((sum, person) => sum + person.links.accounts.length, 0)));
    setText('citizenPermitCount', String(appData.permits.length));

    setText('bankHoldingsTotal', String(appData.accounts.reduce((sum, account) => sum + (account.balance || 0), 0)));
    setText('bankProductionTotal', String(appData.bankProduction.reduce((sum, row) => sum + (row.quantity || 0), 0)));
    setText('bankActiveCreditCount', String(appData.credits.filter(credit => credit.status === 'Active').length));

    setText('waterConnectedCount', String(appData.waterConnections.length));
    setText('waterBlocksTotal', String(appData.waterUsage.reduce((sum, row) => sum + row.blocksUsed, 0)));
    setText('waterChargesTotal', String(appData.waterUsage.reduce((sum, row) => sum + row.charge, 0)));

    setText('taxTotalCollected', String(appData.taxes.filter(tax => tax.status === 'Paid').reduce((sum, tax) => sum + tax.amount, 0)));
    setText('taxedCitizenCount', String(new Set(appData.taxes.map(tax => tax.mcid)).size));

    const activeFlags = appData.bolos.filter(row => row.status === 'Active').length + appData.entryBans.filter(row => row.status === 'Active').length;
    setText('policeFelonyCount', String(appData.felonies.length));
    setText('policeArrestCount', String(appData.arrests.length));
    setText('policeActiveFlagCount', String(activeFlags));
}

function refreshAllViews() {
    renderEntryLogs();
    renderCitizenDirectory();
    renderTransactionLogs();
    renderCreditLogs();
    renderBankLogs();
    renderBankProduction();
    renderPermitLogs();
    renderPermitVisaBrowser();
    renderWaterLogs();
    renderTaxLogs();
    renderBillLogs();
    renderPoliceLogs();
    refreshDashboards();
    renderExpiryNoticeBoard();
    generateExpiryNotifications();
    renderNotificationCenter();

    if (currentProfileMCID) {
        if (appData.people[currentProfileMCID]) {
            renderProfilePopupContent(currentProfileMCID);
        } else {
            closeProfilePopup();
        }
    }
}

async function createCitizen() {
    const mugshotInput = document.getElementById('citizenMugshot');
    let mugshotData = '';
    let mugshotName = '';

    if (mugshotInput?.files?.[0]) {
        mugshotName = mugshotInput.files[0].name;
        mugshotData = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(mugshotInput.files[0]);
        });
    }

    const payload = {
        mcid: getValue('citizenMCID'),
        firstName: getValue('citizenFirstName'),
        middleName: getValue('citizenMiddleName'),
        lastName: getValue('citizenLastName'),
        username: getValue('citizenUsername'),
        dob: getValue('citizenDob'),
        age: ageFromDob(getValue('citizenDob')),
        gender: getValue('citizenGender'),
        maritalStatus: getValue('citizenMaritalStatus'),
        nationality: getValue('citizenNationality'),
        occupation: getValue('citizenOccupation'),
        employer: getValue('citizenEmployer'),
        educationLevel: getValue('citizenEducationLevel'),
        bloodType: getValue('citizenBloodType'),
        allergies: getValue('citizenAllergies'),
        criminalRecord: getValue('citizenCriminalRecord'),
        emergencyName: getValue('citizenEmergencyName'),
        emergencyRelation: getValue('citizenEmergencyRelation'),
        emergencyContact: getValue('citizenEmergencyContact'),
        residenceX: getNumber('citizenX'),
        residenceY: getNumber('citizenY'),
        residenceZ: getNumber('citizenZ'),
        mailingAddress: getValue('citizenMailingAddress'),
        permits: getValue('citizenPermits'),
        taxId: getValue('citizenTaxId'),
        skills: getValue('citizenSkills'),
        notes: getValue('citizenNotes'),
        mugshotData,
        mugshotName
    };

    if (!payload.firstName || !payload.lastName) {
        alert('First name and surname are required.');
        return;
    }

    const mcid = ensurePersonRecord(payload);
    saveState();
    refreshAllViews();

    setText('mcidValue', mcid);
    showNode('mcidResult');
    clearFormFields('citizenCreate', { keep: ['citizenAge'] });
}

function registerEntry() {
    const payload = {
        mcid: getValue('entryMCID'),
        firstName: getValue('entryFirstName'),
        middleName: getValue('entryMiddleName'),
        lastName: getValue('entryLastName'),
        username: getValue('entryUsername'),
        dob: getValue('entryDob'),
        age: ageFromDob(getValue('entryDob')),
        gender: getValue('entryGender'),
        nationality: getValue('entryNationality'),
        emergencyName: getValue('entryEmergencyName'),
        emergencyRelation: getValue('entryEmergencyRelation'),
        emergencyContact: getValue('entryEmergencyContact')
    };

    if (!payload.mcid && !payload.firstName && !payload.username) {
        alert('Provide MCID or identity information.');
        return;
    }

    const mcid = ensurePersonRecord(payload);
    const cpid = generateID('CPID', 5);
    appData.entries.unshift({
        cpid,
        mcid,
        fullName: `${payload.firstName} ${payload.lastName}`.trim() || payload.username || 'Unknown',
        entryDate: new Date().toLocaleDateString(),
        entryDateISO: new Date().toISOString(),
        visaType: getValue('entryVisaType'),
        visaDurationDays: getNumber('entryVisaDuration') ?? 0,
        visaExpiry: (() => {
            const duration = getNumber('entryVisaDuration') ?? 0;
            if (duration <= 0) return '';
            const expires = new Date();
            expires.setDate(expires.getDate() + duration);
            return expires.toISOString().slice(0, 10);
        })(),
        status: 'Active',
        criminalDeclaration: getValue('entryCriminalDecl')
    });
    appData.people[mcid].links.entries.unshift(cpid);

    saveState();
    refreshAllViews();
    setText('cpidValue', `${cpid} linked to ${mcid}`);
    showNode('cpidResult');
    clearFormFields('borderRegister', { keep: ['entryAge'] });
}

function searchBorder() {
    const q = getValue('searchBorder').toLowerCase();
    const matches = appData.entries.filter(entry => entry.cpid.toLowerCase().includes(q) || entry.mcid.toLowerCase().includes(q) || entry.fullName.toLowerCase().includes(q));
    if (!matches.length) return setHTML('borderSearchResult', '<p>No result.</p>');
    setHTML('borderSearchResult', matches.map(entry => `${escapeHtml(entry.cpid)} | ${escapeHtml(entry.mcid)} | ${escapeHtml(entry.fullName)} ${profileButton(entry.mcid)}`).join('<br>'));
}

function quickSearchCustoms() {
    const q = getValue('borderQuickSearch').toLowerCase();
    const row = appData.entries.find(entry => entry.cpid.toLowerCase() === q || entry.mcid.toLowerCase() === q || entry.fullName.toLowerCase().includes(q));
    if (!row) return setText('borderQuickResult', 'No result found.');
    setHTML('borderQuickResult', `${escapeHtml(row.cpid)} | ${escapeHtml(row.mcid)} ${profileButton(row.mcid)}`);
}

function searchCitizen() {
    const q = getValue('searchCitizen').toLowerCase();
    const matches = Object.values(appData.people).filter(person => {
        const name = `${person.personal.firstName} ${person.personal.lastName}`.toLowerCase();
        return person.mcid.toLowerCase().includes(q) || name.includes(q) || (person.personal.username || '').toLowerCase().includes(q);
    });
    if (!matches.length) return setHTML('citizenSearchResult', '<p>No result.</p>');
    setHTML('citizenSearchResult', matches.map(person => `${escapeHtml(person.mcid)} | ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)} ${profileButton(person.mcid)}`).join('<br>'));
}

function quickSearchCitizen() {
    const person = findPerson(getValue('citizenQuickSearch'));
    if (!person) return setText('citizenQuickResult', 'No result found.');
    setHTML('citizenQuickResult', `${escapeHtml(person.mcid)} | ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)} ${profileButton(person.mcid)}`);
}

function loadCitizenForManagement() {
    const mcid = getValue('manageMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) {
        hideNode('manageProfile');
        return alert(validation.message);
    }
    const person = validation.person;
    setHTML('profileInfo', `<p><strong>Name:</strong> ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</p><p><strong>Occupation:</strong> ${escapeHtml(person.personal.occupation || '-')}</p><p><strong>Permits:</strong> ${escapeHtml(person.governance.permits || '-')}</p>${profileButton(mcid)}`);
    showNode('manageProfile');
}

function updatePermits() {
    const mcid = getValue('manageMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    const person = validation.person;
    person.governance.permits = getValue('managePermits');
    person.updatedAt = new Date().toISOString();
    saveState();
    refreshAllViews();
    loadCitizenForManagement();
    clearFormFields('citizenManage');
    hideNode('manageProfile');
}

function downloadTextFile(fileName, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function onPermitTypeChange() {
    const type = getValue('permitType');
    const panelMap = {
        'Work Permit': 'permitWorkPanel',
        'Hunt Permit': 'permitHuntPanel',
        'Build Permit': 'permitBuildPanel',
        'Land Use Permit': 'permitLandUsePanel',
        'Trade Permit': 'permitTradePanel',
        'Travel Permit': 'permitTravelPanel'
    };

    Object.values(panelMap).forEach(id => hideNode(id));
    const target = panelMap[type];
    if (target) showNode(target);
}

function getPermitTypePayload(type) {
    if (type === 'Work Permit') {
        const employer = getValue('permitWorkEmployer');
        const role = getValue('permitWorkRole');
        const site = getValue('permitWorkSite');
        if (!employer || !role || !site) {
            return { error: 'Work permit requires employer, role, and work site.' };
        }
        return {
            details: {
                employer,
                role,
                site,
                supervisor: getValue('permitWorkSupervisor'),
                workHours: getValue('permitWorkHours'),
                safetyConditions: getValue('permitWorkSafety')
            }
        };
    }

    if (type === 'Hunt Permit') {
        const sector = getValue('permitHuntSector');
        const species = getValue('permitHuntSpecies');
        const quota = getNumber('permitHuntQuota');
        if (!sector || !species || !quota || quota <= 0) {
            return { error: 'Hunt permit requires sector, species, and quota.' };
        }
        return {
            details: {
                sector,
                species,
                method: getValue('permitHuntMethod'),
                quota,
                timeWindow: getValue('permitHuntWindow'),
                restrictions: getValue('permitHuntRestrictions')
            }
        };
    }

    if (type === 'Build Permit') {
        const x = getValue('permitX');
        const y = getValue('permitY');
        const z = getValue('permitZ');
        const width = getValue('permitWidth');
        const length = getValue('permitLength');
        const height = getValue('permitHeight');
        const changes = getValue('permitChanges');
        if (!x || !y || !z || !width || !length || !height || !changes) {
            return { error: 'Build permit requires coordinates, dimensions, and planned changes.' };
        }
        return {
            details: {
                x,
                y,
                z,
                width,
                length,
                height,
                changes,
                materials: getValue('permitMaterials')
            }
        };
    }

    if (type === 'Land Use Permit') {
        const parcelId = getValue('permitLandParcel');
        const purpose = getValue('permitLandPurpose');
        const area = getNumber('permitLandArea');
        if (!parcelId || !purpose || !area || area <= 0) {
            return { error: 'Land use permit requires parcel ID, purpose, and area.' };
        }
        return {
            details: {
                parcelId,
                purpose,
                area,
                region: getValue('permitLandRegion'),
                restrictions: getValue('permitLandRestrictions')
            }
        };
    }

    if (type === 'Trade Permit') {
        const goods = getValue('permitTradeGoods');
        const route = getValue('permitTradeRoute');
        const volume = getNumber('permitTradeVolume');
        if (!goods || !route || !volume || volume <= 0) {
            return { error: 'Trade permit requires goods, route, and daily volume.' };
        }
        return {
            details: {
                goods,
                route,
                dailyVolume: volume,
                licenseNumber: getValue('permitTradeLicense'),
                partners: getValue('permitTradePartners')
            }
        };
    }

    if (type === 'Travel Permit') {
        const destination = getValue('permitTravelDestination');
        const purpose = getValue('permitTravelPurpose');
        const returnDate = getValue('permitTravelReturn');
        if (!destination || !purpose || !returnDate) {
            return { error: 'Travel permit requires destination, purpose, and return date.' };
        }
        return {
            details: {
                destination,
                purpose,
                transportMode: getValue('permitTravelMode'),
                returnDate,
                companions: getValue('permitTravelCompanions')
            }
        };
    }

    return { details: {} };
}

function issuePermit() {
    const mcid = getValue('permitMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) {
        setText('permitIssueResult', validation.message);
        return;
    }
    const person = validation.person;

    const permitType = getValue('permitType');
    const typePayload = getPermitTypePayload(permitType);
    if (typePayload.error) {
        setText('permitIssueResult', typePayload.error);
        return;
    }

    const permit = {
        permitId: generateID('PRM', 5),
        mcid,
        type: permitType,
        department: getValue('permitDepartment'),
        officer: getValue('permitOfficer'),
        validFrom: getValue('permitValidFrom'),
        validUntil: getValue('permitValidUntil'),
        cost: getNumber('permitCost') ?? 0,
        details: typePayload.details,
        notes: getValue('permitNotes'),
        issuedAt: new Date().toISOString(),
        fileName: ''
    };

    if (permit.type === 'Build Permit') {
        const fileName = `${permit.permitId}-building-permit.txt`;
        permit.fileName = fileName;
        const content = [
            'MINECRAFT GOVERNMENT - BUILDING PERMIT FILE',
            `Permit ID: ${permit.permitId}`,
            `MCID: ${permit.mcid}`,
            `Citizen: ${person.personal.firstName} ${person.personal.lastName}`,
            `Department: ${permit.department}`,
            `Officer: ${permit.officer}`,
            `Valid: ${permit.validFrom} -> ${permit.validUntil}`,
            `Coordinates: ${permit.details.x}, ${permit.details.y}, ${permit.details.z}`,
            `Current Measures (W x L x H): ${permit.details.width} x ${permit.details.length} x ${permit.details.height}`,
            `Planned Changes: ${permit.details.changes}`,
            `Materials/Safety: ${permit.details.materials}`,
            `Estimated Cost: ${permit.cost} Gold Nuggets`,
            `Notes: ${permit.notes}`
        ].join('\n');
        downloadTextFile(fileName, content);
    }

    appData.permits.unshift(permit);
    appData.people[mcid].links.permits.unshift(permit.permitId);
    appData.people[mcid].governance.permits = appData.people[mcid].governance.permits
        ? `${appData.people[mcid].governance.permits}; ${permit.type}(${permit.permitId})`
        : `${permit.type}(${permit.permitId})`;

    saveState();
    refreshAllViews();
    setText('permitIssueResult', `Issued ${permit.type} as ${permit.permitId}${permit.fileName ? ` (file: ${permit.fileName})` : ''}.`);
    clearFormFields('citizenPermitIssue');
}

function removeLinkedDataByMCID(mcid) {
    delete appData.people[mcid];
    appData.entries = appData.entries.filter(entry => entry.mcid !== mcid);
    appData.accounts = appData.accounts.filter(account => account.mcid !== mcid);
    appData.transactions = appData.transactions.filter(tx => tx.mcid !== mcid);
    appData.credits = appData.credits.filter(credit => credit.mcid !== mcid);
    appData.permits = appData.permits.filter(permit => permit.mcid !== mcid);
    appData.waterConnections = appData.waterConnections.filter(row => row.mcid !== mcid);
    appData.waterUsage = appData.waterUsage.filter(row => row.mcid !== mcid);
    appData.taxes = appData.taxes.filter(row => row.mcid !== mcid);
    appData.bills = appData.bills.filter(row => row.mcid !== mcid);
    appData.felonies = appData.felonies.filter(row => row.mcid !== mcid);
    appData.arrests = appData.arrests.filter(row => row.mcid !== mcid);
    appData.bolos = appData.bolos.filter(row => row.mcid !== mcid);
    appData.entryBans = appData.entryBans.filter(row => row.mcid !== mcid);
    appData.notifications = appData.notifications.filter(row => row.mcid !== mcid);

    if (currentProfileMCID === mcid) {
        closeProfilePopup();
    }
}

function deleteCitizen() {
    const mcid = getValue('manageMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    if (!confirm(`Delete ${mcid} and all linked data?`)) return;
    removeLinkedDataByMCID(mcid);
    saveState();
    refreshAllViews();
    hideNode('manageProfile');
}

function deleteCustomsDataByUser() {
    const mcid = getValue('borderDeleteMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    if (!confirm(`Delete linked data for ${mcid}?`)) return;
    removeLinkedDataByMCID(mcid);
    saveState();
    refreshAllViews();
    setText('borderAdminResult', `Deleted linked data for ${mcid}.`);
}

function deleteCitizenDataByUser() {
    const mcid = getValue('citizenDeleteMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    if (!confirm(`Delete linked data for ${mcid}?`)) return;
    removeLinkedDataByMCID(mcid);
    saveState();
    refreshAllViews();
    setText('citizenAdminResult', `Deleted linked data for ${mcid}.`);
}

function deleteAllGovernmentData() {
    if (getValue('globalDeleteConfirm') !== 'DELETE ALL') return alert('Type DELETE ALL to confirm.');
    if (!confirm('Delete all data permanently?')) return;
    appData.people = {};
    appData.entries = [];
    appData.accounts = [];
    appData.transactions = [];
    appData.credits = [];
    appData.permits = [];
    appData.waterConnections = [];
    appData.waterUsage = [];
    appData.taxes = [];
    appData.bills = [];
    appData.felonies = [];
    appData.arrests = [];
    appData.bolos = [];
    appData.entryBans = [];
    appData.notifications = [];
    appData.bankEntryLogs = [];
    appData.bankProduction = [];
    if (currentProfileMCID) closeProfilePopup();
    saveState();
    refreshAllViews();
    setText('globalAdminResult', 'All data removed.');
}

function registerBankEntryLog(user, action) {
    const now = new Date();
    appData.bankEntryLogs.unshift({
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        user,
        action
    });
    appData.bankEntryLogs = appData.bankEntryLogs.slice(0, 100);
}

function createAccount() {
    const mcid = getValue('bankMCID');
    if (verificationState.bank !== mcid) {
        return alert('MCID not verified. Use verification module first.');
    }
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    const person = validation.person;

    const account = {
        accountId: generateID('ACC', 5),
        mcid,
        holderName: `${person.personal.firstName} ${person.personal.lastName}`.trim(),
        accountType: getValue('bankAccountType') || 'Savings',
        currency: getValue('bankCurrency') || 'Gold Nuggets',
        balance: getNumber('bankInitialDeposit') ?? 0,
        status: 'Active',
        createdDate: new Date().toLocaleDateString(),
        incomeSource: getValue('bankIncomeSource'),
        monthlyIncome: getNumber('bankMonthlyIncome') ?? 0,
        kycIdType: getValue('bankKycIdType'),
        kycIdNumber: getValue('bankKycIdNumber')
    };

    appData.accounts.unshift(account);
    person.links.accounts.unshift(account.accountId);
    registerBankEntryLog('Bank Officer', `Created account ${account.accountId}`);

    saveState();
    refreshAllViews();
    showNode('bankCreateResultWrap');
    setText('bankCreateResult', `Created ${account.accountId} for ${account.holderName}.`);
    clearFormFields('bankAccount');
}

function processTransaction() {
    const accountId = getValue('transactionAccount');
    const type = getValue('transactionType');
    const amount = getNumber('transactionAmount') ?? 0;
    const account = appData.accounts.find(a => a.accountId === accountId);
    if (!account) return alert('Account not found.');
    if (amount <= 0) return alert('Amount must be > 0.');
    if (type === 'Withdraw' && amount > account.balance) return alert('Insufficient funds.');

    if (type === 'Deposit') account.balance += amount;
    if (type === 'Withdraw') account.balance -= amount;

    appData.transactions.unshift({
        txId: generateID('TX', 6),
        date: new Date().toLocaleDateString(),
        mcid: account.mcid,
        accountId: account.accountId,
        type,
        amount,
        balanceAfter: account.balance
    });

    registerBankEntryLog('Teller', `${type} ${amount} on ${account.accountId}`);
    saveState();
    refreshAllViews();
    clearFormFields('bankTransactions');
}

function issueCredit() {
    const accountId = getValue('creditAccount');
    const account = appData.accounts.find(a => a.accountId === accountId);
    if (!account) return alert('Account not found.');

    appData.credits.unshift({
        creditId: generateID('CR', 5),
        accountId,
        mcid: account.mcid,
        principal: getNumber('creditAmount') ?? 0,
        rate: getNumber('creditRate') ?? 0,
        term: getNumber('creditTerm') ?? 0,
        status: 'Active'
    });

    saveState();
    refreshAllViews();
    clearFormFields('bankCredits');
}

function addBankProductionRecord() {
    const facility = getValue('bankProdFacility');
    const resource = getValue('bankProdResource');
    const quantity = getNumber('bankProdQuantity') ?? 0;
    const updated = getValue('bankProdDate') || new Date().toLocaleDateString();

    if (!facility || !resource) {
        setText('bankProdResult', 'Facility and resource are required.');
        return;
    }

    appData.bankProduction.unshift({ facility, resource, quantity, updated });
    saveState();
    refreshAllViews();
    setText('bankProdResult', `Registered production: ${facility} / ${resource} / ${quantity}.`);
}

function quickSearchBanking() {
    const q = getValue('bankQuickSearch');
    const person = findPerson(q);
    let account = appData.accounts.find(a => a.accountId.toLowerCase() === q.toLowerCase());
    if (!account && person) account = getPrimaryAccount(person.mcid);
    if (!account) return setText('bankQuickResult', 'No profile/account found.');
    setHTML('bankQuickResult', `${escapeHtml(account.accountId)} | ${escapeHtml(account.mcid)} | Balance: ${account.balance} ${profileButton(account.mcid)}`);
}

function debitLinkedAccount(mcid, amount, reason) {
    const account = getPrimaryAccount(mcid);
    if (!account) return { ok: false, reason: 'No active account' };
    if (amount > account.balance) return { ok: false, reason: 'Insufficient funds' };

    account.balance -= amount;
    const txId = generateID('TX', 6);
    appData.transactions.unshift({
        txId,
        date: new Date().toLocaleDateString(),
        mcid,
        accountId: account.accountId,
        type: reason,
        amount,
        balanceAfter: account.balance
    });
    return { ok: true, txId };
}

function registerWaterConnection() {
    const mcid = getValue('waterMCID');
    if (verificationState.water !== mcid) {
        return alert('MCID not verified. Use verification module first.');
    }
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);

    const connection = {
        connectionId: generateID('WCON', 5),
        mcid,
        houseId: getValue('waterHouseId') || generateID('HOUSE', 4),
        houseLabel: getValue('waterHouseLabel'),
        street: getValue('waterStreet'),
        connectionType: getValue('waterConnectionType'),
        meterId: getValue('waterMeterId') || generateID('MTR', 4),
        x: getValue('waterX'),
        y: getValue('waterY'),
        z: getValue('waterZ'),
        status: 'Active'
    };

    appData.waterConnections.unshift(connection);
    appData.people[mcid].links.waterConnections.unshift(connection.connectionId);
    saveState();
    refreshAllViews();
    clearFormFields('waterRegister');
}

function registerWaterUsage() {
    const mcid = getValue('waterUsageMCID');
    const houseId = getValue('waterUsageHouseId');
    const blocksUsed = getNumber('waterBlocksUsed') ?? 0;
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    if (blocksUsed <= 0) return alert('Blocks used must be > 0.');

    const charge = blocksUsed;
    const debit = debitLinkedAccount(mcid, charge, 'Water Charge');
    if (!debit.ok) {
        setText('waterUsageResult', `Charge failed: ${debit.reason}`);
        return;
    }

    appData.waterUsage.unshift({
        usageId: generateID('WUSE', 5),
        date: new Date().toLocaleDateString(),
        mcid,
        houseId,
        blocksUsed,
        charge,
        txId: debit.txId
    });

    saveState();
    refreshAllViews();
    setText('waterUsageResult', `Charged ${charge} gold nuggets. TX: ${debit.txId}`);
    clearFormFields('waterUsage');
}

function quickSearchWater() {
    const q = getValue('waterQuickSearch').toLowerCase();
    const row = appData.waterConnections.find(c => c.mcid.toLowerCase() === q || c.houseId.toLowerCase() === q || c.meterId.toLowerCase() === q);
    if (!row) return setText('waterQuickResult', 'No connection found.');
    setHTML('waterQuickResult', `${escapeHtml(row.connectionId)} | ${escapeHtml(row.mcid)} | ${escapeHtml(row.houseId)} ${profileButton(row.mcid)}`);
}

function applyTaxCharge(mcid, service, amount, notes = '') {
    if (!appData.people[mcid]) return { ok: false, reason: 'MCID not found' };
    const debit = debitLinkedAccount(mcid, amount, `Tax: ${service}`);
    if (!debit.ok) return debit;

    const tax = {
        taxId: generateID('TAX', 5),
        date: new Date().toLocaleDateString(),
        mcid,
        service,
        amount,
        notes,
        status: 'Paid',
        txId: debit.txId
    };

    appData.taxes.unshift(tax);
    appData.people[mcid].links.taxes.unshift(tax.taxId);
    return { ok: true, txId: debit.txId };
}

function applyManualTax() {
    const mcid = getValue('taxManualMCID');
    const service = getValue('taxManualService');
    const amount = getNumber('taxManualAmount') ?? 0;
    const notes = getValue('taxManualNotes');

    if (!mcid || amount <= 0) return alert('MCID and amount are required.');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('taxManualResult', validation.message);
    const result = applyTaxCharge(mcid, service, amount, notes);
    if (!result.ok) return setText('taxManualResult', `Tax failed: ${result.reason}`);

    saveState();
    refreshAllViews();
    setText('taxManualResult', `Tax paid. TX: ${result.txId}`);
    setText('taxLastRun', new Date().toLocaleString());
    clearFormFields('taxManual');
}

function runAutomaticTax() {
    const med = getNumber('taxAutoMedcare') ?? 0;
    const rep = getNumber('taxAutoRepat') ?? 0;
    const sec = getNumber('taxAutoSecurity') ?? 0;
    const street = getNumber('taxAutoStreet') ?? 0;
    const other = getNumber('taxAutoOther') ?? 0;
    const total = med + rep + sec + street + other;
    if (total <= 0) return setText('taxAutoResult', 'Total fee is 0.');

    let success = 0;
    let fail = 0;
    Object.values(appData.people).forEach(person => {
        const result = applyTaxCharge(person.mcid, 'Auto Services Bundle', total, `Med:${med} Rep:${rep} Sec:${sec} Street:${street} Other:${other}`);
        if (result.ok) success += 1;
        else fail += 1;
    });

    saveState();
    refreshAllViews();
    setText('taxAutoResult', `Auto tax done. Success ${success}, Fail ${fail}.`);
    setText('taxLastRun', new Date().toLocaleString());
    clearFormFields('taxAuto');
}

function issueGovernmentBill() {
    const mcid = getValue('billMCID');
    if (verificationState.bill !== mcid) {
        return alert('MCID not verified. Use verification module first.');
    }
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return alert(validation.message);
    const person = validation.person;

    const baseFee = getNumber('billBaseFee') ?? 0;
    const laborFee = getNumber('billLaborFee') ?? 0;
    const materialFee = getNumber('billMaterialFee') ?? 0;
    const penaltyFee = getNumber('billPenaltyFee') ?? 0;
    const discount = getNumber('billDiscount') ?? 0;
    const total = Math.max(0, baseFee + laborFee + materialFee + penaltyFee - discount);

    const bill = {
        billId: generateID('BILL', 5),
        date: new Date().toLocaleDateString(),
        mcid,
        department: getValue('billDepartment'),
        category: getValue('billCategory'),
        priority: getValue('billPriority'),
        caseId: getValue('billCaseId'),
        dueDate: getValue('billDueDate'),
        baseFee,
        laborFee,
        materialFee,
        penaltyFee,
        discount,
        total,
        description: getValue('billDescription'),
        legalNotes: getValue('billLegalNotes'),
        status: 'Issued',
        txId: ''
    };

    if (getValue('billAutoDeduct') === 'Yes') {
        const debit = debitLinkedAccount(mcid, total, `Government Bill ${bill.billId}`);
        if (debit.ok) {
            bill.status = 'Paid';
            bill.txId = debit.txId;
        } else {
            bill.status = `Issued - Payment Pending (${debit.reason})`;
        }
    }

    appData.bills.unshift(bill);
    person.links.bills.unshift(bill.billId);
    saveState();
    refreshAllViews();
    setText('billIssueResult', `Issued ${bill.billId} total ${bill.total} (${bill.status}).`);
    clearFormFields('taxBills');
}

function quickSearchTax() {
    const person = findPerson(getValue('taxQuickSearch'));
    if (!person) return setText('taxQuickResult', 'No result found.');
    const total = appData.taxes.filter(t => t.mcid === person.mcid).reduce((sum, t) => sum + t.amount, 0);
    setHTML('taxQuickResult', `${escapeHtml(person.mcid)} | ${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)} | Paid ${total} ${profileButton(person.mcid)}`);
}

function registerFelony() {
    const mcid = getValue('policeFelonyMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('policeFelonyResult', validation.message);
    const person = validation.person;

    const caseId = getValue('policeFelonyCaseId') || generateID('NSD-CASE', 4);
    const record = {
        caseId,
        mcid,
        category: getValue('policeFelonyCategory') || 'Other',
        severity: getValue('policeFelonySeverity') || 'Low',
        location: getValue('policeFelonyLocation') || '',
        date: getValue('policeFelonyDate') || new Date().toLocaleDateString(),
        officer: getValue('policeFelonyOfficer') || '',
        status: getValue('policeFelonyStatus') || 'Open',
        description: getValue('policeFelonyDesc') || '',
        evidence: getValue('policeFelonyEvidence') || '',
        createdAt: new Date().toISOString()
    };

    appData.felonies.unshift(record);
    person.links.policeCases.unshift(caseId);
    person.updatedAt = new Date().toISOString();

    saveState();
    refreshAllViews();
    setText('policeFelonyResult', `Felony case ${caseId} registered for ${mcid}.`);
    clearFormFields('policeFelony');
}

function registerArrest() {
    const mcid = getValue('policeArrestMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('policeArrestResult', validation.message);
    const person = validation.person;

    const arrestId = getValue('policeArrestId') || generateID('ARR', 5);
    const caseId = getValue('policeArrestCaseId') || '';
    const record = {
        arrestId,
        caseId,
        mcid,
        date: getValue('policeArrestDate') || new Date().toLocaleDateString(),
        location: getValue('policeArrestLocation') || '',
        officer: getValue('policeArrestOfficer') || '',
        facility: getValue('policeArrestFacility') || '',
        bail: getNumber('policeArrestBail') ?? 0,
        charges: getValue('policeArrestCharges') || '',
        createdAt: new Date().toISOString()
    };

    appData.arrests.unshift(record);
    person.links.policeCases.unshift(arrestId);
    person.updatedAt = new Date().toISOString();

    saveState();
    refreshAllViews();
    setText('policeArrestResult', `Arrest ${arrestId} registered for ${mcid}.`);
    clearFormFields('policeArrest');
}

function registerBolo() {
    const mcid = getValue('policeBoloMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('policeBoloResult', validation.message);
    const person = validation.person;

    const boloId = getValue('policeBoloId') || generateID('BOLO', 5);
    const record = {
        boloId,
        mcid,
        threat: getValue('policeBoloThreat') || 'Low',
        location: getValue('policeBoloLocation') || '',
        date: getValue('policeBoloDate') || new Date().toLocaleDateString(),
        officer: getValue('policeBoloOfficer') || '',
        description: getValue('policeBoloDesc') || '',
        status: 'Active',
        createdAt: new Date().toISOString()
    };

    appData.bolos.unshift(record);
    person.links.policeCases.unshift(boloId);
    person.updatedAt = new Date().toISOString();

    saveState();
    refreshAllViews();
    setText('policeBoloResult', `BOLO ${boloId} issued for ${mcid}.`);
    clearFormFields('policeBolo');
}

function registerEntryBan() {
    const mcid = getValue('policeBanMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('policeBanResult', validation.message);
    const person = validation.person;

    const type = getValue('policeBanType') || 'Temporary';
    const banId = getValue('policeBanId') || generateID('BAN', 5);
    const record = {
        banId,
        mcid,
        type,
        startDate: getValue('policeBanStart') || new Date().toLocaleDateString(),
        endDate: type === 'Temporary' ? getValue('policeBanEnd') : '',
        officer: getValue('policeBanOfficer') || '',
        reason: getValue('policeBanReason') || '',
        status: 'Active',
        createdAt: new Date().toISOString()
    };

    appData.entryBans.unshift(record);
    person.links.policeCases.unshift(banId);
    person.updatedAt = new Date().toISOString();

    saveState();
    refreshAllViews();
    setText('policeBanResult', `Entry ban ${banId} registered for ${mcid}.`);
    clearFormFields('policeBan');
}

function searchPoliceRecords() {
    const query = getValue('policeSearchInput').toLowerCase();
    if (!query) {
        setHTML('policeSearchResult', '<p>Enter MCID, case, arrest, BOLO, or ban ID.</p>');
        return;
    }

    const felonyMatches = appData.felonies.filter(row => row.mcid.toLowerCase().includes(query) || row.caseId.toLowerCase().includes(query) || row.category.toLowerCase().includes(query));
    const arrestMatches = appData.arrests.filter(row => row.mcid.toLowerCase().includes(query) || (row.arrestId || '').toLowerCase().includes(query) || (row.caseId || '').toLowerCase().includes(query));
    const boloMatches = appData.bolos.filter(row => row.mcid.toLowerCase().includes(query) || row.boloId.toLowerCase().includes(query) || row.location.toLowerCase().includes(query));
    const banMatches = appData.entryBans.filter(row => row.mcid.toLowerCase().includes(query) || row.banId.toLowerCase().includes(query) || row.reason.toLowerCase().includes(query));

    const lines = [
        ...felonyMatches.map(row => `Felony ${escapeHtml(row.caseId)} | ${escapeHtml(row.mcid)} | ${escapeHtml(row.status)} ${appData.people[row.mcid] ? profileButton(row.mcid) : ''}`),
        ...arrestMatches.map(row => `Arrest ${escapeHtml(row.arrestId)} | ${escapeHtml(row.mcid)} ${appData.people[row.mcid] ? profileButton(row.mcid) : ''}`),
        ...boloMatches.map(row => `BOLO ${escapeHtml(row.boloId)} | ${escapeHtml(row.mcid)} | ${escapeHtml(row.threat)} ${appData.people[row.mcid] ? profileButton(row.mcid) : ''}`),
        ...banMatches.map(row => `Ban ${escapeHtml(row.banId)} | ${escapeHtml(row.mcid)} | ${escapeHtml(row.type)} ${appData.people[row.mcid] ? profileButton(row.mcid) : ''}`)
    ];

    if (!lines.length) {
        setHTML('policeSearchResult', '<p>No police records matched.</p>');
        return;
    }
    setHTML('policeSearchResult', lines.join('<br>'));
}

function quickSearchPolice() {
    const query = getValue('policeQuickSearch').toLowerCase();
    if (!query) return setText('policeQuickResult', 'Enter MCID, case id, or name.');

    let person = findPerson(query);
    if (!person) {
        const matched = appData.felonies.find(row => row.caseId.toLowerCase() === query)
            || appData.arrests.find(row => (row.arrestId || '').toLowerCase() === query || (row.caseId || '').toLowerCase() === query)
            || appData.bolos.find(row => row.boloId.toLowerCase() === query)
            || appData.entryBans.find(row => row.banId.toLowerCase() === query);
        if (matched) person = appData.people[matched.mcid] || null;
    }

    if (!person) return setText('policeQuickResult', 'No profile or case found.');

    const openFelonies = appData.felonies.filter(row => row.mcid === person.mcid && row.status !== 'Closed').length;
    const activeBolos = appData.bolos.filter(row => row.mcid === person.mcid && row.status === 'Active').length;
    const activeBans = appData.entryBans.filter(row => row.mcid === person.mcid && row.status === 'Active').length;
    setHTML('policeQuickResult', `${escapeHtml(person.mcid)} | Open Felonies: ${openFelonies} | Active BOLO: ${activeBolos} | Active Ban: ${activeBans} ${profileButton(person.mcid)}`);
}

function advancedSearchProfiles() {
    const fMcid = getValue('browseFilterMCID').toLowerCase();
    const fName = getValue('browseFilterName').toLowerCase();
    const fOccupation = getValue('browseFilterOccupation').toLowerCase();
    const fNationality = getValue('browseFilterNationality').toLowerCase();
    const fHasAccount = getValue('browseFilterHasAccount');
    const fMinAccounts = getNumber('browseFilterMinAccounts') ?? 0;
    const fPermit = getValue('browseFilterPermit').toLowerCase();
    const fTaxId = getValue('browseFilterTaxId').toLowerCase();

    const rows = Object.values(appData.people).filter(person => {
        const name = `${person.personal.firstName} ${person.personal.lastName}`.toLowerCase();
        const occupation = (person.personal.occupation || '').toLowerCase();
        const nationality = (person.personal.nationality || '').toLowerCase();
        const permit = (person.governance.permits || '').toLowerCase();
        const taxId = (person.governance.taxId || '').toLowerCase();
        const accountCount = person.links.accounts.length;

        if (fMcid && !person.mcid.toLowerCase().includes(fMcid)) return false;
        if (fName && !name.includes(fName)) return false;
        if (fOccupation && !occupation.includes(fOccupation)) return false;
        if (fNationality && !nationality.includes(fNationality)) return false;
        if (fPermit && !permit.includes(fPermit)) return false;
        if (fTaxId && !taxId.includes(fTaxId)) return false;
        if (fHasAccount === 'yes' && accountCount === 0) return false;
        if (fHasAccount === 'no' && accountCount > 0) return false;
        if (accountCount < fMinAccounts) return false;
        return true;
    });

    const body = document.getElementById('browseSearchBody');
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="7">No profile matched filters.</td></tr>';
        return;
    }

    body.innerHTML = rows.map(person => `<tr><td>${escapeHtml(person.mcid)}</td><td>${escapeHtml(person.personal.firstName)} ${escapeHtml(person.personal.lastName)}</td><td>${escapeHtml(person.personal.occupation || '-')}</td><td>${escapeHtml(person.personal.nationality || '-')}</td><td>${person.links.accounts.length}</td><td><button onclick="openProfilePopup('${escapeHtml(person.mcid)}')">Open</button></td><td><button onclick="loadProfileToUpdate('${escapeHtml(person.mcid)}')">Edit</button></td></tr>`).join('');
}

function loadProfileToUpdate(mcid) {
    document.getElementById('browseUpdateMCID').value = mcid;
    loadProfileForUpdate();
    showBrowseSection('update');
}

function loadProfileForUpdate() {
    const mcid = getValue('browseUpdateMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('browseUpdateResult', validation.message);
    const person = validation.person;
    document.getElementById('browseUpdateFirstName').value = person.personal.firstName || '';
    document.getElementById('browseUpdateMiddleName').value = person.personal.middleName || '';
    document.getElementById('browseUpdateLastName').value = person.personal.lastName || '';
    document.getElementById('browseUpdateUsername').value = person.personal.username || '';
    document.getElementById('browseUpdateDOB').value = person.personal.dob || '';
    document.getElementById('browseUpdateAge').value = person.personal.age ?? '';
    document.getElementById('browseUpdateGender').value = person.personal.gender || '';
    document.getElementById('browseUpdateNationality').value = person.personal.nationality || '';
    document.getElementById('browseUpdateMaritalStatus').value = person.personal.maritalStatus || '';
    document.getElementById('browseUpdateOccupation').value = person.personal.occupation || '';
    document.getElementById('browseUpdateEmployer').value = person.personal.employer || '';
    document.getElementById('browseUpdateEducationLevel').value = person.personal.educationLevel || '';
    document.getElementById('browseUpdateBloodType').value = person.personal.bloodType || '';
    document.getElementById('browseUpdateAllergies').value = person.personal.allergies || '';
    document.getElementById('browseUpdateCriminalRecord').value = person.personal.criminalRecord || '';
    document.getElementById('browseUpdateEmergencyName').value = person.personal.emergencyName || '';
    document.getElementById('browseUpdateEmergencyRelation').value = person.personal.emergencyRelation || '';
    document.getElementById('browseUpdateEmergencyContact').value = person.personal.emergencyContact || '';
    document.getElementById('browseUpdatePermits').value = person.governance.permits || '';
    document.getElementById('browseUpdateAddress').value = person.addresses.mailingAddress || '';
    document.getElementById('browseUpdateResidenceX').value = person.addresses.residenceX ?? '';
    document.getElementById('browseUpdateResidenceY').value = person.addresses.residenceY ?? '';
    document.getElementById('browseUpdateResidenceZ').value = person.addresses.residenceZ ?? '';
    document.getElementById('browseUpdateTaxId').value = person.governance.taxId || '';
    document.getElementById('browseUpdateSkills').value = person.governance.skills || '';
    document.getElementById('browseUpdateNotes').value = person.governance.notes || '';
    setText('browseUpdateResult', `Loaded ${mcid}.`);
}

function applyProfileUpdate() {
    const mcid = getValue('browseUpdateMCID');
    const validation = getMCIDValidation(mcid, { showPopup: true });
    if (!validation.ok) return setText('browseUpdateResult', validation.message);
    const person = validation.person;

    person.personal.firstName = getValue('browseUpdateFirstName');
    person.personal.middleName = getValue('browseUpdateMiddleName');
    person.personal.lastName = getValue('browseUpdateLastName');
    person.personal.username = getValue('browseUpdateUsername');
    person.personal.dob = getValue('browseUpdateDOB');
    const updatedAge = getNumber('browseUpdateAge');
    person.personal.age = updatedAge ?? ageFromDob(person.personal.dob);
    person.personal.gender = getValue('browseUpdateGender');
    person.personal.nationality = getValue('browseUpdateNationality');
    person.personal.maritalStatus = getValue('browseUpdateMaritalStatus');
    person.personal.occupation = getValue('browseUpdateOccupation');
    person.personal.employer = getValue('browseUpdateEmployer');
    person.personal.educationLevel = getValue('browseUpdateEducationLevel');
    person.personal.bloodType = getValue('browseUpdateBloodType');
    person.personal.allergies = getValue('browseUpdateAllergies');
    person.personal.criminalRecord = getValue('browseUpdateCriminalRecord');
    person.personal.emergencyName = getValue('browseUpdateEmergencyName');
    person.personal.emergencyRelation = getValue('browseUpdateEmergencyRelation');
    person.personal.emergencyContact = getValue('browseUpdateEmergencyContact');
    person.governance.permits = getValue('browseUpdatePermits');
    person.addresses.mailingAddress = getValue('browseUpdateAddress');
    person.addresses.residenceX = getNumber('browseUpdateResidenceX');
    person.addresses.residenceY = getNumber('browseUpdateResidenceY');
    person.addresses.residenceZ = getNumber('browseUpdateResidenceZ');
    person.governance.taxId = getValue('browseUpdateTaxId');
    person.governance.skills = getValue('browseUpdateSkills');
    person.governance.notes = getValue('browseUpdateNotes');
    person.updatedAt = new Date().toISOString();

    saveState();
    refreshAllViews();
    setText('browseUpdateResult', `Updated ${mcid}.`);
    clearFormFields('browseUpdate');
}

function setupDobAgeAutoCalc() {
    const pairs = [
        { dobId: 'citizenDob', ageId: 'citizenAge' },
        { dobId: 'entryDob', ageId: 'entryAge' }
    ];

    pairs.forEach(pair => {
        const dobInput = document.getElementById(pair.dobId);
        const ageInput = document.getElementById(pair.ageId);
        if (!dobInput || !ageInput) return;

        const sync = () => {
            const age = ageFromDob(dobInput.value);
            ageInput.value = age == null ? '' : String(age);
        };

        dobInput.addEventListener('change', sync);
        dobInput.addEventListener('input', sync);
        sync();
    });
}

let loadingTimer = null;

function showLoadingScene(labelText) {
    const textNode = document.getElementById('loadingSceneText');
    const fillNode = document.getElementById('loadingBarFill');
    if (textNode) textNode.textContent = labelText;
    if (fillNode) fillNode.style.width = '18%';
    showNode('loadingScene');

    if (loadingTimer) clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
        if (!fillNode) return;
        const current = Number(fillNode.style.width.replace('%', '') || 18);
        fillNode.style.width = `${Math.min(92, current + 12)}%`;
    }, 90);
}

function hideLoadingScene() {
    if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
    }
    const fillNode = document.getElementById('loadingBarFill');
    if (fillNode) fillNode.style.width = '100%';
    setTimeout(() => hideNode('loadingScene'), 120);
}

function openApp(appId, skipLoading = false) {
    const windowEl = document.getElementById(appId);
    if (!windowEl) return;

    const activate = () => {
        windowEl.classList.remove('hidden-window', 'minimized');
        windowEl.classList.add('active');
        focusWindow(windowEl);
        updateTaskbar(appId);

        if (appId === 'bankingApp') {
            registerBankEntryLog('Operator', 'Opened Banking App');
            saveState();
            refreshAllViews();
        }
    };

    if (skipLoading) {
        activate();
        return;
    }

    showLoadingScene(`Loading ${windowEl.querySelector('.title-text')?.textContent || appId}...`);
    setTimeout(() => {
        activate();
        hideLoadingScene();
    }, 320);
}

function closeApp(appId) {
    const windowEl = document.getElementById(appId);
    if (!windowEl) return;
    windowEl.classList.remove('active');
    windowEl.classList.add('hidden-window');
    openApp('welcomeWindow');
}

function switchApp(appId) {
    openApp(appId);
}

function focusWindow(windowEl) {
    zCounter += 1;
    windowEl.style.zIndex = String(zCounter);
}

function updateTaskbar(appId) {
    document.querySelectorAll('.taskbar-button').forEach(button => {
        button.classList.toggle('active', button.dataset.appId === appId);
    });
}

function minimizeWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) return;
    windowEl.classList.remove('active');
    windowEl.classList.add('minimized');
}

function maximizeWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) return;

    if (!windowEl.classList.contains('maximized')) {
        windowState[windowId] = {
            top: windowEl.style.top,
            left: windowEl.style.left,
            width: windowEl.style.width,
            height: windowEl.style.height
        };
        windowEl.classList.add('maximized');
        return;
    }

    windowEl.classList.remove('maximized');
    const previous = windowState[windowId];
    if (previous) {
        windowEl.style.top = previous.top;
        windowEl.style.left = previous.left;
        windowEl.style.width = previous.width;
        windowEl.style.height = previous.height;
    }
}

function initializeWindowButtons() {
    document.querySelectorAll('.window').forEach(windowEl => {
        const id = windowEl.id;
        windowEl.querySelectorAll('[data-window-action]').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.windowAction;
                if (action === 'min') minimizeWindow(id);
                if (action === 'max') maximizeWindow(id);
                if (action === 'close') closeApp(id);
            });
        });
    });
}

function initializeDragging() {
    document.querySelectorAll('.window').forEach(windowEl => {
        const titleBar = windowEl.querySelector('.title-bar');
        if (!titleBar) return;

        titleBar.addEventListener('mousedown', event => {
            if (event.target.closest('.window-buttons')) return;
            if (windowEl.classList.contains('maximized')) return;
            event.preventDefault();
            focusWindow(windowEl);

            const startX = event.clientX;
            const startY = event.clientY;
            const rect = windowEl.getBoundingClientRect();
            const initialLeft = rect.left;
            const initialTop = rect.top;

            const onMove = moveEvent => {
                windowEl.style.left = `${Math.max(0, initialLeft + (moveEvent.clientX - startX))}px`;
                windowEl.style.top = `${Math.max(0, initialTop + (moveEvent.clientY - startY))}px`;
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    });
}

function initializeWindowLayout() {
    const windows = Array.from(document.querySelectorAll('.window'));
    windows.forEach((windowEl, index) => {
        windowEl.style.left = `${35 + index * 22}px`;
        windowEl.style.top = `${30 + index * 18}px`;
        windowEl.style.width = '960px';
        windowEl.style.height = '720px';
        windowEl.style.zIndex = String(20 + index);
    });
}

function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setText('taskbarClock', `🕐 ${hh}:${mm}`);
}

function quickResetVerificationIfMCIDChanged() {
    const bankMcid = getValue('bankMCID');
    if (verificationState.bank && bankMcid && verificationState.bank !== bankMcid) verificationState.bank = null;

    const waterMcid = getValue('waterMCID');
    if (verificationState.water && waterMcid && verificationState.water !== waterMcid) verificationState.water = null;

    const billMcid = getValue('billMCID');
    if (verificationState.bill && billMcid && verificationState.bill !== billMcid) verificationState.bill = null;
}

function getEmptyDataShape() {
    return {
        people: {},
        entries: [],
        accounts: [],
        transactions: [],
        credits: [],
        permits: [],
        waterConnections: [],
        waterUsage: [],
        taxes: [],
        bills: [],
        felonies: [],
        arrests: [],
        bolos: [],
        entryBans: [],
        notifications: [],
        bankEntryLogs: [],
        bankProduction: [],
        auditLog: []
    };
}

function exportGovernmentData() {
    const payload = {
        meta: {
            app: 'Minecraft Government OS',
            version: '4.0',
            exportedAt: new Date().toISOString()
        },
        data: appData
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mc-government-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setText('backupResult', 'Backup exported successfully.');
}

function triggerImportBackup() {
    document.getElementById('backupFileInput')?.click();
}

function validateBackupData(candidate) {
    const required = ['people', 'entries', 'accounts', 'transactions', 'credits', 'permits', 'waterConnections', 'waterUsage', 'taxes', 'bills', 'felonies', 'arrests', 'bolos', 'entryBans', 'bankEntryLogs', 'bankProduction', 'auditLog'];
    return required.every(key => Object.prototype.hasOwnProperty.call(candidate, key));
}

function replaceAllData(newData) {
    const clean = getEmptyDataShape();
    Object.assign(clean, newData);
    Object.assign(appData, clean);
}

function handleBackupFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(typeof reader.result === 'string' ? reader.result : '{}');
            const source = parsed.data || parsed;

            if (!validateBackupData(source)) {
                setText('backupResult', 'Import failed: invalid backup structure.');
                event.target.value = '';
                return;
            }

            replaceAllData(source);
            verificationState.bank = null;
            verificationState.water = null;
            verificationState.bill = null;
            saveState();
            refreshAllViews();
            setText('backupResult', `Backup imported successfully (${file.name}).`);
        } catch {
            setText('backupResult', 'Import failed: could not parse JSON file.');
        }
        event.target.value = '';
    };

    reader.onerror = () => {
        setText('backupResult', 'Import failed: file read error.');
        event.target.value = '';
    };

    reader.readAsText(file, 'utf-8');
}

function init() {
    loadState();

    showBorderSection('dashboard');
    showCitizenSection('dashboard');
    showBankingSection('dashboard');
    showWaterSection('dashboard');
    showTaxSection('dashboard');
    showPoliceSection('dashboard');
    showBrowseSection('dashboard');

    initializeWindowLayout();
    initializeWindowButtons();
    initializeDragging();
    setupDobAgeAutoCalc();
    setupMCIDRealtimeValidation();

    refreshAllViews();
    onPermitTypeChange();
    updateClock();
    setInterval(updateClock, 30000);
    setInterval(quickResetVerificationIfMCIDChanged, 1500);

    const backupInput = document.getElementById('backupFileInput');
    backupInput?.addEventListener('change', handleBackupFileImport);

    openApp('welcomeWindow', true);
}

window.openApp = openApp;
window.closeApp = closeApp;
window.switchApp = switchApp;
window.showBorderSection = showBorderSection;
window.showCitizenSection = showCitizenSection;
window.showBankingSection = showBankingSection;
window.showWaterSection = showWaterSection;
window.showTaxSection = showTaxSection;
window.showBrowseSection = showBrowseSection;
window.showPoliceSection = showPoliceSection;
window.verifyMCIDForModule = verifyMCIDForModule;
window.createCitizen = createCitizen;
window.registerEntry = registerEntry;
window.searchBorder = searchBorder;
window.quickSearchCustoms = quickSearchCustoms;
window.searchCitizen = searchCitizen;
window.quickSearchCitizen = quickSearchCitizen;
window.loadCitizenForManagement = loadCitizenForManagement;
window.updatePermits = updatePermits;
window.issuePermit = issuePermit;
window.onPermitTypeChange = onPermitTypeChange;
window.deleteCitizen = deleteCitizen;
window.deleteCustomsDataByUser = deleteCustomsDataByUser;
window.deleteCitizenDataByUser = deleteCitizenDataByUser;
window.deleteAllGovernmentData = deleteAllGovernmentData;
window.createAccount = createAccount;
window.processTransaction = processTransaction;
window.issueCredit = issueCredit;
window.addBankProductionRecord = addBankProductionRecord;
window.quickSearchBanking = quickSearchBanking;
window.printBankStatementFromInput = printBankStatementFromInput;
window.registerWaterConnection = registerWaterConnection;
window.registerWaterUsage = registerWaterUsage;
window.quickSearchWater = quickSearchWater;
window.applyManualTax = applyManualTax;
window.runAutomaticTax = runAutomaticTax;
window.issueGovernmentBill = issueGovernmentBill;
window.quickSearchTax = quickSearchTax;
window.advancedSearchProfiles = advancedSearchProfiles;
window.loadProfileToUpdate = loadProfileToUpdate;
window.loadProfileForUpdate = loadProfileForUpdate;
window.applyProfileUpdate = applyProfileUpdate;
window.openProfilePopup = openProfilePopup;
window.closeProfilePopup = closeProfilePopup;
window.closeSystemAlert = closeSystemAlert;
window.toggleNotificationCenter = toggleNotificationCenter;
window.deleteNotification = deleteNotification;
window.postponeNotification = postponeNotification;
window.clearAllNotifications = clearAllNotifications;
window.printPassportByMCID = printPassportByMCID;
window.printCitizenIdByMCIDValue = printCitizenIdByMCIDValue;
window.printCitizenProfileByMCID = printCitizenProfileByMCID;
window.printCitizenProfileByMCIDInput = printCitizenProfileByMCIDInput;
window.printCitizenIdByMCID = printCitizenIdByMCID;
window.printPassportFromInput = printPassportFromInput;
window.printCitizenIdFromInput = printCitizenIdFromInput;
window.printDebitCardFromInput = printDebitCardFromInput;
window.printWaterStatementFromInput = printWaterStatementFromInput;
window.printTaxStatementFromInput = printTaxStatementFromInput;
window.printWaterStatementByMCID = printWaterStatementByMCID;
window.printTaxStatementByMCID = printTaxStatementByMCID;
window.printGovernmentBillById = printGovernmentBillById;
window.printPoliceNoticeFromInput = printPoliceNoticeFromInput;
window.printPoliceNoticeByMCID = printPoliceNoticeByMCID;
window.registerFelony = registerFelony;
window.registerArrest = registerArrest;
window.registerBolo = registerBolo;
window.registerEntryBan = registerEntryBan;
window.searchPoliceRecords = searchPoliceRecords;
window.quickSearchPolice = quickSearchPolice;
window.exportGovernmentData = exportGovernmentData;
window.triggerImportBackup = triggerImportBackup;
window.clearFormFields = clearFormFields;

init();
