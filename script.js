/* ═══════════════════════════════════════════
   LMS FRONTEND — v7 MASTER
   ═══════════════════════════════════════════ */
const MY_SPREADSHEET_ID = '12uENbCj03u-sUNkA9hpqCVzqupM6H9Ht5SsVGVad-2c';
// 👉 [ต้องแก้] วาง URL ที่ลงท้ายด้วย /exec ระหว่างเครื่องหมาย " " ด้านล่าง
//    ห้ามลบเครื่องหมาย " หรือ ; ออก
const ROOT_FOLDER_ID = '1x7Q2RGjFcqD6J9AQL3YQeP6AXF4xDWyS';

let availableCourses = [];
let player, maxTimeWatched = 0, actualWatchTime = 0;
let allLessons = [], currentGlobalIdx = -1, pendingLessonIdx = -1;
let completedLessons = [];
let isPolicyAccepted = false;
let myPermissions = {};
let activeCourseId = "";
let globalClassrooms = {};
let globalCourseImages = {};
let courseCache = {};
let selectedNoteFile = null;
let currentMemberCode = "";

/* ───────────── Utility ───────────── */
async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ───────────── Login ───────────── */
async function handleLogin() {
  const code = document.getElementById('login-code').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const error = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (WEB_APP_URL.indexOf('PASTE_YOUR') === 0) {
    error.innerText = "❌ ผู้ดูแลระบบยังไม่ได้ตั้งค่า URL เชื่อมต่อ";
    error.style.display = "block";
    return;
  }
  if (!code || !pass) {
    error.innerText = "❌ กรุณากรอกรหัสสมาชิกและรหัสผ่าน";
    error.style.display = "block";
    return;
  }

  btn.disabled = true; btn.innerText = "กำลังเข้าสู่ระบบ...";
  error.style.display = "none";

  try {
    const res = await fetchWithTimeout(
      `${WEB_APP_URL}?code=${encodeURIComponent(code)}&pass=${encodeURIComponent(pass)}`, {}, 15000);
    const data = await res.json();

    if (data.result === true) {
      myPermissions = data.permissions || {};
      globalClassrooms = data.classrooms || {};
      globalCourseImages = data.courseImages || {};
      currentMemberCode = code;
      courseCache = {};
      availableCourses = Object.keys(myPermissions).map(k => ({ id: k, name: k }));

      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('dashboard-screen').style.display = 'block';
      sessionStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('memberCode', code);
      try { completedLessons = JSON.parse(localStorage.getItem(`completed_${code}`) || "[]"); }
      catch (e) { completedLessons = []; }
      renderCourseDashboard();
    } else {
      error.innerText = "❌ " + (data.msg || "ข้อมูลไม่ถูกต้อง");
      error.style.display = "block";
    }
  } catch (e) {
    error.innerText = "❌ การเชื่อมต่อล่าช้า กรุณากดใหม่อีกครั้ง";
    error.style.display = "block";
  } finally {
    btn.disabled = false; btn.innerText = "เข้าสู่ระบบ";
  }
}

function handleLogout() {
  if (!confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) return;
  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('memberCode');
  isPolicyAccepted = false; currentMemberCode = ""; courseCache = {}; activeCourseId = "";
  if (player && player.pauseVideo) player.pauseVideo();
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
}

/* ───────────── Dashboard ───────────── */
function renderCourseDashboard() {
  const grid = document.getElementById('course-grid');
  grid.innerHTML = "";
  const fallback = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600";

  if (availableCourses.length === 0) {
    grid.innerHTML = `<p style="color:white;">ยังไม่มีคอร์สเรียนในบัญชีนี้ กรุณาติดต่อแอดมิน</p>`;
    return;
  }

  availableCourses.forEach(c => {
    const allowed = myPermissions[c.id];
    const card = document.createElement('div');
    card.className = 'course-card-item';

    const img = document.createElement('img');
    img.className = 'course-card-img';
    img.src = globalCourseImages[c.id] || fallback;
    img.alt = c.name; img.loading = "lazy";
    img.onerror = () => { img.src = fallback; };
    if (!allowed) { img.style.filter = 'grayscale(1)'; img.style.opacity = '0.6'; }

    const body = document.createElement('div');
    body.className = 'course-card-body';

    const h3 = document.createElement('h3');
    h3.className = 'course-card-title';
    h3.innerText = (allowed ? "📖 " : "🔒 ") + c.name;
    if (!allowed) h3.style.color = '#a0aec0';

    const btn = document.createElement('button');
    btn.className = 'course-card-btn ' + (allowed ? 'btn-allowed' : 'btn-locked');
    btn.innerText = allowed ? "🎯 เข้าสู่บทเรียน (อนุมัติแล้ว)" : "⏰ รอการเปิดระบบอนุมัติ";
    btn.onclick = allowed
      ? () => startCourse(c.id, c.name)
      : () => alert("คอร์สนี้ยังไม่ได้รับการอนุมัติให้เข้าเรียนครับ กรุณาติดต่อแอดมิน");

    body.appendChild(h3); body.appendChild(btn);
    card.appendChild(img); card.appendChild(body);
    grid.appendChild(card);
  });
}

function backToMainMenu() {
  activeCourseId = "";
  if (player && player.pauseVideo) player.pauseVideo();
  ['main-app'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('dashboard-screen').style.display = 'block';
  ['vid-box', 'status', 'next-btn', 'doc-btn', 'assignment-btn',
   'prog-sec', 'prep-btn', 'prep-box', 'note-btn'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById('mission-section').innerHTML = '';
  document.getElementById('current-title').innerText = "🏠 ยินดีต้อนรับ! กรุณาเลือกคอร์สเรียน";
  renderCourseDashboard();
}

/* ───────────── เข้าคอร์ส ───────────── */
async function startCourse(courseId, courseName) {
  activeCourseId = courseId;
  document.getElementById('dashboard-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  document.getElementById('sidebar-title').innerText = "⬅️ เมนูหลัก";
  document.getElementById('current-title').innerText = "⏳ กำลังโหลดบทเรียน...";
  document.getElementById('prog-sec').style.display = 'flex';
  document.getElementById('note-btn').style.display = 'flex';

  const link = document.getElementById('main-classroom-link');
  if (globalClassrooms[courseId] && globalClassrooms[courseId].trim() !== "") {
    link.href = globalClassrooms[courseId].trim();
    document.getElementById('prep-btn').style.display = 'flex';
  } else {
    link.href = "#";
    document.getElementById('prep-btn').style.display = 'none';
  }

  const menu = document.getElementById('lesson-menu');
  menu.innerHTML = `<li class="module-header">⏳ กำลังโหลดรายการบทเรียน...</li>`;
  allLessons = [];
  if (window.innerWidth > 768) document.getElementById('sidebar').classList.remove('collapsed');

  let lessons = courseCache[courseId];
  if (!lessons) {
    try {
      const res = await fetchWithTimeout(
        `${WEB_APP_URL}?action=getCourse&course=${encodeURIComponent(courseId)}`, {}, 25000);
      const data = await res.json();

      if (data.result !== true) {
        menu.innerHTML = `<li class="module-header">❌ ไม่พบบทเรียน</li>`;
        let detail = data.msg || "โหลดไม่สำเร็จ";
        if (data.availableCourses) {
          detail += " | ชื่อที่ส่งไป: " + courseId +
                    " | ชื่อในแท็บ Lessons: " + data.availableCourses.join(", ");
        }
        document.getElementById('current-title').innerText = "❌ " + detail;
        console.log("DEBUG getCourse:", data);
        return;
      }
      lessons = data.lessons || [];
      courseCache[courseId] = lessons;
    } catch (err) {
      menu.innerHTML = `<li class="module-header">❌ เชื่อมต่อไม่สำเร็จ</li>`;
      document.getElementById('current-title').innerText =
        "❌ เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ — กรุณากด 'เมนูหลัก' แล้วลองใหม่";
      return;
    }
  }

  menu.innerHTML = "";
  document.getElementById('current-title').innerText =
    `คอร์ส: ${courseName} (กรุณาเลือกตอนเรียนด้านข้าง)`;

  const seen = {};
  lessons.forEach(item => {
    if (!seen[item.module]) {
      seen[item.module] = true;
      const h = document.createElement('li');
      h.className = 'module-header';
      h.innerText = item.module;
      menu.appendChild(h);
    }
    const idx = allLessons.length;
    allLessons.push(item);
    const li = document.createElement('li');
    li.className = 'lesson-item';
    li.id = `item-${idx}`;
    li.innerText = `ตอนที่ ${item.id}: ${item.title}`;
    li.onclick = () => { showWarning(idx); if (window.innerWidth <= 768) toggleSidebar(); };
    menu.appendChild(li);
  });

  updateProgressUI();
}

/* ───────────── Progress ───────────── */
function updateProgressUI() {
  if (activeCourseId === "") return;
  if (!allLessons.length) {
    document.getElementById('overall-progress').style.width = "0%";
    document.getElementById('progress-percent').innerText = "0%";
    return;
  }
  let done = 0;
  allLessons.forEach((lesson, i) => {
    const el = document.getElementById(`item-${i}`);
    const key = `${activeCourseId}_${lesson.module}_${lesson.id}`;
    if (completedLessons.includes(key)) { done++; if (el) el.classList.add('completed'); }
    else if (el) el.classList.remove('completed');
  });
  const pct = Math.round(done / allLessons.length * 100);
  document.getElementById('overall-progress').style.width = pct + "%";
  document.getElementById('progress-percent').innerText = pct + "%";
}

function saveProgress(index) {
  const lesson = allLessons[index];
  if (!lesson) return;
  const key = `${activeCourseId}_${lesson.module}_${lesson.id}`;
  if (!completedLessons.includes(key)) {
    completedLessons.push(key);
    try { localStorage.setItem(`completed_${currentMemberCode}`, JSON.stringify(completedLessons)); }
    catch (e) {}
    fetch(`${WEB_APP_URL}?action=saveProgress&code=${encodeURIComponent(currentMemberCode)}&course=${encodeURIComponent(activeCourseId)}&lessonId=${encodeURIComponent(lesson.id)}`)
      .catch(err => console.log("Cloud Sync Error:", err));
  }
  updateProgressUI();
}

/* ───────────── Note Modal ───────────── */
function openNoteModal() {
  if (!allLessons.length) { alert("กรุณาเลือกคอร์สและเปิดบทเรียนก่อนครับ"); return; }
  const sel = document.getElementById('note-lesson-select');
  sel.innerHTML = "";
  allLessons.forEach((l, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.innerText = `${l.module} · ตอนที่ ${l.id}: ${l.title}`;
    sel.appendChild(o);
  });
  if (currentGlobalIdx >= 0) sel.value = currentGlobalIdx;

  selectedNoteFile = null;
  document.getElementById('note-member-code').value = currentMemberCode;
  document.getElementById('note-file-drop').classList.remove('has-file');
  document.getElementById('note-file-drop-text').innerText = "📎 แตะเพื่อเลือกไฟล์ (ไม่เกิน 10MB)";
  document.getElementById('note-file-input').value = "";
  const st = document.getElementById('note-status');
  st.className = "note-status"; st.innerText = "";
  const btn = document.getElementById('note-submit-btn');
  btn.disabled = false; btn.innerText = "ส่งโน๊ต";
  document.getElementById('note-modal').style.display = 'flex';
}

function closeNoteModal() {
  document.getElementById('note-modal').style.display = 'none';
}

function handleNoteFileSelect(input) {
  const f = input.files[0];
  if (!f) return;
  if (f.size > 10 * 1024 * 1024) {
    alert("ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 10MB");
    input.value = ""; return;
  }
  selectedNoteFile = f;
  document.getElementById('note-file-drop').classList.add('has-file');
  document.getElementById('note-file-drop-text').innerText = "✅ " + f.name;
}

async function submitNoteFile() {
  const idx = document.getElementById('note-lesson-select').value;
  const st = document.getElementById('note-status');
  const btn = document.getElementById('note-submit-btn');

  if (!currentMemberCode) { st.className = "note-status err"; st.innerText = "❌ ไม่พบรหัสสมาชิก กรุณาล็อกอินใหม่"; return; }
  if (!selectedNoteFile) { st.className = "note-status err"; st.innerText = "❌ กรุณาเลือกไฟล์ก่อน"; return; }

  const lesson = allLessons[idx];
  btn.disabled = true; btn.innerText = "กำลังส่ง...";
  st.className = "note-status pending";
  st.innerText = "⏳ กำลังอัปโหลดไฟล์ อย่าเพิ่งปิดหน้าต่างนี้...";

  try {
    const base64 = await fileToBase64(selectedNoteFile);
    const res = await fetchWithTimeout(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "uploadFile", fileType: "note", memberCode: currentMemberCode,
        course: activeCourseId, module: lesson.module, lessonId: lesson.id,
        lessonTitle: lesson.title, fileName: selectedNoteFile.name,
        mimeType: selectedNoteFile.type || "application/octet-stream", fileData: base64
      })
    }, 45000);
    const data = await res.json();
    if (data.result === true) {
      st.className = "note-status ok"; st.innerText = "✅ ส่งโน๊ตสำเร็จแล้ว! ขอบคุณครับ";
      btn.innerText = "ส่งแล้ว ✓";
      setTimeout(closeNoteModal, 1200);
    } else {
      st.className = "note-status err"; st.innerText = "❌ " + (data.msg || "ส่งไม่สำเร็จ กรุณาลองใหม่");
      btn.disabled = false; btn.innerText = "ส่งโน๊ต";
    }
  } catch (err) {
    st.className = "note-status err"; st.innerText = "❌ อัปโหลดนานเกินไป กรุณาลองกดส่งใหม่อีกครั้ง";
    btn.disabled = false; btn.innerText = "ส่งโน๊ต";
  }
}

/* ───────────── Mission ───────────── */
async function uploadMissionFile(file, fileType, lesson, statusEl, btnEl) {
  statusEl.className = "note-status pending"; statusEl.innerText = "⏳ กำลังอัพโหลดไฟล์...";
  btnEl.disabled = true;
  try {
    const base64 = await fileToBase64(file);
    const res = await fetchWithTimeout(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "uploadFile", fileType, memberCode: currentMemberCode,
        course: activeCourseId, module: lesson.module, lessonId: lesson.id,
        lessonTitle: lesson.title, fileName: file.name,
        mimeType: file.type || "application/octet-stream", fileData: base64
      })
    }, 45000);
    const data = await res.json();
    if (data.result === true) {
      statusEl.className = "note-status ok"; statusEl.innerText = "✅ ส่งสำเร็จแล้ว! ขอบคุณครับ";
      btnEl.innerText = "ส่งแล้ว ✓";
    } else {
      statusEl.className = "note-status err"; statusEl.innerText = "❌ " + (data.msg || "ส่งไม่สำเร็จ");
      btnEl.disabled = false; btnEl.innerText = "ส่งไฟล์";
    }
  } catch (err) {
    statusEl.className = "note-status err"; statusEl.innerText = "❌ การเชื่อมต่อล่าช้า กรุณาลองใหม่อีกครั้ง";
    btnEl.disabled = false; btnEl.innerText = "ส่งไฟล์";
  }
}

async function submitMissionScore(lesson, missionType, score, maxScore) {
  if (!currentMemberCode) return;
  try {
    await fetch(WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: "saveMissionScore", memberCode: currentMemberCode, course: activeCourseId,
        module: lesson.module, lessonId: lesson.id, lessonTitle: lesson.title,
        missionType, score, maxScore
      })
    });
  } catch (err) { console.log("บันทึกคะแนนมิชชันไม่สำเร็จ:", err); }
}

function renderMissionSection(lesson) {
  const box = document.getElementById('mission-section');
  box.innerHTML = "";
  const type = (lesson.mission_type || "").toString().trim().toLowerCase();
  if (!type) return;

  let data = lesson.mission_data || {};
  if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = {}; } }

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
    <div class="mission-heading">${esc(data.title) || "🖍️ วาดแผนภาพสรุปความเข้าใจของคุณ"}</div>
    <div class="mission-instructions">${esc(data.instructions) || "วาดแผนภาพ (mind map / แผนภูมิ) สรุปสิ่งที่ได้เรียนรู้จากคลิปนี้ลงบนกระดาษหรือแอปที่ถนัด แล้วถ่ายรูป/สแกน อัพโหลดไฟล์ส่งที่นี่"}</div>
    <div class="file-drop" id="diagram-file-drop">
      <div class="file-drop-text" id="diagram-file-drop-text">📎 แตะเพื่อเลือกไฟล์แผนภาพ (ไม่เกิน 10MB)</div>
      <input type="file" id="diagram-file-input" accept="image/*,.pdf" style="display:none;">
    </div>
    <div style="margin-top:14px; text-align:right;">
      <button class="mission-action-btn" id="diagram-submit-btn">ส่งไฟล์</button>
    </div>
    <div class="note-status" id="diagram-status"></div>
  `;
  const input = wrap.querySelector('#diagram-file-input');
  const drop = wrap.querySelector('#diagram-file-drop');
  const dropText = wrap.querySelector('#diagram-file-drop-text');
  let chosen = null;

  drop.onclick = () => input.click();
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert("ไฟล์ใหญ่เกินไป กรุณาเลือกไฟล์ไม่เกิน 10MB"); input.value = ""; return; }
    chosen = f;
    drop.classList.add('has-file');
    dropText.innerText = "✅ " + f.name;
  };
  wrap.querySelector('#diagram-submit-btn').onclick = () => {
    const st = wrap.querySelector('#diagram-status');
    const btn = wrap.querySelector('#diagram-submit-btn');
    if (!chosen) { st.className = "note-status err"; st.innerText = "❌ กรุณาเลือกไฟล์ก่อน"; return; }
    uploadMissionFile(chosen, "diagram", lesson, st, btn);
  };
}

function renderTrueFalseMission(wrap, lesson, data) {
  const statements = Array.isArray(data.statements) ? data.statements : [];
  wrap.innerHTML = `
    <div class="mission-eyebrow">มิชชันประจำบท · ถูกหรือผิด</div>
    <div class="mission-heading">${esc(data.title) || "✅ ทบทวนความเข้าใจ"}</div>
    <div class="mission-instructions">${esc(data.instructions) || "อ่านแต่ละข้อความ แล้วกดว่า จริง หรือ เท็จ ตามเนื้อหาที่เรียนไป"}</div>
  `;
  if (!statements.length) {
    wrap.innerHTML += `<div class="mission-instructions">ยังไม่มีข้อมูลมิชชันสำหรับบทนี้ กรุณาติดต่อผู้ดูแลระบบ</div>`;
    return;
  }
  let correct = 0, answered = 0, reported = false;

  statements.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'tf-card';
    card.innerHTML = `
      <div class="tf-text">${i + 1}. ${esc(s.text)}</div>
      <div class="tf-btns">
        <button class="tf-btn" data-val="true">จริง</button>
        <button class="tf-btn" data-val="false">เท็จ</button>
      </div>
      <div class="tf-explain"></div>
    `;
    const btns = card.querySelectorAll('.tf-btn');
    const exp = card.querySelector('.tf-explain');
    btns.forEach(b => {
      b.onclick = () => {
        if (b.dataset.locked) return;
        const ok = (b.dataset.val === 'true') === !!s.answer;
        btns.forEach(x => { x.disabled = true; x.dataset.locked = "1"; });
        b.classList.add(ok ? 'correct-pick' : 'wrong-pick');
        exp.classList.add('show', ok ? 'ok' : 'bad');
        exp.innerText = (ok ? '✓ ถูกต้อง — ' : '✕ ยังไม่ตรง — ') + (s.explain || "");
        if (ok) correct++;
        answered++;
        if (answered === statements.length && !reported) {
          reported = true;
          submitMissionScore(lesson, 'truefalse', correct, statements.length);
          const done = document.createElement('div');
          done.className = 'mission-done-banner';
          done.style.marginTop = '12px';
          done.innerText = `🎉 ทำครบแล้ว! ได้ ${correct} / ${statements.length} ข้อ (บันทึกคะแนนแล้ว)`;
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
    <div class="mission-heading">${esc(data.title) || "🔗 จับคู่ให้ถูกต้อง"}</div>
    <div class="mission-instructions">${esc(data.instructions) || "แตะเลือกฝั่งซ้าย 1 ข้อ แล้วแตะฝั่งขวาที่คิดว่าคู่กัน ถ้าถูกจะติดค้างเป็นสีเขียว"}</div>
    <div class="match-wrap">
      <div class="match-col" id="match-left"></div>
      <div class="match-col" id="match-right"></div>
    </div>
    <div class="match-progress" id="match-progress"></div>
  `;
  if (!pairs.length) {
    wrap.innerHTML += `<div class="mission-instructions">ยังไม่มีข้อมูลมิชชันสำหรับบทนี้ กรุณาติดต่อผู้ดูแลระบบ</div>`;
    return;
  }
  const leftCol = wrap.querySelector('#match-left');
  const rightCol = wrap.querySelector('#match-right');
  const prog = wrap.querySelector('#match-progress');
  const rights = shuffleArr(pairs.map((p, i) => ({ text: p.right, pairId: i })));
  let sel = null, matched = 0, reported = false;

  function update() {
    prog.innerText = `จับคู่แล้ว ${matched} / ${pairs.length} คู่`;
    if (matched === pairs.length && !reported) {
      reported = true;
      submitMissionScore(lesson, 'matching', pairs.length, pairs.length);
      const done = document.createElement('div');
      done.className = 'mission-done-banner';
      done.innerText = '🎉 จับคู่ครบถูกต้องทุกคู่แล้ว เก่งมาก! (บันทึกคะแนนแล้ว)';
      wrap.appendChild(done);
    }
  }

  pairs.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'match-item'; el.innerText = p.left;
    el.onclick = () => {
      if (el.classList.contains('matched')) return;
      leftCol.querySelectorAll('.match-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      sel = { el, pairId: i };
    };
    leftCol.appendChild(el);
  });

  rights.forEach(item => {
    const el = document.createElement('div');
    el.className = 'match-item'; el.innerText = item.text;
    el.onclick = () => {
      if (el.classList.contains('matched') || !sel) return;
      if (item.pairId === sel.pairId) {
        el.classList.add('matched');
        sel.el.classList.add('matched');
        sel.el.classList.remove('selected');
        sel = null; matched++; update();
      } else {
        el.classList.add('wrong-flash');
        setTimeout(() => el.classList.remove('wrong-flash'), 500);
      }
    };
    rightCol.appendChild(el);
  });

  update();
}

function renderGameMission(wrap, lesson, data) {
  const stages = [];
  if (Array.isArray(data.statements) && data.statements.length) stages.push('truefalse');
  if (data.scenario && Array.isArray(data.scenario.options) && data.scenario.options.length) stages.push('scenario');
  if (Array.isArray(data.sequence) && data.sequence.length) stages.push('sequence');

  if (!stages.length) {
    wrap.innerHTML = `
      <div class="mission-eyebrow">มิชชันประจำบท · เกม</div>
      <div class="mission-heading">${esc(data.title) || "🎮 มิชชันท้ายบท"}</div>
      <div class="mission-instructions">ยังไม่มีข้อมูลมิชชันสำหรับบทนี้ กรุณาติดต่อผู้ดูแลระบบ</div>
    `;
    return;
  }

  let stageIdx = 0, score = 0, reported = false;
  const maxScore =
    (Array.isArray(data.statements) ? data.statements.length : 0) +
    (stages.includes('scenario') ? 2 : 0) +
    (stages.includes('sequence') ? 2 : 0);
  const names = { truefalse: 'จับผิด', scenario: 'สถานการณ์', sequence: 'เรียงลำดับ' };

  function tabs() {
    let h = '<div class="game-stage-tabs">';
    stages.forEach((s, i) => {
      const cls = i === stageIdx ? 'active' : (i < stageIdx ? 'done' : '');
      h += `<span class="game-stage-tab ${cls}">${i + 1}. ${names[s]}</span>`;
    });
    return h + '</div>';
  }

  function renderStage() {
    const header = `
      <div class="mission-eyebrow">มิชชันประจำบท · เกม</div>
      <div class="mission-heading">${esc(data.title) || "🎮 มิชชันท้ายบท"}</div>
      ${tabs()}
    `;

    if (stageIdx >= stages.length) {
      wrap.innerHTML = header;
      if (!reported) { reported = true; submitMissionScore(lesson, 'game', score, maxScore); }
      const done = document.createElement('div');
      done.className = 'mission-done-banner';
      done.innerText = `🎉 ผ่านมิชชันครบแล้ว! คะแนนรวม ${score} / ${maxScore} คะแนน (บันทึกคะแนนแล้ว)`;
      wrap.appendChild(done);
      return;
    }

    const type = stages[stageIdx];
    wrap.innerHTML = header;

    if (type === 'truefalse') {
      const list = document.createElement('div');
      data.statements.forEach((s, i) => {
        const card = document.createElement('div'); card.className = 'tf-card';
        card.innerHTML = `
          <div class="tf-text">${i + 1}. ${esc(s.text)}</div>
          <div class="tf-btns">
            <button class="tf-btn" data-val="true">จริง</button>
            <button class="tf-btn" data-val="false">เท็จ</button>
          </div>
          <div class="tf-explain"></div>
        `;
        const btns = card.querySelectorAll('.tf-btn');
        const exp = card.querySelector('.tf-explain');
        btns.forEach(b => {
          b.onclick = () => {
            if (b.dataset.locked) return;
            const ok = (b.dataset.val === 'true') === !!s.answer;
            btns.forEach(x => { x.disabled = true; x.dataset.locked = "1"; });
            b.classList.add(ok ? 'correct-pick' : 'wrong-pick');
            exp.classList.add('show', ok ? 'ok' : 'bad');
            exp.innerText = (ok ? '✓ ถูกต้อง — ' : '✕ ยังไม่ตรง — ') + (s.explain || "");
            if (ok) score++;
            checkDone();
          };
        });
        list.appendChild(card);
      });
      wrap.appendChild(list);
      addNext(() => list.querySelectorAll('.tf-btn:disabled').length >= data.statements.length * 2);
    }

    if (type === 'scenario') {
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
      const confirm = document.createElement('button');

      sc.options.forEach((opt, i) => {
        const item = document.createElement('div');
        item.className = 'game-option'; item.innerText = opt;
        item.onclick = () => {
          if (revealed) return;
          optWrap.querySelectorAll('.game-option').forEach(x => x.classList.remove('selected'));
          item.classList.add('selected'); selected = i; confirm.disabled = false;
        };
        optWrap.appendChild(item);
      });
      wrap.appendChild(optWrap);

      confirm.className = 'mission-action-btn';
      confirm.innerText = 'ยืนยันคำตอบ';
      confirm.disabled = true;
      confirm.style.marginTop = '10px';
      confirm.onclick = () => {
        revealed = true;
        optWrap.querySelectorAll('.game-option').forEach((x, i) => {
          if (i === sc.correctIndex) x.classList.add('correct-reveal');
          else if (i === selected) x.classList.add('wrong-reveal');
        });
        const ok = selected === sc.correctIndex;
        if (ok) score += 2;
        const fb = document.createElement('div');
        fb.className = 'tf-explain show ' + (ok ? 'ok' : 'bad');
        fb.style.marginTop = '10px';
        fb.innerText = (ok ? '✓ ถูกต้อง — ' : '✕ ยังไม่ตรง — ') + (sc.explain || "");
        wrap.appendChild(fb);
        confirm.style.display = 'none';
        addNext(() => true);
      };
      wrap.appendChild(confirm);
    }

    if (type === 'sequence') {
      let order = shuffleArr(data.sequence);
      if (JSON.stringify(order) === JSON.stringify(data.sequence)) order.reverse();

      const brief = document.createElement('div');
      brief.className = 'mission-instructions';
      brief.innerText = data.sequenceInstructions || "จัดลำดับข้อความให้ถูกต้องด้วยปุ่มลูกศร";
      wrap.appendChild(brief);

      const listEl = document.createElement('div');
      function draw() {
        listEl.innerHTML = "";
        order.forEach((t, i) => {
          const item = document.createElement('div'); item.className = 'seq-item-g';
          item.innerHTML = `<span class="seq-num-g">${i + 1}</span><span>${esc(t)}</span>`;
          const btns = document.createElement('div'); btns.className = 'seq-move-g';
          const up = document.createElement('button');
          up.className = 'mini-btn-g'; up.innerText = '↑'; up.disabled = i === 0;
          up.onclick = () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); };
          const dn = document.createElement('button');
          dn.className = 'mini-btn-g'; dn.innerText = '↓'; dn.disabled = i === order.length - 1;
          dn.onclick = () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); };
          btns.appendChild(up); btns.appendChild(dn);
          item.appendChild(btns);
          listEl.appendChild(item);
        });
      }
      draw();
      wrap.appendChild(listEl);

      const check = document.createElement('button');
      check.className = 'mission-action-btn';
      check.innerText = 'ตรวจคำตอบ';
      check.onclick = () => {
        const ok = JSON.stringify(order) === JSON.stringify(data.sequence);
        const fb = document.createElement('div');
        fb.className = 'tf-explain show ' + (ok ? 'ok' : 'bad');
        fb.style.marginTop = '10px';
        fb.innerText = ok ? '✓ เรียงถูกต้องแล้ว!' : '✕ ยังไม่ตรงลำดับ ลองจัดใหม่ดูอีกครั้ง';
        wrap.appendChild(fb);
        if (ok) { score += 2; check.style.display = 'none'; addNext(() => true); }
      };
      wrap.appendChild(check);
    }

    function addNext(fn) {
      const b = document.createElement('button');
      b.className = 'mission-action-btn';
      b.innerText = stageIdx === stages.length - 1 ? 'สรุปมิชชัน' : 'ด่านถัดไป →';
      b.style.marginTop = '14px';
      b.style.display = fn() ? 'inline-block' : 'none';
      b.onclick = () => { stageIdx++; renderStage(); };
      wrap.appendChild(b);
      wrap._fn = fn; wrap._btn = b;
    }
    function checkDone() {
      if (wrap._fn && wrap._btn) wrap._btn.style.display = wrap._fn() ? 'inline-block' : 'none';
    }
  }

  renderStage();
}

/* ───────────── Modal & Sidebar ───────────── */
function togglePrepBox() {
  const box = document.getElementById('prep-box');
  const arrow = document.getElementById('prep-arrow');
  const open = box.style.display === 'block';
  box.style.display = open ? 'none' : 'block';
  arrow.innerText = open ? '▼' : '▲';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

document.getElementById('accept-policy').addEventListener('change', function (e) {
  const btn = document.getElementById('confirm-btn');
  if (e.target.checked) {
    btn.style.background = 'var(--glam-navy-start)'; btn.style.cursor = 'pointer'; btn.disabled = false;
  } else {
    btn.style.background = '#a0aec0'; btn.style.cursor = 'not-allowed'; btn.disabled = true;
  }
});

document.getElementById('sidebar-title').onclick = function () {
  if (activeCourseId !== "") backToMainMenu();
};

function showWarning(index) {
  if (index === currentGlobalIdx && isPolicyAccepted) return;
  pendingLessonIdx = index;
  resetModalUI();
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
  document.querySelector('.modal-content label').style.display = 'none';
  const btn = document.getElementById('confirm-btn');
  btn.innerText = "รับทราบและตั้งใจเรียนต่อ";
  btn.disabled = false;
  btn.style.background = 'var(--glam-navy-start)';
  btn.style.cursor = 'pointer';
  btn.onclick = () => { modal.style.display = 'none'; if (player && player.playVideo) player.playVideo(); };
}

function resetModalUI() {
  document.querySelector('.modal-content h1').innerText = "คำเตือนและข้อตกลงสำคัญ";
  document.querySelector('.policy-box').innerHTML = `องค์กรต้องการเห็นกระบวนการเรียนรู้และคิดวิเคราะห์ที่กลั่นออกมาจากความเข้าใจของผู้เรียน มากกว่าคำตอบที่สวยหรูซึ่งออกแบบมาจาก AI<br><br>
    <b>เงื่อนไข:</b>
    <ul>
      <li>ห้ามใช้ AI ช่วยรับชมคลิป, ทำแบบฝึกหัด หรือทำแผนภาพ</li>
      <li>ทีมงานจะใช้โปรแกรมตรวจสอบ AI กับงานทุกชิ้น</li>
    </ul>
    <b>หากพบการทุจริต จะมีมาตรการดังต่อไปนี้:</b>
    <ul>
      <li><b>ไล่ออกและตัดสิทธิ์สมาชิก (Terminate) ทันที</b></li>
      <li>ส่งหนังสือแจ้งพฤติกรรมไปยังสถานศึกษาต้นสังกัด</li>
      <li>ประกาศรายชื่อผู้ฝ่าฝืนบนเว็บไซต์</li>
    </ul>`;
  document.getElementById('accept-policy').style.display = 'inline-block';
  document.getElementById('accept-policy').checked = false;
  const label = document.querySelector('.modal-content label');
  label.style.display = 'flex';
  document.querySelector('.modal-content label span').innerText =
    "ข้าพเจ้ายอมรับเงื่อนไขทุกประการ หากฝ่าฝืนข้าพเจ้ายินยอมรับบทลงโทษสูงสุดโดยไม่มีข้อโต้แย้ง";
  const btn = document.getElementById('confirm-btn');
  btn.innerText = "ยืนยันและเข้าสู่บทเรียน";
  btn.disabled = true;
  btn.style.background = '#a0aec0';
  btn.style.cursor = 'not-allowed';
  btn.onclick = () => strictConfirm();
}

/* ───────────── YouTube Player ───────────── */
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%', width: '100%',
    playerVars: { enablejsapi: 1, modestbranding: 1, rel: 0, disablekb: 1 },
    events: {
      onReady: () => {
        if (document.getElementById('warning-modal').style.display === 'flex') player.pauseVideo();
      },
      onStateChange: (e) => {
        if (e.data == YT.PlayerState.PLAYING &&
            document.getElementById('warning-modal').style.display === 'flex') player.pauseVideo();
      },
      onPlaybackRateChange: (e) => {
        if (e.data !== 1) {
          player.setPlaybackRate(1); player.pauseVideo();
          showModalWarning("⚠️ ตรวจพบการเร่งความเร็ว",
            "ไม่อนุญาตให้เร่งความเร็วในการรับชมวิดีโอครับ <br>กรุณาเรียนรู้ด้วยความเร็วปกติเพื่อประสิทธิภาพสูงสุดในการทำความเข้าใจ");
        }
      }
    }
  });
}

function loadLesson(index) {
  currentGlobalIdx = index; maxTimeWatched = 0; actualWatchTime = 0;
  const lesson = allLessons[index];
  if (!lesson) return;

  document.getElementById('vid-box').style.display = 'block';
  document.getElementById('status').style.display = 'block';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('current-title').innerText = lesson.title;

  document.querySelectorAll('.lesson-item').forEach(el => {
    el.classList.toggle('active', el.id === `item-${index}`);
  });

  const doc = document.getElementById('doc-btn');
  if (lesson.doc_url && lesson.doc_url.trim() !== "") {
    doc.href = lesson.doc_url.trim(); doc.style.display = 'flex';
  } else doc.style.display = 'none';

  const asg = document.getElementById('assignment-btn');
  if (lesson.assignment_url && lesson.assignment_url.trim() !== "") {
    asg.href = lesson.assignment_url.trim(); asg.style.display = 'flex';
  } else asg.style.display = 'none';

  renderMissionSection(lesson);

  if (player && player.loadVideoById) {
    const start = lesson.start || 0;
    player.loadVideoById({ videoId: extractID(lesson.url), startSeconds: start });
    maxTimeWatched = start;
    if (!isPolicyAccepted || document.getElementById('warning-modal').style.display === 'flex') {
      setTimeout(() => player.pauseVideo(), 500);
    }
  }
  updateProgressUI();
}

function extractID(url) {
  if (!url) return "";
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return (m && m[2].length === 11) ? m[2] : url;
}

setInterval(() => {
  if (!player || !player.getPlayerState) return;
  const modalOpen = document.getElementById('warning-modal').style.display === 'flex';
  if (modalOpen && player.getPlayerState() === 1) { player.pauseVideo(); return; }
  if (player.getPlayerState() !== 1) return;

  const curr = player.getCurrentTime();
  const dur = player.getDuration();

  if (curr > maxTimeWatched + 3.0) {
    player.pauseVideo(); player.seekTo(maxTimeWatched);
    showModalWarning("⚠️ ตรวจพบการข้ามวิดีโอ",
      "ไม่อนุญาตให้กดข้ามวิดีโอเด็ดขาดครับ <br>กรุณาเรียนรู้อย่างเป็นขั้นตอนเพื่อประโยชน์ของตัวคุณเอง");
  } else {
    maxTimeWatched = Math.max(maxTimeWatched, curr);
    actualWatchTime++;
  }

  if (dur > 0 && (curr / dur) >= 0.98) {
    if (actualWatchTime >= dur * 0.95) {
      document.getElementById('next-btn').style.display = 'block';
      saveProgress(currentGlobalIdx);
    } else {
      player.pauseVideo(); player.seekTo(0);
      actualWatchTime = 0; maxTimeWatched = 0;
      alert("ระบบตรวจพบว่าคุณไม่ได้นั่งรับชมคลิปจริง กรุณาเริ่มรับชมใหม่อีกครั้งอย่างตั้งใจครับ");
    }
  }
}, 1000);

function autoNext() {
  if (currentGlobalIdx < allLessons.length - 1) showWarning(currentGlobalIdx + 1);
  else alert("ยินดีด้วย! คุณเรียนจบครบทุกบทเรียนในคอร์สนี้แล้ว");
}

/* ───────────── YouTube API Loader ───────────── */
(function () {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const first = document.getElementsByTagName('script')[0];
  first.parentNode.insertBefore(tag, first);
})();
