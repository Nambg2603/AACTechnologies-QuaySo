// LUCKY DRAW SYSTEM - FINAL (WITH MUSIC)

// --- CẤU HÌNH HỆ THỐNG ---
const CONFIG = {
    SPIN_TIME: 10000,        // Thời gian quay (3 giây)
    SCROLL_SPEED: 1500,     // Tốc độ cuộn dòng kết quả
    MAX_VISUAL_TAGS: 200,   // Giới hạn visual
    GRID_COLS: 8            // Số cột hiển thị
};

// --- BIẾN TOÀN CỤC ---
let participants = [];      
let allParticipants = [];   
let winners = [];           
let lastSpinResults = [];   
let currentPrizeConfig = null;
let isSpinning = false;
let rollInterval;

// --- ÂM THANH (MỚI) ---
// Đảm bảo file nhac.mp3 nằm cùng thư mục
const spinSound = new Audio('./nhac.mp3'); 
spinSound.loop = true; // Cho phép lặp lại nếu nhạc ngắn hơn thời gian quay

// VISUAL VARIABLES
let tags = [];
let sphereRadius = 280;
let rotationSpeed = 0.002;
let angleX = 0;
let angleY = 0;
let animationFrameId;

// DOM ELEMENTS
const dom = {
    btnSpin: document.getElementById('btnSpinMain'),
    btnLucky: document.getElementById('btnLucky'),
    toggleLucky: document.getElementById('toggleLucky'),
    modal: document.getElementById('resultModal'),
    modalTitle: document.getElementById('modalPrizeName'),
    rollingGrid: document.getElementById('rollingGrid'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    sidebarList: document.getElementById('winnersList'),
    btnExport: document.getElementById('btnExport'),
    tagCloud: document.getElementById('tagCloud')
};

// --- KHỞI TẠO ---
window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    animate(); 
});

// --- LOAD DATA ---
async function loadData() {
    try {
        const res = await fetch('./config.json');
        if (res.ok) {
            const data = await res.json();
            currentPrizeConfig = data[0]; 
            updateStatus('st-config', '✅ Đã tải', 'success');
        }
    } catch (e) { console.error(e); }

    try {
        const data = await fetchExcelFile('./nhansu.xlsx');
        const rawList = data.slice(1)
            .filter(r => r[2] && String(r[2]).toLowerCase().trim() === "tham gia")
            .map(r => ({ id: String(r[0]), name: String(r[1]) }));
        
        participants = [...rawList];
        allParticipants = [...rawList];

        updateStatus('st-users', `✅ ${participants.length} NV`, 'success');
        loadFromStorage();
        initVisuals(); 
    } catch (e) { 
        console.error(e);
        updateStatus('st-users', '❌ Lỗi File', 'warning'); 
    }
    
    checkSystemReady();
}

// --- THUẬT TOÁN SHUFFLE ---
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// --- VISUAL EFFECTS ---
function initVisuals() {
    dom.tagCloud.innerHTML = ''; 
    tags = [];
    const displayList = allParticipants.length > CONFIG.MAX_VISUAL_TAGS 
        ? shuffle([...allParticipants]).slice(0, CONFIG.MAX_VISUAL_TAGS) 
        : allParticipants;

    displayList.forEach((p, i) => {
        const phi = Math.acos(-1 + (2 * i) / displayList.length);
        const theta = Math.sqrt(displayList.length * Math.PI) * phi;
        const el = document.createElement('div');
        el.className = 'tag-element';
        el.innerText = p.name;
        dom.tagCloud.appendChild(el);
        tags.push({
            el,
            x: sphereRadius * Math.cos(theta) * Math.sin(phi),
            y: sphereRadius * Math.sin(theta) * Math.sin(phi),
            z: sphereRadius * Math.cos(phi)
        });
    });
}

function animate() {
    angleX += rotationSpeed;
    angleY += rotationSpeed;
    tags.forEach(tag => {
        const y = tag.y;
        const x = tag.x * Math.cos(angleY) - tag.z * Math.sin(angleY);
        const z = tag.z * Math.cos(angleY) + tag.x * Math.sin(angleY);
        const yPrime = y * Math.cos(angleX) - z * Math.sin(angleX);
        const zPrime = z * Math.cos(angleX) + y * Math.sin(angleX);
        const scale = (zPrime + sphereRadius * 2) / (sphereRadius * 3);
        const opacity = Math.max(0.1, Math.min(1, (zPrime + sphereRadius) / (sphereRadius * 2)));
        tag.el.style.transform = `translate3d(${x}px, ${yPrime}px, ${zPrime}px) scale(${scale})`;
        tag.el.style.opacity = opacity;
        tag.el.style.zIndex = Math.floor(zPrime);
        
        if (isSpinning) {
            tag.el.style.color = '#fff'; tag.el.style.textShadow = '0 0 10px #ffd700';
        } else {
            tag.el.style.color = 'rgba(255, 215, 0, 0.6)'; tag.el.style.textShadow = 'none';
        }
    });
    animationFrameId = requestAnimationFrame(animate);
}

// --- QUAY CHÍNH (CÓ NHẠC) ---
function spin() {
    if (participants.length === 0 || isSpinning || !currentPrizeConfig) return;
    const qty = currentPrizeConfig.quantity;
    if (qty <= 0) { alert("Đã hết giải thưởng!"); return; }

    isSpinning = true;
    rotationSpeed = 0.08; 
    setButtonsState(true);

    // [AUDIO] BẮT ĐẦU PHÁT NHẠC
    spinSound.currentTime = 0; // Tua về đầu
    spinSound.play().catch(e => console.log("Chưa tương tác user nên không tự play được nhạc"));

    setTimeout(() => {
        let shuffled = shuffle([...participants]);
        let countNeeded = Math.min(qty, shuffled.length);
        let batchWinners = shuffled.slice(0, countNeeded).map(w => ({
            ...w, prizeName: currentPrizeConfig.name, timestamp: new Date().toLocaleTimeString()
        }));

        const winnerIds = new Set(batchWinners.map(w => w.id));
        participants = participants.filter(p => !winnerIds.has(p.id));
        
        currentPrizeConfig.quantity -= batchWinners.length;
        winners = winners.concat(batchWinners);
        lastSpinResults = batchWinners; 

        saveData();
        updateSidebar();

        setTimeout(() => {
            isSpinning = false;
            rotationSpeed = 0.002;
            
            // [AUDIO] DỪNG NHẠC
            spinSound.pause();
            spinSound.currentTime = 0;

            startRollingEffect(batchWinners, currentPrizeConfig.name);
            if (dom.btnExport) dom.btnExport.disabled = false;
        }, CONFIG.SPIN_TIME);

    }, 50);
}

// --- QUAY LỘC BẤT NGỜ (CÓ NHẠC) ---
function spinLucky() {
    if (allParticipants.length === 0 || isSpinning) return;
    
    isSpinning = true;
    rotationSpeed = 0.15;
    setButtonsState(true);

    // [AUDIO] BẮT ĐẦU PHÁT NHẠC
    spinSound.currentTime = 0;
    spinSound.play().catch(e => console.log("Lỗi Audio"));

    setTimeout(() => {
        const luckyIndex = Math.floor(Math.random() * allParticipants.length);
        const luckyPerson = { 
            ...allParticipants[luckyIndex], 
            prizeName: "LỘC BẤT NGỜ",
            timestamp: new Date().toLocaleTimeString()
        };

        lastSpinResults = [luckyPerson];
        winners.push(luckyPerson);
        saveData();
        updateSidebar();

        setTimeout(() => {
            isSpinning = false;
            rotationSpeed = 0.002;

            // [AUDIO] DỪNG NHẠC
            spinSound.pause();
            spinSound.currentTime = 0;

            showLuckyResult(luckyPerson);
            if (dom.btnExport) dom.btnExport.disabled = false;
        }, CONFIG.SPIN_TIME);

    }, 50);
}

// --- HIỂN THỊ KẾT QUẢ ---
function startRollingEffect(list, title) {
    dom.modal.style.display = 'flex';
    dom.modalTitle.innerText = title;
    dom.rollingGrid.innerHTML = '';
    dom.btnCloseModal.classList.remove('active');
    dom.btnCloseModal.innerText = "ĐANG QUAY SỐ...";
    dom.btnCloseModal.disabled = true;

    let chunks = [];
    // Chia nhóm 8
    for (let i = 0; i < list.length; i += CONFIG.GRID_COLS) {
        chunks.push(list.slice(i, i + CONFIG.GRID_COLS));
    }

    let chunkIndex = 0;
    if (rollInterval) clearInterval(rollInterval);

    const addRow = () => {
        if (chunkIndex >= chunks.length) {
            clearInterval(rollInterval);
            dom.btnCloseModal.classList.add('active');
            dom.btnCloseModal.disabled = false;
            dom.btnCloseModal.innerText = "HOÀN TẤT - ĐÓNG";
            fireConfetti();
            return;
        }

        const chunk = chunks[chunkIndex];
        const rowDiv = document.createElement('div');
        rowDiv.className = 'rolling-row row-enter';
        
        chunk.forEach(w => {
            rowDiv.innerHTML += `
                <div class="grid-winner-item">
                    <div class="gw-name">${w.name}</div>
                    <div class="gw-id">${w.id}</div>
                </div>`;
        });

        while (rowDiv.children.length < CONFIG.GRID_COLS) { rowDiv.innerHTML += `<div></div>`; }
        dom.rollingGrid.appendChild(rowDiv);

        const rows = dom.rollingGrid.getElementsByClassName('rolling-row');
        if (rows.length > 5) {
            const firstRow = rows[0];
            firstRow.classList.remove('row-enter');
            firstRow.classList.add('row-exit');
            setTimeout(() => { if(firstRow.parentNode) firstRow.parentNode.removeChild(firstRow); }, 750);
        }
        chunkIndex++;
    };

    addRow();
    rollInterval = setInterval(addRow, CONFIG.SCROLL_SPEED);
}

function showLuckyResult(w) {
    dom.modal.style.display = 'flex';
    dom.modalTitle.innerText = "✨ LỘC BẤT NGỜ ✨";
    dom.rollingGrid.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:100%; width:100%;">
            <div style="transform:scale(1.8); width:350px; padding:30px; background:linear-gradient(135deg, #ff0000, #ffd700); border: 3px solid #fff; box-shadow: 0 0 80px #ffd700; border-radius: 15px; text-align: center;">
                <div style="font-size:28px; font-weight:900; color:#fff; margin-bottom:10px; font-family:'Orbitron'; text-shadow:2px 2px 4px #000;">${w.name}</div>
                <div style="font-size:22px; color:#800000; font-weight:bold;">${w.id}</div>
                <div style="font-size:14px; color:#fff; margin-top:15px; font-style:italic;"></div>
            </div>
        </div>
    `;
    dom.btnCloseModal.innerText = "HOÀN TẤT";
    dom.btnCloseModal.disabled = false;
    dom.btnCloseModal.classList.add('active');
    fireConfetti();
    setButtonsState(false);
}

// --- UTILS ---
function setButtonsState(disabled) {
    dom.btnSpin.disabled = disabled;
    if(dom.toggleLucky.checked) dom.btnLucky.disabled = disabled;
    else dom.btnLucky.disabled = true;
    
    dom.btnExport.disabled = disabled;
}

function fireConfetti() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 1000, spread: 360, startVelocity: 60, origin: { y: 0.5 }, colors: ['#ffd700', '#ffffff', '#ff0000'] });
    }
}

function updateSidebar() {
    dom.sidebarList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    [...winners].reverse().forEach(w => {
        const div = document.createElement('div');
        div.className = 'winner-card';
        div.innerHTML = `
            <div class="w-name">${w.name}</div>
            <div class="w-info">
                <span class="w-id">MNV: ${w.id}</span>
                <span class="w-prize-tag">${w.prizeName}</span>
            </div>
        `;
        fragment.appendChild(div);
    });
    dom.sidebarList.appendChild(fragment);
}

function loadFromStorage() {
    const saved = localStorage.getItem('luckyDrawWinners_2026');
    if (saved) {
        winners = JSON.parse(saved);
        const winnerIds = new Set(winners.map(w => w.id));
        participants = participants.filter(p => !winnerIds.has(p.id));
        updateSidebar();
    }
}

function saveData() { localStorage.setItem('luckyDrawWinners_2026', JSON.stringify(winners)); }

function closeModal() {
    dom.modal.style.display = 'none';
    if (participants.length > 0) setButtonsState(false);
    else {
        dom.btnSpin.disabled = true;
        if(dom.toggleLucky.checked) dom.btnLucky.disabled = false;
        if(dom.btnExport) dom.btnExport.disabled = false;
    }
}

async function exportWinners() {
    if (!lastSpinResults || lastSpinResults.length === 0) { 
        alert("Chưa có kết quả mới để xuất! Hãy quay thưởng trước."); return; 
    }
    let csvContent = "\uFEFFMã Nhân Viên,Họ Và Tên,Giải Thưởng,Thời Gian\n";
    lastSpinResults.forEach(w => {
        const time = w.timestamp || new Date().toLocaleTimeString();
        csvContent += `${w.id},"${w.name}",${w.prizeName},${time}\n`;
    });

    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'KetQua_MoiNhat.csv',
                types: [{ description: 'CSV File', accept: {'text/csv': ['.csv']} }],
            });
            const writable = await handle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            alert("Đã lưu thành công!");
        } catch (err) { }
    } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "KetQua_MoiNhat.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function resetAll() { if(confirm("Xóa toàn bộ dữ liệu?")) { localStorage.removeItem('luckyDrawWinners_2026'); location.reload(); } }
function toggleSidebar() { document.getElementById('adminPanel').classList.toggle('active'); }
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const btnIndex = tabId === 'tab-winners' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
}
function toggleLuckyBtn() {
    const cb = document.getElementById('toggleLucky');
    const btn = document.getElementById('btnLucky');
    btn.style.display = cb.checked ? 'block' : 'none';
}
function updateStatus(id, text, type) { const el = document.getElementById(id).querySelector('.val'); el.innerText = text; el.className = `val ${type}`; }
function checkSystemReady() { if(participants.length > 0) dom.btnSpin.disabled = false; }
async function fetchExcelFile(url) {
    const res = await fetch(url); const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, {type: 'array'});
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
}
window.addEventListener('beforeunload', function (e) { if (winners.length > 0) { e.preventDefault(); e.returnValue = ''; return ''; } });