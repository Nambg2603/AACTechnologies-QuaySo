// LUCKY DRAW SYSTEM - FINAL PRO (FIXED SAVE)

let participants = [];
let prizes = [];
let winners = []; 
let currentPrizeConfig = null;
let isSpinning = false;
let rollInterval;

// VISUAL
let tags = [];
let sphereRadius = 280;
let rotationSpeed = 0.002;
let angleX = 0;
let angleY = 0;

const dom = {
    btnSpin: document.getElementById('btnSpinMain'),
    modal: document.getElementById('resultModal'),
    modalTitle: document.getElementById('modalPrizeName'),
    rollingGrid: document.getElementById('rollingGrid'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    sidebarList: document.getElementById('winnersList'),
    btnExport: document.getElementById('btnExport') // Thêm tham chiếu nút Export
};

// --- TAB LOGIC ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const btnIndex = tabId === 'tab-winners' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[btnIndex].classList.add('active');
}

window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
});

function toggleSidebar() { document.getElementById('adminPanel').classList.toggle('active'); }

async function loadData() {
    // 1. Load Config
    try {
        const res = await fetch('./config.json');
        if(res.ok) {
            const data = await res.json();
            currentPrizeConfig = data[0]; 
            updateStatus('st-config', '✅ Đã tải', 'success');
        }
    } catch(e) { console.error(e); }

    // 2. Load Nhân sự
    try {
        const data = await fetchExcelFile('./nhansu.xlsx');
        participants = data.slice(1).filter(r => r[2] && String(r[2]).toLowerCase().trim() === "tham gia")
            .map(r => ({id: r[0], name: r[1]}));
        updateStatus('st-users', `✅ ${participants.length} NV`, 'success');
        
        // 3. Khôi phục dữ liệu cũ nếu lỡ tắt trình duyệt
        loadFromStorage();

        initVisuals(); 
    } catch(e) { updateStatus('st-users', '❌ Lỗi File', 'warning'); }
    
    checkSystemReady();
}

// --- DATA PERSISTENCE (Lưu tự động vào bộ nhớ tạm) ---
function loadFromStorage() {
    const saved = localStorage.getItem('luckyDrawWinners_2026');
    if (saved) {
        winners = JSON.parse(saved);
        // Loại bỏ người đã trúng khỏi danh sách quay
        participants = participants.filter(p => !winners.some(w => w.id === p.id));
        updateSidebar();
        
        // Bật nút xuất file nếu đã có dữ liệu
        if(winners.length > 0 && dom.btnExport) dom.btnExport.disabled = false;
    }
}

function saveData() {
    localStorage.setItem('luckyDrawWinners_2026', JSON.stringify(winners));
    // Bật nút xuất file
    if(dom.btnExport) dom.btnExport.disabled = false;
}

function initVisuals() {
    const container = document.getElementById('tagCloud');
    container.innerHTML = ''; tags = [];
    const displayLimit = Math.min(participants.length, 250);
    const shuffled = [...participants].sort(() => 0.5 - Math.random()).slice(0, displayLimit);
    shuffled.forEach((p, i) => {
        const phi = Math.acos(-1 + (2 * i) / displayLimit);
        const theta = Math.sqrt(displayLimit * Math.PI) * phi;
        const el = document.createElement('div'); el.className = 'tag-element'; el.innerText = p.name;
        container.appendChild(el);
        tags.push({ el, x: sphereRadius * Math.cos(theta) * Math.sin(phi), y: sphereRadius * Math.sin(theta) * Math.sin(phi), z: sphereRadius * Math.cos(phi) });
    });
    animate();
}

function animate() {
    angleX += rotationSpeed; angleY += rotationSpeed;
    tags.forEach(tag => {
        let y = tag.y; let x = tag.x * Math.cos(angleY) - tag.z * Math.sin(angleY);
        let z = tag.z * Math.cos(angleY) + tag.x * Math.sin(angleY);
        let yPrime = y * Math.cos(angleX) - z * Math.sin(angleX);
        let zPrime = z * Math.cos(angleX) + y * Math.sin(angleX);
        let scale = (zPrime + sphereRadius * 2) / (sphereRadius * 3);
        let opacity = (zPrime + sphereRadius) / (sphereRadius * 2);
        tag.el.style.transform = `translate3d(${x}px, ${yPrime}px, ${zPrime}px) scale(${scale})`;
        tag.el.style.opacity = Math.max(0.1, Math.min(1, opacity));
        tag.el.style.zIndex = Math.floor(zPrime);
        if(isSpinning) { tag.el.style.color = '#fff'; tag.el.style.textShadow = '0 0 10px #ffd700'; }
        else { tag.el.style.color = 'rgba(255, 215, 0, 0.6)'; tag.el.style.textShadow = 'none'; }
    });
    requestAnimationFrame(animate);
}

function spin() {
    if(participants.length === 0 || isSpinning || !currentPrizeConfig) return;
    const qty = currentPrizeConfig.quantity;
    if(qty <= 0) { alert("Đã hết giải thưởng!"); return; }

    isSpinning = true; rotationSpeed = 0.08; dom.btnSpin.disabled = true;

    setTimeout(() => {
        isSpinning = false; rotationSpeed = 0.002;
        let shuffledParticipants = [...participants].sort(() => 0.5 - Math.random());
        let countNeeded = Math.min(qty, shuffledParticipants.length);
        let batchWinners = [];
        
        for(let i=0; i<countNeeded; i++) {
            let winner = shuffledParticipants[i];
            batchWinners.push({ ...winner, prizeName: currentPrizeConfig.name });
            const idx = participants.findIndex(p => p.id === winner.id);
            if(idx > -1) participants.splice(idx, 1);
        }

        currentPrizeConfig.quantity -= batchWinners.length;
        winners = winners.concat(batchWinners);
        
        saveData(); // Lưu ngay lập tức
        updateSidebar();
        startRollingEffect(batchWinners);
    }, 10000);
}

function startRollingEffect(winnersList) {
    dom.modal.style.display = 'flex';
    dom.modalTitle.innerText = currentPrizeConfig.name;
    dom.rollingGrid.innerHTML = '';
    dom.btnCloseModal.classList.remove('active');
    dom.btnCloseModal.innerText = "ĐANG QUAY SỐ...";
    
    let chunks = [];
    for (let i = 0; i < winnersList.length; i += 5) { chunks.push(winnersList.slice(i, i + 5)); }
    let chunkIndex = 0;
    
    const addRow = () => {
        if(chunkIndex >= chunks.length) {
            clearInterval(rollInterval);
            dom.btnCloseModal.classList.add('active');
            dom.btnCloseModal.disabled = false;
            dom.btnCloseModal.innerText = "HOÀN TẤT - ĐÓNG";
            confetti({ particleCount: 800, spread: 250, origin: { y: 0.6 }, colors: ['#ff0000', '#ffd700', '#ffffff'], ticks: 400 });
            return;
        }

        const chunk = chunks[chunkIndex];
        const rowDiv = document.createElement('div');
        rowDiv.className = 'rolling-row row-enter';
        chunk.forEach(w => {
            rowDiv.innerHTML += `<div class="grid-winner-item"><div class="gw-name">${w.name}</div><div class="gw-id">${w.id}</div></div>`;
        });
        while(rowDiv.children.length < 5) { rowDiv.innerHTML += `<div></div>`; }
        dom.rollingGrid.appendChild(rowDiv);

        const rows = dom.rollingGrid.getElementsByClassName('rolling-row');
        if(rows.length > 4) {
            const firstRow = rows[0];
            firstRow.classList.remove('row-enter'); firstRow.classList.add('row-exit');
            setTimeout(() => { if(firstRow.parentNode) firstRow.parentNode.removeChild(firstRow); }, 750); 
        }
        chunkIndex++;
    };

    addRow();
    rollInterval = setInterval(addRow, 1500);
}

function updateSidebar() {
    dom.sidebarList.innerHTML = '';
    [...winners].reverse().forEach(w => {
        dom.sidebarList.innerHTML += `
            <div class="winner-card">
                <div class="w-name">${w.name}</div>
                <div class="w-id">MNV: ${w.id}</div>
            </div>`;
    });
}

function closeModal() {
    dom.modal.style.display = 'none';
    if(participants.length > 0) dom.btnSpin.disabled = false;
    else { dom.btnSpin.disabled = true; if(dom.btnExport) dom.btnExport.disabled = false; }
}

async function fetchExcelFile(url) {
    const res = await fetch(url); const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, {type: 'array'});
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
}
function updateStatus(id, text, type) { const el = document.getElementById(id).querySelector('.val'); el.innerText = text; el.className = `val ${type}`; }
function checkSystemReady() { if(participants.length > 0) dom.btnSpin.disabled = false; }

// --- TÍNH NĂNG LƯU FILE CAO CẤP (CHO PHÉP CHỌN NƠI LƯU) ---
async function exportWinners() {
    if(winners.length === 0) { alert("Chưa có danh sách!"); return; }

    // 1. Tạo nội dung CSV (Có BOM để hiển thị tiếng Việt)
    let csvContent = "\uFEFFMã Nhân Viên,Họ Và Tên,Giải Thưởng,Thời Gian\n";
    winners.forEach(w => {
        const time = new Date().toLocaleTimeString();
        csvContent += `${w.id},"${w.name}",${w.prizeName},${time}\n`;
    });

    // 2. Thử dùng tính năng "Lưu Như..." (Save As) của trình duyệt hiện đại
    try {
        // Kiểm tra xem trình duyệt có hỗ trợ API chọn file không
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'KetQua_Tet2026.csv',
                types: [{
                    description: 'CSV File',
                    accept: {'text/csv': ['.csv']},
                }],
            });
            const writable = await handle.createWritable();
            await writable.write("\uFEFF" + csvContent); // Ghi BOM + nội dung
            await writable.close();
            alert("Đã lưu file thành công!");
        } else {
            // Fallback cho trình duyệt cũ (Tải xuống tự động)
            throw new Error("Old Browser");
        }
    } catch (err) {
        // Nếu người dùng hủy hoặc trình duyệt cũ -> Tải về Downloads
        if(err.name !== 'AbortError') {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "KetQua_Tet2026.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Hướng dẫn nếu không thấy hộp thoại
            alert("File đã được tải xuống thư mục Downloads.\n(Do cài đặt trình duyệt của bạn không hỏi nơi lưu)");
        }
    }
}

function resetAll() { 
    if(confirm("Xóa toàn bộ dữ liệu và quay lại từ đầu?")) {
        localStorage.removeItem('luckyDrawWinners_2026');
        location.reload(); 
    }
}