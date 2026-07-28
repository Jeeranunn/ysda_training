// 🔗 ลิงก์ Apps Script ล่าสุด
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzFnJVaprZ1eAAALXZ1JytP-K4jEvKwzvN3vQAh3gNvQx_42ZsGICVpTsm8UMYO6DIM/exec";

let availableCourses = []; 
let player, maxTimeWatched = 0, actualWatchTime = 0, allLessons = [], currentGlobalIdx = -1, pendingLessonIdx = -1;
let completedLessons = [];
let isPolicyAccepted = false;
let myPermissions = {};  
let rawLessonsData = []; 
let activeCourseId = ""; 
let globalClassrooms = {}; 
let globalCourseImages = {}; 
let selectedNoteFile = null;
let currentMemberCode = "";

function openNoteModal() {
    if (!allLessons || allLessons.length === 0) { alert("กรุณาเลือกคอร์สและเปิดบทเรียนก่อนครับ"); return; }
    const sel = document.getElementById('note-lesson-select');
    sel.innerHTML = "";
    allLessons.forEach((lesson, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `${lesson.module} · ตอนที่ ${lesson.id}: ${lesson.title}`;
        sel.appendChild(opt);
    });
    if (currentGlobalIdx >= 0) sel.value = currentGlobalIdx;

    selectedNoteFile = null;
    document.getElementById('note-member-code').value = currentMemberCode;
    document.getElementById('note-file-drop').classList.remove('has-file');
    document.getElementById('note-file-drop-text').innerText = "📎 แตะเพื่อเลือกไฟล์ (ไม่เกิน 10MB)";
    document.getElementById('note-file-input').value = "";
    const status = document.getElementById('note-status');
    status.className = "note-status"; status.innerText = "";
    const btn = document.getElementById('note-submit-btn');
    btn.disabled = false; btn.innerText = "ส่งโน๊ต";

    document.getElementById('note-modal').style.display = 'flex';
}

function closeNoteModal() {
    document.getElementById('note-modal').style.display = 'none';
}

function handleNoteFileSelect(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        alert("ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 10MB");
        input.value = "";
        return;
    }
    selectedNoteFile = file;
    document.getElementById('note-file-drop').classList.add('has-file');
    document.getElementById('note-file-drop-text').innerText = "✅ " + file.name;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function submitNoteFile() {
    const lessonIdx = document.getElementById('note-lesson-select').value;
    const status = document.getElementById('note-status');
    const btn = document.getElementById('note-submit-btn');

    if (!currentMemberCode) { status.className = "note-status err"; status.innerText = "❌ ไม่พบรหัสสมาชิก กรุณาล็อกอินใหม่"; return; }
    if (!selectedNoteFile) { status.className = "note-status err"; status.innerText = "❌ กรุณาเลือกไฟล์ก่อน"; return; }

    const lesson = allLessons[lessonIdx];
    btn.disabled = true; btn.innerText = "กำลังส่ง...";
    status.className = "note-status pending"; status.innerText = "⏳ กำลังอัพโหลดไฟล์ อย่าเพิ่งปิดหน้าต่างนี้...";

    try {
        const base64 = await fileToBase64(selectedNoteFile);
        const payload = {
            action: "uploadFile", fileType: "note", memberCode: currentMemberCode,
            course: activeCourseId, module: lesson.module, lessonId: lesson.id, lessonTitle: lesson.title,
            fileName: selectedNoteFile.name, mimeType: selectedNoteFile.type || "application/octet-stream", fileData: base64
        };
        const res = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.result === true) {
            status.className = "note-status ok"; status.innerText = "✅ ส่งโน๊ตสำเร็จแล้ว! ขอบคุณครับ";
            btn.innerText = "ส่งแล้ว ✓";
            setTimeout(() => { closeNoteModal(); }, 1500);
        } else {
            status.className = "note-status err"; status.innerText = "❌ " + (data.msg || "ส่งไม่สำเร็จ กรุณาลองใหม่");
            btn.disabled = false; btn.innerText = "ส่งโน๊ต";
        }
    } catch (err) {
        status.className = "note-status err"; status.innerText = "❌ เชื่อมต่อผิดพลาด กรุณาลองใหม่";
        btn.disabled = false; btn.innerText = "ส่งโน๊ต";
    }
}

async function uploadMissionFile(file, fileType, lesson, statusEl, btnEl) {
    statusEl.className = "note-status pending"; statusEl.innerText = "⏳ กำลังอัพโหลดไฟล์...";
    btnEl.disabled = true;
    try {
        const base64 = await fileToBase64(file);
        const payload = {
            action: "uploadFile", fileType: fileType, memberCode: currentMemberCode,
            course: activeCourseId, module: lesson.module, lessonId: lesson.id, lessonTitle: lesson.title,
            fileName: file.name, mimeType: file.type || "application/octet-stream", fileData: base64
        };
        const res = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.result === true) {
            statusEl.className = "note-status ok"; statusEl.innerText = "✅ ส่งสำเร็จแล้ว! ขอบคุณครับ";
            btnEl.innerText = "ส่งแล้ว ✓";
        } else {
            statusEl.className = "note-status err"; statusEl.innerText = "❌ " + (data.msg || "ส่งไม่สำเร็จ กรุณาลองใหม่");
            btnEl.disabled = false; btnEl.innerText = "ส่งไฟล์";
        }
    } catch (err) {
        statusEl.className = "note-status err"; statusEl.innerText = "❌ เชื่อมต่อผิดพลาด กรุณาลองใหม่";
        btnEl.disabled = false; btnEl.innerText = "ส่งไฟล์";
    }
}

async function submitMissionScore(lesson, missionType, score, maxScore) {
    if (!currentMemberCode) return;
    try {
        const payload = {
            action: "saveMissionScore", memberCode: currentMemberCode, course: activeCourseId,
            module: lesson.module, lessonId: lesson.id, lessonTitle: lesson.title,
            missionType: missionType, score: score, maxScore: maxScore
        };
        await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) });
    } catch (err) {
        console.log("บันทึกคะแนนมิชชันไม่สำเร็จ:", err);
    }
}

function renderMissionSection(lesson) {
    const box = document.getElementById('mission-section');
    box.innerHTML = "";
    const type = (lesson.mission_type || "").toString().trim().toLowerCase();
    if (!type) { return; }

    let data = {};
    try { data = lesson.mission_data ? JSON.parse(lesson.mission_data) : {}; }
    catch (e) { console.log("mission_data JSON ผิดพลาด:", e); data = {}; }

    const wrap = document.createElement('div');
    wrap.className = 'mission-box';

    if (type === 'diagram') renderDiagramMission(wrap, lesson, data);
    else if (type === 'matching') renderMatchingMission(wrap, lesson, data);
    else if (type === 'truefalse') renderTrueFalseMission(wrap, lesson, data);
    else if (type === 'game') renderGameMission(wrap, lesson, data);
    else return;

    box.appendChild(wrap);
}

function renderDiagramMission(wrap, lesson, data) {
    wrap.innerHTML = `
        <div class="mission-eyebrow">มิชชันประจำบท · แผนภาพ</div>
        <div class="mission-heading">${data.title || "🖍️ วาดแผนภาพสรุปความเข้าใจของคุณ"}</div>
        <div class="mission-instructions">${data.instructions || "วาดแผนภาพ (mind map / แผนภูมิ) สรุปสิ่งที่ได้เรียนรู้จากคลิปนี้ลงบนกระดาษหรือแอปที่ถนัด แล้วถ่ายรูป/สแกน อัพโหลดไฟล์ส่งที่นี่"}</div>
        <div class="file-drop" id="diagram-file-drop" onclick="document.getElementById('diagram-file-input').click()">
            <div class="file-drop-text" id="diagram-file-drop-text">📎 แตะเพื่อเลือกไฟล์แผนภาพ (ไม่เกิน 10MB)</div>
            <input type="file" id="diagram-file-input" accept="image/*,.pdf" style="display:none;">
        </div>
        <div style="margin-top:14px; text-align:right;">
            <button class="mission-action-btn" id="diagram-submit-btn">ส่งไฟล์</button>
        </div>
        <div class="note-status" id="diagram-status"></div>
    `;
    const fileInput = wrap.querySelector('#diagram-file-input');
    const drop = wrap.querySelector('#diagram-file-drop');
    const dropText = wrap.querySelector('#diagram-file-drop-text');
    let chosenFile = null;
    fileInput.onchange = () => {
        const f = fileInput.files[0];
        if (!f) return;
        if (f.size > 10 * 1024 * 1024) { alert("ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 10MB"); fileInput.value=""; return; }
        chosenFile = f;
        drop.classList.add('has-file');
        dropText.innerText = "✅ " + f.name;
    };
    wrap.querySelector('#diagram-submit-btn').onclick = () => {
        const statusEl = wrap.querySelector('#diagram-status');
        const btnEl = wrap.querySelector('#diagram-submit-btn');
        if (!chosenFile) { statusEl.className="note-status err"; statusEl.innerText="❌ กรุณาเลือกไฟล์ก่อน"; return; }
        uploadMissionFile(chosenFile, "diagram", lesson, statusEl, btnEl);
    };
}

function renderTrueFalseMission(wrap, lesson, data) {
    const statements = Array.isArray(data.statements) ? data.statements : [];
    wrap.innerHTML = `
        <div class="mission-eyebrow">มิชชันประจำบท · ถูกหรือผิด</div>
        <div class="mission-heading">${data.title || "✅ ทบทวนความเข้าใจ"}</div>
        <div class="mission-instructions">${data.instructions || "อ่านแต่ละข้อความ แล้วกดว่า จริง หรือ เท็จ ตามเนื้อหาที่เรียนไป"}</div>
    `;
    if (statements.length === 0) {
        wrap.innerHTML += `<div class="mission-instructions">ยังไม่มีข้อมูลมิชชันสำหรับบทนี้ กรุณาติดต่อผู้ดูแลระบบ</div>`;
        return;
    }
    let correctCount = 0, answeredCount = 0, scoreReported = false;
    statements.forEach((s, i) => {
        const card = document.createElement('div'); card.className = 'tf-card';
        card.innerHTML = `
            <div class="tf-text">${i+1}. ${s.text}</div>
            <div class="tf-btns">
                <button class="tf-btn" data-val="true">จริง</button>
                <button class="tf-btn" data-val="false">เท็จ</button>
            </div>
            <div class="tf-explain"></div>
        `;
        const btns = card.querySelectorAll('.tf-btn');
        const explainEl = card.querySelector('.tf-explain');
        btns.forEach(b => {
            b.onclick = () => {
                if (b.dataset.locked) return;
                const picked = b.dataset.val === 'true';
                const correct = picked === !!s.answer;
                btns.forEach(x => { x.disabled = true; x.dataset.locked = "1"; });
                b.classList.add(correct ? 'correct-pick' : 'wrong-pick');
                explainEl.classList.add('show', correct ? 'ok' : 'bad');
                explainEl.innerHTML = (correct ? '✓ ถูกต้อง — ' : '✕ ยังไม่ตรง — ') + (s.explain || "");
                if (correct) correctCount++;
                answeredCount++;
                if (answeredCount === statements.length && !scoreReported) {
                    scoreReported = true;
                    submitMissionScore(lesson, 'truefalse', correctCount, statements.length);
                    const done = document.createElement('div');
                    done.className = 'mission-done-banner';
                    done.style.marginTop = '12px';
                    done.innerText = `🎉 ทำครบแล้ว! ได้ ${correctCount} / ${statements.length} ข้อ (บันทึกคะแนนแล้ว)`;
                    wrap.appendChild(done);
                }
            };
        });
        wrap.appendChild(card);
    });
}

function renderMatchingMission(wrap, lesson, data) {
    const pairs = Array.isArray(data.pairs) ? data.pairs : [];
    wrap.innerHTML = `
        <div class="mission-eyebrow">มิชชันประจำบท · จับคู่</div>
        <div class="mission-heading">${data.title || "🔗 จับคู่ให้ถูกต้อง"}</div>
        <div class="mission-instructions">${data.instructions || "แตะเลือกฝั่งซ้าย 1 ข้อ แล้วแตะฝั่งขวาที่คิดว่าคู่กัน ถ้าถูกจะติดค้างเป็นสีเขียว"}</div>
        <div class="match-wrap">
            <div class="match-col" id="match-left"></div>
            <div class="match-col" id="match-right"></div>
        </div>
        <div class="match-progress" id="match-progress"></div>
    `;
    if (pairs.length === 0) {
        wrap.innerHTML += `<div class="mission-instructions">ยังไม่มีข้อมูลมิชชันสำหรับบทนี้ กรุณาติดต่อผู้ดูแลระบบ</div>`;
        return;
    }
    const leftCol = wrap.querySelector('#match-left');
    const rightCol = wrap.querySelector('#match-right');
    const progressEl = wrap.querySelector('#match-progress');
    const leftItems = pairs.map((p, i) => ({ text: p.left, pairId: i }));
    const rightItems = shuffleArr(pairs.map((p, i) => ({ text: p.right, pairId: i })));
    let selectedLeft = null, matchedCount = 0;

    function updateProgress() {
        progressEl.innerText = `จับคู่แล้ว ${matchedCount} / ${pairs.length} คู่`;
        if (matchedCount === pairs.length) {
            submitMissionScore(lesson, 'matching', pairs.length, pairs.length);
            const done = document.createElement('div');
            done.className = 'mission-done-banner';
            done.innerText = '🎉 จับคู่ครบถูกต้องทุกคู่แล้ว เก่งมาก! (บันทึกคะแนนแล้ว)';
            wrap.appendChild(done);
        }
    }
    leftItems.forEach(item => {
        const el = document.createElement('div');
        el.className = 'match-item'; el.innerText = item.text;
        el.onclick = () => {
            if (el.classList.contains('matched')) return;
            leftCol.querySelectorAll('.match-item').forEach(x => x.classList.remove('selected'));
            el.classList.add('selected');
            selectedLeft = { el, pairId: item.pairId };
        };
        leftCol.appendChild(el);
    });
    rightItems.forEach(item => {
        const el = document.createElement('div');
        el.className = 'match-item'; el.innerText = item.text;
        el.onclick = () => {
            if (el.classList.contains('matched') || !selectedLeft) return;
            if (item.pairId === selectedLeft.pairId) {
                el.classList.add('matched');
                selectedLeft.el.classList.add('matched');
                selectedLeft.el.classList.remove('selected');
                selectedLeft = null; matchedCount++; updateProgress();
            } else {
                el.classList.add('wrong-flash');
                setTimeout(() => el.classList.remove('wrong-flash'), 500);
            }
        };
        rightCol.appendChild(el);
    });
    updateProgress();
}

function shuffleArr(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function renderGameMission(wrap, lesson, data) {
    const stages = [];
    if (Array.isArray(data.statements) && data.statements.length) stages.push('truefalse');
    if (data.scenario && Array.isArray(data.scenario.options)) stages.push('scenario');
    if (Array.isArray(data.sequence) && data.sequence.length) stages.push('sequence');
    if (stages.length === 0) {
        wrap.innerHTML = `
            <div class="mission-eyebrow">มิชชันประจำบท · เกม</div>
            <div class="mission-heading">${data.title || "🎮 มิชชันท้ายบท"}</div>
            <div class="mission-instructions">ยังไม่มีข้อมูลมิชชันสำหรับบทนี้ กรุณาติดต่อผู้ดูแลระบบ</div>
        `;
        return;
    }
    let stageIdx = 0, gameScore = 0, gameScoreReported = false;
    const maxGameScore =
        (Array.isArray(data.statements) ? data.statements.length : 0) +
        (stages.includes('scenario') ? 2 : 0) +
        (stages.includes('sequence') ? 2 : 0);
    const stageNames = { truefalse: 'จับผิด', scenario: 'สถานการณ์', sequence: 'เรียงลำดับ' };

    function renderStageTabs() {
        let html = '<div class="game-stage-tabs">';
        stages.forEach((s, i) => {
            const cls = i === stageIdx ? 'active' : (i < stageIdx ? 'done' : '');
            html += `<span class="game-stage-tab ${cls}">${i+1}. ${stageNames[s]}</span>`;
        });
        html += '</div>';
        return html;
    }

    function renderStage() {
        const header = `
            <div class="mission-eyebrow">มิชชันประจำบท · เกม</div>
            <div class="mission-heading">${data.title || "🎮 มิชชันท้ายบท"}</div>
            ${renderStageTabs()}
        `;
        if (stageIdx >= stages.length) {
            wrap.innerHTML = header;
            if (!gameScoreReported) {
                gameScoreReported = true;
                submitMissionScore(lesson, 'game', gameScore, maxGameScore);
            }
            const done = document.createElement('div');
            done.className = 'mission-done-banner';
            done.innerText = `🎉 ผ่านมิชชันครบแล้ว! คะแนนรวม ${gameScore} / ${maxGameScore} คะแนน (บันทึกคะแนนแล้ว)`;
            wrap.appendChild(done);
            return;
        }
        const stageType = stages[stageIdx];
        wrap.innerHTML = header;

        if (stageType === 'truefalse') {
            const list = document.createElement('div');
            data.statements.forEach((s, i) => {
                const card = document.createElement('div'); card.className = 'tf-card';
                card.innerHTML = `
                    <div class="tf-text">${i+1}. ${s.text}</div>
                    <div class="tf-btns">
                        <button class="tf-btn" data-val="true">จริง</button>
                        <button class="tf-btn" data-val="false">เท็จ</button>
                    </div>
                    <div class="tf-explain"></div>
                `;
                const btns = card.querySelectorAll('.tf-btn');
                const explainEl = card.querySelector('.tf-explain');
                btns.forEach(b => {
                    b.onclick = () => {
                        if (b.dataset.locked) return;
                        const picked = b.dataset.val === 'true';
                        const correct = picked === !!s.answer;
                        btns.forEach(x => { x.disabled = true; x.dataset.locked = "1"; });
                        b.classList.add(correct ? 'correct-pick' : 'wrong-pick');
                        explainEl.classList.add('show', correct ? 'ok' : 'bad');
                        explainEl.innerHTML = (correct ? '✓ ถูกต้อง — ' : '✕ ยังไม่ตรง — ') + (s.explain || "");
                        if (correct) { gameScore++; }
                        checkStageDone();
                    };
                });
                list.appendChild(card);
            });
            wrap.appendChild(list);
            addNextBtn(() => allAnswered(list, data.statements.length));
        }

        if (stageType === 'scenario') {
            const sc = data.scenario;
            const brief = document.createElement('div');
            brief.className = 'mission-instructions'; brief.innerText = sc.brief || "";
            wrap.appendChild(brief);
            const q = document.createElement('div');
            q.style.cssText = 'font-weight:bold; margin-bottom:10px; font-size:0.92em; color:var(--text-navy);';
            q.innerText = sc.question || "";
            wrap.appendChild(q);
            let selected = null, revealed = false;
            const optWrap = document.createElement('div');
            sc.options.forEach((opt, i) => {
                const item = document.createElement('div'); item.className = 'game-option'; item.innerText = opt;
                item.onclick = () => {
                    if (revealed) return;
                    optWrap.querySelectorAll('.game-option').forEach(x => x.classList.remove('selected'));
                    item.classList.add('selected'); selected = i; confirmBtn.disabled = false;
                };
                optWrap.appendChild(item);
            });
            wrap.appendChild(optWrap);
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'mission-action-btn'; confirmBtn.innerText = 'ยืนยันคำตอบ'; confirmBtn.disabled = true;
            confirmBtn.style.marginTop = '10px';
            confirmBtn.onclick = () => {
                revealed = true;
                optWrap.querySelectorAll('.game-option').forEach((x, i) => {
                    if (i === sc.correctIndex) x.classList.add('correct-reveal');
                    else if (i === selected) x.classList.add('wrong-reveal');
                });
                if (selected === sc.correctIndex) gameScore += 2;
                const fb = document.createElement('div');
                fb.className = 'tf-explain show ' + (selected === sc.correctIndex ? 'ok' : 'bad');
                fb.style.marginTop = '10px';
                fb.innerText = (selected === sc.correctIndex ? '✓ ถูกต้อง — ' : '✕ ยังไม่ตรง — ') + (sc.explain || "");
                wrap.appendChild(fb);
                confirmBtn.style.display = 'none';
                addNextBtn(() => true);
            };
            wrap.appendChild(confirmBtn);
        }

        if (stageType === 'sequence') {
            let order = shuffleArr(data.sequence);
            if (JSON.stringify(order) === JSON.stringify(data.sequence)) order.reverse();
            const brief = document.createElement('div');
            brief.className = 'mission-instructions';
            brief.innerText = data.sequenceInstructions || "จัดลำดับข้อความให้ถูกต้องด้วยปุ่มลูกศร";
            wrap.appendChild(brief);
            const listEl = document.createElement('div');
            function drawList() {
                listEl.innerHTML = "";
                order.forEach((txt, i) => {
                    const item = document.createElement('div'); item.className = 'seq-item-g';
                    item.innerHTML = `<span class="seq-num-g">${i+1}</span><span>${txt}</span>`;
                    const btns = document.createElement('div'); btns.className = 'seq-move-g';
                    const up = document.createElement('button'); up.className = 'mini-btn-g'; up.innerText = '↑'; up.disabled = i===0;
                    up.onclick = () => { [order[i-1], order[i]] = [order[i], order[i-1]]; drawList(); };
                    const down = document.createElement('button'); down.className = 'mini-btn-g'; down.innerText = '↓'; down.disabled = i===order.length-1;
                    down.onclick = () => { [order[i+1], order[i]] = [order[i], order[i+1]]; drawList(); };
                    btns.appendChild(up); btns.appendChild(down);
                    item.appendChild(btns);
                    listEl.appendChild(item);
                });
            }
            drawList();
            wrap.appendChild(listEl);
            const checkBtn = document.createElement('button');
            checkBtn.className = 'mission-action-btn'; checkBtn.innerText = 'ตรวจคำตอบ';
            checkBtn.onclick = () => {
                const correct = JSON.stringify(order) === JSON.stringify(data.sequence);
                const fb = document.createElement('div');
                fb.className = 'tf-explain show ' + (correct ? 'ok' : 'bad');
                fb.style.marginTop = '10px';
                fb.innerText = correct ? '✓ เรียงถูกต้องแล้ว!' : '✕ ยังไม่ตรงลำดับ ลองจัดใหม่ดูอีกครั้ง';
                wrap.appendChild(fb);
                if (correct) { gameScore += 2; checkBtn.style.display = 'none'; addNextBtn(() => true); }
            };
            wrap.appendChild(checkBtn);
        }

        function addNextBtn(canProceedFn) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'mission-action-btn';
            nextBtn.innerText = stageIdx === stages.length - 1 ? 'สรุปมิชชัน' : 'ด่านถัดไป →';
            nextBtn.style.marginTop = '14px';
            nextBtn.style.display = canProceedFn() ? 'inline-block' : 'none';
            nextBtn.onclick = () => { stageIdx++; renderStage(); };
            wrap.appendChild(nextBtn);
            wrap._checkFn = canProceedFn; wrap._nextBtnRef = nextBtn;
        }
        function checkStageDone() {
            if (wrap._checkFn && wrap._nextBtnRef) wrap._nextBtnRef.style.display = wrap._checkFn() ? 'inline-block' : 'none';
        }
        function allAnswered(listEl, total) {
            return listEl.querySelectorAll('.tf-btn:disabled').length >= total * 2;
        }
    }
    renderStage();
}

function togglePrepBox() {
    const box = document.getElementById('prep-box');
    const arrow = document.getElementById('prep-arrow');
    box.style.display = (box.style.display === 'block') ? 'none' : 'block';
    arrow.innerText = (box.style.display === 'block') ? '▲' : '▼';
}

async function handleLogin() {
    const code = document.getElementById('login-code').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const error = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    if (!code || !pass) { error.innerText = "❌ กรุณากรอกรหัสสมาชิกและรหัสผ่าน"; error.style.display = "block"; return; }
    btn.disabled = true; btn.innerText = "กำลังเข้าสู่ระบบและโหลดบทเรียน...";
    try {
        const response = await fetch(`${WEB_APP_URL}?code=${encodeURIComponent(code)}&pass=${encodeURIComponent(pass)}`);
        const data = await response.json();
        if (data.result === true) {
            myPermissions = data.permissions;
            rawLessonsData = data.lessons;
            globalClassrooms = data.classrooms || {};
            globalCourseImages = data.courseImages || {};
            currentMemberCode = code;
            availableCourses = Object.keys(myPermissions).map(key => ({ id: key, name: key + " Course" }));
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('dashboard-screen').style.display = 'block';
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('memberCode', code);
            completedLessons = JSON.parse(localStorage.getItem(`completed_${code}`) || "[]");
            renderCourseDashboard();
        } else {
            error.innerText = "❌ " + (data.msg || "ข้อมูลไม่ถูกต้อง"); error.style.display = "block"; btn.disabled = false; btn.innerText = "เข้าสู่ระบบ";
        }
    } catch (e) {
        error.innerText = "❌ เชื่อมต่อหลังบ้านผิดพลาด กรุณาลองใหม่"; error.style.display = "block"; btn.disabled = false; btn.innerText = "เข้าสู่ระบบ";
    }
}

function renderCourseDashboard() {
    const grid = document.getElementById('course-grid');
    grid.innerHTML = "";
    availableCourses.forEach(c => {
        const isAllowed = myPermissions[c.id];
        const imgUrl = globalCourseImages[c.id] || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600";
        const card = document.createElement('div');
        card.className = 'course-card-item';
        if (isAllowed) {
            card.innerHTML = `
                <img src="${imgUrl}" class="course-card-img" alt="${c.name}">
                <div class="course-card-body">
                    <h3 class="course-card-title">📖 ${c.name}</h3>
                    <button class="course-card-btn btn-allowed" onclick="startCourse('${c.id}', '${c.name}')">🎯 เข้าสู่บทเรียน (อนุมัติแล้ว)</button>
                </div>
            `;
        } else {
            card.innerHTML = `
                <img src="${imgUrl}" class="course-card-img" alt="${c.name}" style="filter: grayscale(1); opacity: 0.6;">
                <div class="course-card-body">
                    <h3 class="course-card-title" style="color: #a0aec0;">🔒 ${c.name}</h3>
                    <button class="course-card-btn btn-locked" onclick="alert('คอร์สนี้ยังไม่ได้รับการอนุมัติให้เข้าเรียนครับ กรุณาติดต่อแอดมิน')">⏰ รอการเปิดระบบอนุมัติ</button>
                </div>
            `;
        }
        grid.appendChild(card);
    });
}

function backToMainMenu() {
    activeCourseId = "";
    if(player && player.pauseVideo) player.pauseVideo();
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    document.getElementById('vid-box').style.display = 'none';
    document.getElementById('status').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('doc-btn').style.display = 'none';
    document.getElementById('assignment-btn').style.display = 'none';
    document.getElementById('prog-sec').style.display = 'none';
    document.getElementById('prep-btn').style.display = 'none';
    document.getElementById('prep-box').style.display = 'none';
    document.getElementById('note-btn').style.display = 'none';
    document.getElementById('mission-section').innerHTML = '';
    document.getElementById('current-title').innerText = "🏠 ยินดีต้อนรับ! กรุณาเลือกคอร์สเรียน";
    renderCourseDashboard();
}

function startCourse(courseId, courseName) {
    activeCourseId = courseId;
    document.getElementById('dashboard-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    document.getElementById('sidebar-title').innerText = "⬅️ เมนูหลัก";
    document.getElementById('current-title').innerText = `คอร์ส: ${courseName} (กรุณาเลือกตอนเรียนด้านข้าง)`;
    document.getElementById('prog-sec').style.display = 'flex';
    document.getElementById('note-btn').style.display = 'flex';
    const mainClassroomLink = document.getElementById('main-classroom-link');
    if (globalClassrooms[courseId] && globalClassrooms[courseId].trim() !== "") {
        mainClassroomLink.href = globalClassrooms[courseId].trim();
        document.getElementById('prep-btn').style.display = 'flex';
    } else {
        mainClassroomLink.href = "#";
        document.getElementById('prep-btn').style.display = 'none';
    }
    const menu = document.getElementById('lesson-menu');
    menu.innerHTML = ""; allLessons = [];
    const courseLessons = rawLessonsData.filter(item => item.course === courseId);
    const modulesMap = {};
    courseLessons.forEach(item => {
        if (!modulesMap[item.module]) {
            modulesMap[item.module] = [];
            const header = document.createElement('li');
            header.className = 'module-header'; header.innerText = item.module;
            menu.appendChild(header);
        }
        const idx = allLessons.length;
        allLessons.push(item);
        const li = document.createElement('li');
        li.className = 'lesson-item'; li.id = `item-${idx}`;
        li.innerHTML = `ตอนที่ ${item.id}: ${item.title}`;
        li.onclick = () => { showWarning(idx); if(window.innerWidth <= 768) toggleSidebar(); };
        menu.appendChild(li);
    });
    if(window.innerWidth > 768) document.getElementById('sidebar').classList.remove('collapsed');
    updateProgressUI();
}

function updateProgressUI() {
    if (activeCourseId === "") return;
    if (!allLessons || allLessons.length === 0) {
        document.getElementById('overall-progress').style.width = "0%";
        document.getElementById('progress-percent').innerText = "0%";
        return;
    }
    let completedInThisCourse = 0;
    allLessons.forEach((lesson, i) => {
        const el = document.getElementById(`item-${i}`);
        const storageKey = `${activeCourseId}_${lesson.module}_${lesson.id}`;
        if (completedLessons.includes(storageKey)) { completedInThisCourse++; if (el) el.classList.add('completed'); }
        else { if (el) el.classList.remove('completed'); }
    });
    const percent = Math.round((completedInThisCourse / allLessons.length) * 100);
    document.getElementById('overall-progress').style.width = percent + "%";
    document.getElementById('progress-percent').innerText = percent + "%";
}

function saveProgress(index) {
    const lesson = allLessons[index];
    const storageKey = `${activeCourseId}_${lesson.module}_${lesson.id}`;
    if (!completedLessons.includes(storageKey)) {
        completedLessons.push(storageKey);
        localStorage.setItem(`completed_${currentMemberCode}`, JSON.stringify(completedLessons));
        fetch(`${WEB_APP_URL}?action=saveProgress&code=${encodeURIComponent(currentMemberCode)}&course=${encodeURIComponent(activeCourseId)}&lessonId=${encodeURIComponent(lesson.id)}`)
        .then(res => res.json())
        .then(data => console.log("Cloud Sync Status:", data.msg))
        .catch(err => console.log("Cloud Sync Connection Error:", err));
    }
    updateProgressUI();
}

function handleLogout() {
    if(confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('memberCode');
        isPolicyAccepted = false; currentMemberCode = "";
        if(player && player.pauseVideo) player.pauseVideo();
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('dashboard-screen').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-pass').value = "";
        document.getElementById('login-code').value = "";
        const btn = document.getElementById('login-btn');
        btn.disabled = false; btn.innerText = "เข้าสู่ระบบ";
        document.getElementById('login-error').style.display = "none";
        document.getElementById('sidebar-title').innerText = "🏠 เมนูหลัก";
        document.getElementById('note-btn').style.display = 'none';
        document.getElementById('mission-section').innerHTML = '';
        activeCourseId = "";
    }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

document.getElementById('accept-policy').addEventListener('change', function(e) {
    const btn = document.getElementById('confirm-btn');
    if(e.target.checked) { btn.style.background = 'var(--glam-navy-start)'; btn.style.cursor = 'pointer'; btn.disabled = false; }
    else { btn.style.background = '#a0aec0'; btn.style.cursor = 'not-allowed'; btn.disabled = true; }
});

function showWarningOnStart() {
    pendingLessonIdx = 0; resetModalUI();
    document.getElementById('warning-modal').style.display = 'flex';
    if (player && player.pauseVideo) player.pauseVideo();
}

document.getElementById('sidebar-title').onclick = function() { if (activeCourseId !== "") backToMainMenu(); };

function showWarning(index) {
    if (index === currentGlobalIdx && isPolicyAccepted) return;
    pendingLessonIdx = index; resetModalUI();
    document.getElementById('warning-modal').style.display = 'flex';
    if (player && player.pauseVideo) player.pauseVideo();
}

function strictConfirm() {
    isPolicyAccepted = true;
    document.getElementById('warning-modal').style.display = 'none';
    loadLesson(pendingLessonIdx);
}

function showModalWarning(title, message) {
    const modal = document.getElementById('warning-modal');
    modal.style.display = 'flex';
    document.querySelector('.modal-content h1').innerText = title;
    document.querySelector('.policy-box').innerHTML = message;
    document.getElementById('accept-policy').style.display = 'none';
    document.querySelector('label').style.display = 'none';
    const confirmBtn = document.getElementById('confirm-btn');
    confirmBtn.innerText = "รับทราบและตั้งใจเรียนต่อ";
    confirmBtn.disabled = false;
    confirmBtn.style.background = 'var(--glam-navy-start)';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.onclick = () => { modal.style.display = 'none'; if (player && player.playVideo) player.playVideo(); };
}

function resetModalUI() {
    document.querySelector('.modal-content h1').innerText = "คำเตือนและข้อตกลงสำคัญ";
    document.querySelector('.policy-box').innerHTML = `องค์กรต้องการเห็นกระบวนการเรียนรู้และคิดวิเคราะห์ที่กลั่นออกมาจากความเข้าใจของผู้เรียน มากกว่าคำตอบที่สวยหรูซึ่งออกแบบมาจาก AI  <br><br>
        <b>เงื่อนไข:</b>
        <ul>
            <li>ห้ามใช้ AI ช่วยรับชมคลิป, ทำแบบฝึกหัด หรือทำแผนภาพ</li>
            <li>ทีมงานจะใช้โปรแกรมตรวจสอบ AI กับงานทุกชิ้น</li>
        </ul>
        <b>หากพบการทุจริต จะมีมาตรการดังต่อไปนี้:</b>
      <ul>
            <li> <b>ไล่ออกและตัดสิทธิ์สมาชิก (Terminate) ทันที</b></li>
            <li>ส่งหนังสือแจ้งพฤทีตกรรมไปยังสถานศึกษาต้นสังกัด </li>
           <li>ประกาศรายชื่อผู้ฝ่าฝืนบนเว็บไซต์</li>
        </ul>`;
    document.getElementById('accept-policy').style.display = 'inline-block';
    document.getElementById('accept-policy').checked = false;
    const label = document.querySelector('label');
    label.style.display = 'flex';
    document.querySelector('label span').innerText = "ข้าพเจ้ายอมรับเงื่อนไขทุกประการ หากฝ่าฝืนข้าพเจ้ายินยอมรับบทลงโทษสูงสุดโดยไม่มีข้อโต้แย้ง";
    const confirmBtn = document.getElementById('confirm-btn');
    confirmBtn.innerText = "ยืนยันและเข้าสู่บทเรียน";
    confirmBtn.disabled = true;
    confirmBtn.style.background = '#a0aec0';
    confirmBtn.style.cursor = 'not-allowed';
    confirmBtn.onclick = () => { strictConfirm(); };
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        playerVars: { 'enablejsapi': 1, 'modestbranding': 1, 'rel': 0, 'disablekb': 1 },
        events: {
            'onReady': () => { if (document.getElementById('warning-modal').style.display === 'flex') player.pauseVideo(); },
            'onStateChange': (e) => { if (e.data == YT.PlayerState.PLAYING && document.getElementById('warning-modal').style.display === 'flex') player.pauseVideo(); },
            'onPlaybackRateChange': (e) => {
                if (e.data !== 1) {
                    player.setPlaybackRate(1); player.pauseVideo();
                    showModalWarning("⚠️ ตรวจพบการเร่งความเร็ว", "ไม่อนุญาตให้เร่งความเร็วในการรับชมวิดีโอครับ <br>กรุณาเรียนรู้ด้วยความเร็วปกติเพื่อประสิทธิภาพสูงสุดในการทำความเข้าใจ");
                }
            }
        }
    });
}

function loadLesson(index) {
    currentGlobalIdx = index; maxTimeWatched = 0; actualWatchTime = 0;
    document.getElementById('vid-box').style.display = 'block';
    document.getElementById('status').style.display = 'block';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('current-title').innerText = allLessons[index].title;
    document.querySelectorAll('.lesson-item').forEach((el, i) => {
        if(el.id === `item-${index}`) el.classList.add('active'); else el.classList.remove('active');
    });
    const currentLesson = allLessons[index];
    const docBtn = document.getElementById('doc-btn');
    if (currentLesson.doc_url && currentLesson.doc_url.toString().trim() !== "") { docBtn.href = currentLesson.doc_url.toString().trim(); docBtn.style.display = 'flex'; }
    else docBtn.style.display = 'none';
    const assignmentBtn = document.getElementById('assignment-btn');
    if (currentLesson.assignment_url && currentLesson.assignment_url.toString().trim() !== "") { assignmentBtn.href = currentLesson.assignment_url.toString().trim(); assignmentBtn.style.display = 'flex'; }
    else assignmentBtn.style.display = 'none';
    renderMissionSection(currentLesson);
    if (player && player.loadVideoById) {
        const startTime = allLessons[index].start ? allLessons[index].start : 0;
        player.loadVideoById({ videoId: extractID(allLessons[index].url), startSeconds: startTime });
        maxTimeWatched = startTime;
        if(!isPolicyAccepted || document.getElementById('warning-modal').style.display === 'flex') setTimeout(() => { player.pauseVideo(); }, 500);
    }
    updateProgressUI();
}

function extractID(url) {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : url;
}

setInterval(() => {
    if (document.getElementById('warning-modal').style.display === 'flex' && player && player.getPlayerState && player.getPlayerState() === 1) { player.pauseVideo(); return; }
    if (player && player.getPlayerState && player.getPlayerState() === 1) {
        let curr = player.getCurrentTime();
        let duration = player.getDuration();
        if (curr > maxTimeWatched + 3.0) {
            player.pauseVideo(); player.seekTo(maxTimeWatched);
            showModalWarning("⚠️ ตรวจพบการข้ามวิดีโอ", "ไม่อนุญาตให้กดข้ามวิดีโอเด็ดขาดครับ <br>กรุณาเรียนรู้อย่างเป็นขั้นตอนเพื่อประโยชน์ของตัวคุณเอง");
        } else { maxTimeWatched = Math.max(maxTimeWatched, curr); actualWatchTime++; }
        if (duration > 0 && (curr / duration) >= 0.98) {
            if (actualWatchTime >= (duration * 0.95)) { document.getElementById('next-btn').style.display = 'block'; saveProgress(currentGlobalIdx); }
            else {
                player.pauseVideo(); player.seekTo(0); actualWatchTime = 0; maxTimeWatched = 0;
                alert("ระบบตรวจพบว่าคุณไม่ได้นั่งรับชมคลิปจริง กรุณาเริ่มรับชมใหม่อีกครั้งอย่างตั้งใจครับ");
            }
        }
    }
}, 1000);

function autoNext() {
    if (currentGlobalIdx < allLessons.length - 1) showWarning(currentGlobalIdx + 1);
    else alert("ยินดีด้วย! คุณเรียนจบครบทุกบทเรียนในคอร์สนี้แล้ว");
}

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
