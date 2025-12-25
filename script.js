// ======================== LUCKY DRAW SYSTEM - HOÀN CHỈNH ========================
// Phiên bản: 2.1 - Sửa lỗi nút "Lộc Bất Ngờ" không hoạt động sau khi quay hết giải
// ===============================================================================

// --- CẤU HÌNH HỆ THỐNG ---
const CONFIG = {
    SPIN_TIME: 30000,
    SCROLL_SPEED: 1500,
    MAX_VISUAL_TAGS: 200,
    GRID_COLS: 8,
    STORAGE_KEY: 'luckyDrawData_AAC_2026'
};

// --- BIẾN TOÀN CỤC ---
let participants = [];
let allParticipants = [];
let winners = [];
let lastSpinResults = [];
let currentPrizeConfig = null;
let isSpinning = false;
let rollInterval = null;
let hasSessionData = false;

// --- ÂM THANH ---
const spinSound = new Audio('./nhac.mp3'); 
spinSound.loop = true;
const resultSound = new Audio('./nhac2.mp3');
resultSound.loop = true;

// --- VISUAL VARIABLES ---
let tags = [];
let sphereRadius = 280;
let rotationSpeed = 0.002;
let angleX = 0;
let angleY = 0;
let animationFrameId = null;

// --- DOM ELEMENTS ---
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

// ======================== KHỞI TẠO HỆ THỐNG ========================
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Đang khởi tạo hệ thống...');
    
    await handleSessionData();
    await loadData();
    animate();
    setupBeforeUnload();
    
    console.log('✅ Hệ thống đã sẵn sàng!');
});

// ======================== XỬ LÝ DỮ LIỆU PHIÊN CŨ ========================
async function handleSessionData() {
    const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
    
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            const now = new Date();
            const savedTime = new Date(data.timestamp);
            const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                console.log('🗑️ Dữ liệu cũ hơn 24h, tự động xóa...');
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                hasSessionData = false;
                return;
            }
            
            const userChoice = confirm(
                `🕐 PHÁT HIỆN DỮ LIỆU QUAY THƯỞNG TỪ ${savedTime.toLocaleTimeString()} ${savedTime.toLocaleDateString()}\n\n` +
                `Đã quay: ${data.winners.length} giải\n` +
                `Còn lại: ${data.participants.length} người chưa trúng\n\n` +
                `Bấm OK để TIẾP TỤC phiên cũ.\n` +
                `Bấm Cancel để BẮT ĐẦU PHIÊN MỚI.`
            );
            
            if (userChoice) {
                hasSessionData = true;
                winners = data.winners || [];
                participants = data.participants || [];
                currentPrizeConfig = data.prizeConfig || null;
                lastSpinResults = data.lastResults || [];
                
                console.log('🔄 Đã khôi phục phiên cũ:', {
                    winners: winners.length,
                    participants: participants.length
                });
                
                updateSidebar();
                if (dom.btnExport) dom.btnExport.disabled = false;
                
            } else {
                console.log('🆕 Người dùng chọn bắt đầu phiên mới');
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                hasSessionData = false;
            }
            
        } catch (error) {
            console.error('❌ Lỗi khi xử lý dữ liệu phiên cũ:', error);
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            hasSessionData = false;
        }
    }
}

// ======================== TẢI DỮ LIỆU TỪ FILE ========================
async function loadData() {
    console.log('📂 Đang tải dữ liệu từ file...');
    
    // Tải config.json
    try {
        const res = await fetch('./config.json');
        if (res.ok) {
            const data = await res.json();
            currentPrizeConfig = data[0];
            updateStatus('st-config', '✅ Đã tải config', 'success');
        } else {
            throw new Error('Không thể tải config.json');
        }
    } catch (error) {
        console.error('❌ Lỗi tải config:', error);
        updateStatus('st-config', '❌ Lỗi file config', 'error');
    }
    
    // Tải danh sách nhân viên
    try {
        const data = await fetchExcelFile('./nhansu.xlsx');
        const rawList = data.slice(1)
            .filter(r => r[2] && String(r[2]).toLowerCase().trim() === "tham gia")
            .map(r => ({ 
                id: String(r[0]).trim(), 
                name: String(r[1]).trim() 
            }));
        
        allParticipants = [...rawList];
        
        if (!hasSessionData) {
            participants = [...rawList];
        }
        
        updateStatus('st-users', `✅ ${allParticipants.length} nhân viên`, 'success');
        console.log('👥 Tổng nhân viên:', allParticipants.length);
        console.log('🎯 Còn lại để quay:', participants.length);
        
        initVisuals();
        checkSystemReady();
        
    } catch (error) {
        console.error('❌ Lỗi tải danh sách nhân viên:', error);
        updateStatus('st-users', '❌ Lỗi file Excel', 'error');
    }
}

// ======================== LƯU DỮ LIỆU ========================
function saveData() {
    const dataToSave = {
        winners: winners,
        participants: participants,
        prizeConfig: currentPrizeConfig,
        lastResults: lastSpinResults,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(dataToSave));
}

// ======================== QUAY THƯỞNG CHÍNH ========================
function spin() {
    // Kiểm tra điều kiện QUAY CHÍNH
    if (isSpinning) {
        alert("Hệ thống đang quay!");
        return;
    }
    
    if (participants.length === 0) {
        alert("Đã hết người để quay giải chính!");
        return;
    }
    
    if (!currentPrizeConfig) {
        alert("Chưa có cấu hình giải thưởng!");
        return;
    }
    
    const qty = currentPrizeConfig.quantity;
    if (qty <= 0) {
        alert("Đã hết giải thưởng chính!");
        return;
    }
    
    // Bắt đầu quay
    isSpinning = true;
    rotationSpeed = 0.08;
    setButtonsState(true);
    
    playSpinSound();
    
    setTimeout(() => {
        let shuffled = shuffle([...participants]);
        let countNeeded = Math.min(qty, shuffled.length);
        
        if (countNeeded === 0) {
            alert("Không đủ người để quay!");
            isSpinning = false;
            rotationSpeed = 0.002;
            setButtonsState(false);
            return;
        }
        
        let batchWinners = shuffled.slice(0, countNeeded).map(w => ({
            ...w,
            prizeName: currentPrizeConfig.name,
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString()
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
            stopSpinSound();
            
            startRollingEffect(batchWinners, currentPrizeConfig.name);
            if (dom.btnExport) dom.btnExport.disabled = false;
            
        }, CONFIG.SPIN_TIME);
        
    }, 50);
}

// ======================== QUAY LỘC BẤT NGỜ ========================
function spinLucky() {
    // QUAN TRỌNG: Nút Lộc Bất Ngờ không phụ thuộc vào participants hay currentPrizeConfig
    if (isSpinning) {
        alert("Hệ thống đang quay!");
        return;
    }
    
    if (allParticipants.length === 0) {
        alert("Chưa có danh sách nhân viên!");
        return;
    }
    
    isSpinning = true;
    rotationSpeed = 0.15;
    setButtonsState(true);
    
    playSpinSound();
    
    setTimeout(() => {
        // Tạo danh sách để quay Lộc Bất Ngờ
        // Có thể quay từ tất cả nhân viên (bao gồm cả người đã trúng giải chính)
        // Hoặc chỉ quay từ người chưa trúng (participants)
        // Ở đây chọn quay từ tất cả để tăng tính vui vẻ
        let luckyList = [...allParticipants];
        
        if (luckyList.length === 0) {
            alert("Không có ai để quay Lộc Bất Ngờ!");
            isSpinning = false;
            rotationSpeed = 0.002;
            setButtonsState(false);
            return;
        }
        
        const luckyIndex = Math.floor(Math.random() * luckyList.length);
        const luckyPerson = { 
            ...luckyList[luckyIndex], 
            prizeName: "LỘC BẤT NGỜ",
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString()
        };
        
        lastSpinResults = [luckyPerson];
        winners.push(luckyPerson);
        
        saveData();
        updateSidebar();
        
        setTimeout(() => {
            isSpinning = false;
            rotationSpeed = 0.002;
            stopSpinSound();
            
            showLuckyResult(luckyPerson);
            if (dom.btnExport) dom.btnExport.disabled = false;
            
        }, CONFIG.SPIN_TIME);
        
    }, 50);
}

// ======================== HIỂN THỊ KẾT QUẢ ========================
function startRollingEffect(list, title) {
    dom.modal.style.display = 'flex';
    dom.modalTitle.innerText = title;
    dom.rollingGrid.innerHTML = '';
    dom.btnCloseModal.classList.remove('active');
    dom.btnCloseModal.innerText = "ĐANG QUAY SỐ...";
    dom.btnCloseModal.disabled = true;
    
    playResultSound();
    
    let chunks = [];
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
        
        while (rowDiv.children.length < CONFIG.GRID_COLS) {
            rowDiv.innerHTML += '<div class="grid-winner-item"></div>';
        }
        
        dom.rollingGrid.appendChild(rowDiv);
        
        const rows = dom.rollingGrid.getElementsByClassName('rolling-row');
        if (rows.length > 5) {
            const firstRow = rows[0];
            firstRow.classList.remove('row-enter');
            firstRow.classList.add('row-exit');
            setTimeout(() => {
                if(firstRow.parentNode) firstRow.parentNode.removeChild(firstRow);
            }, 750);
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
            <div class="lucky-result-box">
                <div class="lucky-title">CHÚC MỪNG</div>
                <div class="lucky-name">${w.name}</div>
                <div class="lucky-id">Mã NV: ${w.id}</div>
                <div class="lucky-prize">🎁 LỘC BẤT NGỜ 🎁</div>
            </div>
        </div>
    `;
    
    playResultSound();
    
    dom.btnCloseModal.innerText = "HOÀN TẤT";
    dom.btnCloseModal.disabled = false;
    dom.btnCloseModal.classList.add('active');
    
    fireConfetti();
    setButtonsState(false);
}

// ======================== XỬ LÝ NÚT RESET ========================
function confirmResetAll() {
    if (confirm(`⚠️ RESET TOÀN BỘ HỆ THỐNG\n\n` +
                `Hành động này sẽ:\n` +
                `• Xóa MỌI dữ liệu quay thưởng\n` +
                `• Reset về trạng thái ban đầu\n` +
                `• Không thể hoàn tác!\n\n` +
                `Bạn có chắc chắn không?`)) {
        resetAll();
    }
}

function confirmNewSession() {
    if (confirm(`🆕 BẮT ĐẦU PHIÊN MỚI\n\n` +
                `Hành động này sẽ:\n` +
                `• Xóa dữ liệu quay thưởng hiện tại\n` +
                `• Bắt đầu phiên quay mới\n` +
                `• Danh sách nhân viên được tải lại\n\n` +
                `Tiếp tục?`)) {
        startNewSession();
    }
}

function resetAll() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    sessionStorage.setItem('forceRefresh', 'true');
    location.reload();
}

function startNewSession() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    sessionStorage.setItem('forceRefresh', 'true');
    
    winners = [];
    participants = [...allParticipants];
    lastSpinResults = [];
    
    if (currentPrizeConfig) {
        fetch('./config.json')
            .then(res => res.json())
            .then(data => {
                currentPrizeConfig = data[0];
                updateSidebar();
                alert("✅ Đã bắt đầu phiên mới!");
            });
    }
}

// ======================== QUAN TRỌNG: ĐIỀU KHIỂN NÚT BẤM ========================
function setButtonsState(disabled) {
    // Nút QUAY CHÍNH: bị disable khi:
    // 1. Đang quay (isSpinning)
    // 2. Không còn người để quay (participants rỗng)
    // 3. Không có config giải thưởng
    // 4. Đã hết giải thưởng (quantity <= 0)
    dom.btnSpin.disabled = disabled || 
                          participants.length === 0 || 
                          !currentPrizeConfig || 
                          currentPrizeConfig.quantity <= 0;
    
    // Nút LỘC BẤT NGỜ: bị disable khi:
    // 1. Đang quay (isSpinning)
    // 2. Không có danh sách nhân viên (allParticipants rỗng)
    // 3. Nút bị tắt (toggle không được check)
    if (dom.toggleLucky && dom.toggleLucky.checked) {
        // QUAN TRỌNG: Chỉ disable nếu đang quay hoặc không có danh sách
        // Không phụ thuộc vào participants hay currentPrizeConfig
        dom.btnLucky.disabled = disabled || allParticipants.length === 0;
    } else {
        dom.btnLucky.disabled = true;
    }
    
    // Nút XUẤT EXCEL: bị disable khi:
    // 1. Đang quay
    // 2. Không có kết quả
    if (dom.btnExport) {
        dom.btnExport.disabled = disabled || winners.length === 0;
    }
}

// ======================== UTILITY FUNCTIONS ========================
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function fireConfetti() {
    if (typeof confetti === 'function') {
        confetti({ 
            particleCount: 1000, 
            spread: 360, 
            startVelocity: 60, 
            origin: { y: 0.5 }, 
            colors: ['#ffd700', '#ffffff', '#ff0000'] 
        });
    }
}

function updateSidebar() {
    if (!dom.sidebarList) return;
    
    dom.sidebarList.innerHTML = '';
    
    if (winners.length === 0) {
        dom.sidebarList.innerHTML = '<div style="text-align: center; color: #ffcccb; margin-top: 20px;">Chưa có kết quả</div>';
        return;
    }
    
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

function closeModal() {
    stopResultSound();
    dom.modal.style.display = 'none';
    
    // Sau khi đóng modal, cập nhật lại trạng thái nút
    // QUAN TRỌNG: Gọi setButtonsState với false để kiểm tra lại điều kiện
    setButtonsState(false);
}

// ======================== XUẤT EXCEL ========================
async function exportWinners() {
    if (!lastSpinResults || lastSpinResults.length === 0) { 
        alert("Chưa có kết quả mới để xuất! Hãy quay thưởng trước."); 
        return; 
    }
    
    let csvContent = "\uFEFFMã Nhân Viên,Họ Và Tên,Giải Thưởng,Thời Gian,Ngày\n";
    lastSpinResults.forEach(w => {
        csvContent += `${w.id},"${w.name}",${w.prizeName},${w.timestamp},${w.date}\n`;
    });
    
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: `KetQua_${new Date().toISOString().slice(0,10)}.csv`,
                types: [{ description: 'CSV File', accept: {'text/csv': ['.csv']} }],
            });
            const writable = await handle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            alert("✅ Đã lưu file thành công!");
        } else {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `KetQua_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }
    } catch (err) {
        console.error('Lỗi xuất file:', err);
        alert("❌ Lỗi khi xuất file!");
    }
}

// ======================== VISUAL EFFECTS ========================
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
            tag.el.style.color = '#fff';
            tag.el.style.textShadow = '0 0 10px #ffd700';
        } else {
            tag.el.style.color = 'rgba(255, 215, 0, 0.6)';
            tag.el.style.textShadow = 'none';
        }
    });
    
    animationFrameId = requestAnimationFrame(animate);
}

// ======================== ÂM THANH ========================
function playSpinSound() {
    spinSound.currentTime = 0;
    spinSound.play().catch(e => console.log("Audio spin: Chưa tương tác user"));
}

function stopSpinSound() {
    spinSound.pause();
    spinSound.currentTime = 0;
}

function playResultSound() {
    resultSound.currentTime = 0;
    resultSound.play().catch(e => console.log("Audio result: Chưa tương tác user"));
}

function stopResultSound() {
    resultSound.pause();
    resultSound.currentTime = 0;
}

// ======================== CẢNH BÁO F5 ========================
function setupBeforeUnload() {
    window.addEventListener('beforeunload', function (e) {
        if (winners.length > 0 && !sessionStorage.getItem('forceRefresh')) {
            e.preventDefault();
            e.returnValue = 'Dữ liệu quay thưởng sẽ được lưu tự động. Bạn có chắc muốn tải lại trang?';
            return 'Dữ liệu quay thưởng sẽ được lưu tự động. Bạn có chắc muốn tải lại trang?';
        }
    });
    
    if (sessionStorage.getItem('forceRefresh')) {
        setTimeout(() => {
            sessionStorage.removeItem('forceRefresh');
        }, 1000);
    }
}

// ======================== HELPER FUNCTIONS ========================
function checkSystemReady() {
    // Kiểm tra và cập nhật trạng thái nút QUAY CHÍNH
    if (participants.length > 0 && currentPrizeConfig && currentPrizeConfig.quantity > 0) {
        dom.btnSpin.disabled = false;
    } else {
        dom.btnSpin.disabled = true;
    }
    
    // QUAN TRỌNG: Kiểm tra và cập nhật trạng thái nút LỘC BẤT NGỜ
    // Nút Lộc Bất Ngờ luôn sẵn sàng nếu có danh sách nhân viên và toggle được bật
    if (dom.toggleLucky && dom.toggleLucky.checked && allParticipants.length > 0) {
        dom.btnLucky.disabled = false;
    }
}

function updateStatus(id, text, type) {
    const el = document.getElementById(id);
    if (el) {
        const valEl = el.querySelector('.val');
        if (valEl) {
            valEl.innerText = text;
            valEl.className = `val ${type}`;
        }
    }
}

function toggleSidebar() {
    document.getElementById('adminPanel').classList.toggle('active');
}

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
    if (cb && btn) {
        btn.style.display = cb.checked ? 'block' : 'none';
        // QUAN TRỌNG: Khi toggle thay đổi, cập nhật lại trạng thái nút
        setButtonsState(isSpinning);
    }
}

async function fetchExcelFile(url) {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, {type: 'array'});
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1});
}

// ======================== THÊM STYLE CHO LUCKY RESULT ========================
const luckyStyle = document.createElement('style');
luckyStyle.textContent = `
    .lucky-result-box {
        transform: scale(1.8); 
        width: 350px; 
        padding: 30px; 
        background: linear-gradient(135deg, #ff0000, #ffd700); 
        border: 3px solid #fff; 
        box-shadow: 0 0 80px #ffd700; 
        border-radius: 15px; 
        text-align: center;
    }
    .lucky-title {
        font-size: 24px; 
        font-weight: 900; 
        color: #fff; 
        margin-bottom: 5px; 
        font-family: 'Orbitron'; 
        text-shadow: 2px 2px 4px #000;
    }
    .lucky-name {
        font-size: 28px; 
        font-weight: 900; 
        color: #fff; 
        margin-bottom: 10px; 
        font-family: 'Orbitron'; 
        text-shadow: 2px 2px 4px #000;
    }
    .lucky-id {
        font-size: 22px; 
        color: #800000; 
        font-weight: bold;
        margin-bottom: 15px;
    }
    .lucky-prize {
        font-size: 20px; 
        color: #fff; 
        margin-top: 15px; 
        font-style: italic;
        background: rgba(0,0,0,0.3);
        padding: 10px;
        border-radius: 10px;
    }
`;
document.head.appendChild(luckyStyle);