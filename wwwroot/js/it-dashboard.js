let departments = [];
let userChart = null;
let selectedUserIds = [];
let availableRoles = [];
let permissionTargetUsers = [];
let loadedPermissions = [];
let loadedSettings = [];
let loadedSchedules = [];
let scheduleCourseOptions = [];
let activePermissionBoard = [];
let currentPermissionTarget = { type: 'role', id: null };
let currentModuleId = null;
let currentUserPermissionKeys = new Set();
let documentLibraryData = { courses: [], modules: [], lessons: [], exams: [] };
let currentLibraryTab = 'modules';
let lastGeneratedQuestions = [];

const pagePermissionMap = {
    overview: 'dashboard.view',
    users: 'users.manage',
    departments: 'departments.manage',
    courses: 'courses.manage',
    documents: 'content.documents.manage',
    schedules: 'schedules.manage',
    categories: 'categories.manage',
    faqs: 'faqs.manage',
    analytics: 'analytics.view',
    auditlogs: 'auditlogs.view',
    backup: 'backup.manage',
    permissions: 'permissions.manage',
    newsletter: 'newsletter.manage',
    settings: 'settings.manage'
};

const permissionVisualMap = {
    'dashboard.view': { icon: '🏠', accent: '#2563eb' },
    'users.manage': { icon: '👤', accent: '#06b6d4' },
    'departments.manage': { icon: '🏢', accent: '#14b8a6' },
    'courses.manage': { icon: '📚', accent: '#3b82f6' },
    'course.levels.manage': { icon: '🎚️', accent: '#8b5cf6' },
    'content.modules.manage': { icon: '🧩', accent: '#10b981' },
    'content.lessons.manage': { icon: '📝', accent: '#22c55e' },
    'content.documents.manage': { icon: '📎', accent: '#0ea5e9' },
    'content.quizzes.manage': { icon: '❓', accent: '#f59e0b' },
    'categories.manage': { icon: '🏷️', accent: '#a855f7' },
    'faqs.manage': { icon: '💡', accent: '#ec4899' },
    'jobtitles.manage': { icon: '🪪', accent: '#64748b' },
    'schedules.manage': { icon: '🗓️', accent: '#ef4444' },
    'analytics.view': { icon: '📊', accent: '#2563eb' },
    'reports.export': { icon: '📤', accent: '#0891b2' },
    'auditlogs.view': { icon: '📋', accent: '#f97316' },
    'backup.manage': { icon: '💾', accent: '#8b5cf6' },
    'permissions.manage': { icon: '🔑', accent: '#eab308' },
    'newsletter.manage': { icon: '📧', accent: '#ec4899' },
    'settings.manage': { icon: '⚙️', accent: '#475569' },
    'system.admin': { icon: '👑', accent: '#dc2626' }
};

const chartValuePlugin = {
    id: 'chartValuePlugin',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((element, index) => {
                const value = dataset.data[index];
                if (value === null || value === undefined) return;
                const pos = element.tooltipPosition();
                ctx.fillText(String(value), pos.x, pos.y - 8);
            });
        });
        ctx.restore();
    }
};

if (window.Chart && Chart.registry && Chart.registry.plugins && !Chart.registry.plugins.get('chartValuePlugin')) {
    Chart.register(chartValuePlugin);
} else if (window.Chart && !Chart.registry) {
    // Fallback for older Chart.js
    Chart.register(chartValuePlugin);
}

async function refreshDepartmentsDropdown() {
    try {
        departments = await apiFetch('/api/it/departments');
        const opts = departments.map(d => `<option value="${d.departmentId}">${d.departmentName}</option>`).join('');
        ['newDepartment', 'bulkDeptSel', 'editDepartment', 'courseModalTargetDept'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">-- Chọn / Phân bổ sau --</option>' + opts;
        });
        ['examTargetDeptInput', 'editExamTargetDeptInput', 'libraryExamTargetDeptInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<option value="">-- Tất cả phòng ban --</option>' + opts;
        });
    } catch(e) {
        departments = [];
    }
}

async function refreshRoles() {
    try {
        availableRoles = await apiFetch('/api/it/roles');
        const roleSelect = document.getElementById('permissionRoleTarget');
        if (roleSelect) {
            roleSelect.innerHTML = availableRoles.map(r => `<option value="${r.roleId}">${r.roleName}</option>`).join('');
            if (!currentPermissionTarget.id && availableRoles.length) currentPermissionTarget.id = availableRoles[0].roleId;
        }
    } catch(e) { availableRoles = []; }
}

async function refreshPermissionUsers() {
    try {
        permissionTargetUsers = await apiFetch('/api/it/permission-target-users');
        const userSelect = document.getElementById('permissionUserTarget');
        if (userSelect) {
            userSelect.innerHTML = permissionTargetUsers.map(u => `<option value="${u.userId}">${u.fullName || u.username}</option>`).join('');
        }
    } catch (e) { permissionTargetUsers = []; }
}

async function refreshMyPermissionProfile() {
    try {
        const data = await apiFetch('/api/it/my-permissions');
        currentUserPermissionKeys = new Set((data.permissions || []).map(p => String(p).toLowerCase()));
        applyPermissionVisibility();
    } catch (e) {
        currentUserPermissionKeys = new Set();
        applyPermissionVisibility();
    }
}

function hasPermission(key) {
    if (!key) return true;
    return currentUserPermissionKeys.has(String(key).toLowerCase());
}

function applyPermissionVisibility() {
    document.querySelectorAll('[data-permission]').forEach(el => {
        const allowed = hasPermission(el.getAttribute('data-permission'));
        el.style.display = allowed ? '' : 'none';
    });
    Object.entries(pagePermissionMap).forEach(([page, permissionKey]) => {
        const section = document.getElementById(page);
        if (!section) return;
        section.dataset.allowed = hasPermission(permissionKey) ? 'true' : 'false';
    });
    document.querySelectorAll('.nav-section-label').forEach(label => {
        const nextList = label.nextElementSibling;
        if (!nextList || nextList.tagName !== 'UL') return;
        const hasVisibleItems = Array.from(nextList.querySelectorAll('.nav-item')).some(item => item.offsetParent !== null);
        label.style.display = hasVisibleItems ? '' : 'none';
        nextList.style.display = hasVisibleItems ? '' : 'none';
    });
}

async function init() {
    await Promise.all([refreshDepartmentsDropdown(), refreshRoles(), refreshPermissionUsers(), refreshMyPermissionProfile()]);
    navigate('overview');
}

function navigate(page) {
    if (pagePermissionMap[page] && !hasPermission(pagePermissionMap[page])) {
        showToast('Tài khoản này chưa được cấp quyền để mở chức năng đó.', 'warning');
        return;
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`navigate('${page}')`)) {
            link.classList.add('active');
        } else if (page === 'overview' && onclickAttr && onclickAttr.includes('location.href')) {
            link.classList.add('active');
        }
    });

    const pageTitles = {
        "overview": { title: "Tổng quan hệ thống", sub: "Giám sát và quản lý hạ tầng LMS" },
        "users": { title: "Quản lý người dùng", sub: "Tìm kiếm, thêm mới và quản lý tài khoản" },
        "courses": { title: "Quản lý khóa học", sub: "Cấu hình và kiểm soát nội dung khóa học" },
        "documents": { title: "Kho tài liệu", sub: "Quản lý kho chương, bài giảng và quiz toàn hệ thống" },
        "schedules": { title: "Quản lý lịch học", sub: "Thêm, sửa và xóa lịch học offline cho nhân viên" },
        "departments": { title: "Quản lý phòng ban", sub: "Tổ chức cơ cấu nhân sự" },
        "auditlogs": { title: "Nhật ký hoạt động", sub: "Theo dõi biến động và lịch sử hệ thống" },
        "jobtitles": { title: "Quản lý Chức Danh", sub: "CRUD chức danh nhân viên trong tổ chức" },
        "exports": { title: "Xuất Báo Cáo Excel", sub: "Tải xuống báo cáo nhân viên, đào tạo và kết quả kiểm tra" },
        "categories": { title: "Quản lý danh mục", sub: "Quản lý danh mục khóa học, FAQ và ngân hàng câu hỏi" },
        "faqs": { title: "Quản lý FAQ", sub: "Câu hỏi thường gặp" },
        "analytics": { title: "Phân tích nâng cao", sub: "Biểu đồ thống kê chi tiết toàn hệ thống" },
        "backup": { title: "Backup hệ thống", sub: "Tạo và theo dõi lịch sử sao lưu dữ liệu" },
        "permissions": { title: "Phân quyền", sub: "Xem và quản lý quyền hạn theo vai trò" },
        "newsletter": { title: "Newsletter", sub: "Quản lý đăng ký nhận thông báo" },
        "settings": { title: "Cài đặt hệ thống", sub: "Quản lý tham số cấu hình LMS" }
    };

    if (pageTitles[page]) {
        const titleEl = document.getElementById('pageTitle');
        const subEl = document.getElementById('pageSubtitle');
        if (titleEl) titleEl.textContent = pageTitles[page].title;
        if (subEl) subEl.textContent = pageTitles[page].sub;
    }

    document.querySelectorAll('.page-section').forEach(s => s.style.display = s.id === page ? '' : 'none');
    
    // Tự động cuộn lên đầu trang khi chuyển mục
    const scrollContainer = document.querySelector('.main-content');
    if (scrollContainer) {
        scrollContainer.scrollTop = 0;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (page === 'overview') loadOverview();
    else if (page === 'users') loadUsers();
    else if (page === 'courses') loadItCourses();
    else if (page === 'documents') loadDocumentLibrary();
    else if (page === 'schedules') loadSchedules();
    else if (page === 'departments') loadItDepartments();
    else if (page === 'auditlogs') loadAuditLogs();
    else if (page === 'jobtitles') loadJobTitles();
    else if (page === 'categories') loadCategories();
    else if (page === 'faqs') loadFaqs();
    else if (page === 'analytics') loadAnalytics();
    else if (page === 'backup') loadBackupLogs();
    else if (page === 'permissions') loadPermissions();
    else if (page === 'newsletter') loadNewsletter();
    else if (page === 'settings') loadSettings();
    else if (page === 'exports') { /* no load needed */ }
}

function libraryEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadDocumentLibrary() {
    try {
        const data = await apiFetch('/api/it/content-library');
        documentLibraryData = {
            courses: data.courses || [],
            modules: data.modules || [],
            lessons: data.lessons || [],
            exams: data.exams || []
        };
        // Refresh department list if empty
        if (!loadedDepartmentsList || !loadedDepartmentsList.length) {
            const depts = await apiFetch('/api/it/departments');
            loadedDepartmentsList = depts;
        }
        renderDocumentLibraryFilters();
        renderDocumentLibraryStats();
        renderDocumentLibrary();
    } catch (e) {
        document.getElementById('documentLibraryHead').innerHTML = '';
        document.getElementById('documentLibraryTable').innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:24px">Không tải được kho tài liệu: ${libraryEscape(e.message)}</td></tr>`;
    }
}

function renderDocumentLibraryFilters() {
    const deptFilter = document.getElementById('libraryDeptFilter');
    if (!deptFilter) return;
    const currentValue = deptFilter.value;
    deptFilter.innerHTML = '<option value="">Tất cả phòng ban</option>' + (loadedDepartmentsList || []).map(d => `
        <option value="${d.departmentId}">${libraryEscape(d.departmentName || d.name)}</option>
    `).join('');
    deptFilter.value = currentValue;
    
    const courseFilter = document.getElementById('libraryCourseFilter');
    if (courseFilter) {
        const currentCourse = courseFilter.value;
        courseFilter.innerHTML = '<option value="">Tất cả khóa học</option>' + (documentLibraryData.courses || []).map(c => `
            <option value="${c.id || c.courseId}">${libraryEscape(c.title || c.courseName)}</option>
        `).join('');
        courseFilter.value = currentCourse;
    }
}

function renderDocumentLibraryStats() {
    const attachmentCount = (documentLibraryData.lessons || []).reduce((sum, lesson) => sum + (lesson.attachmentsCount || 0), 0);
    const mCount = document.getElementById('libraryModulesCount');
    const lCount = document.getElementById('libraryLessonsCount');
    const eCount = document.getElementById('libraryExamsCount');
    const aCount = document.getElementById('libraryAttachmentsCount');
    
    if (mCount) mCount.textContent = documentLibraryData.modules.length;
    if (lCount) lCount.textContent = documentLibraryData.lessons.length;
    if (eCount) eCount.textContent = documentLibraryData.exams.length;
    if (aCount) aCount.textContent = attachmentCount;
}

function switchLibraryTab(tab) {
    currentLibraryTab = tab;
    const tabs = {
        modules: ['libraryTabModules', 'btn btn-primary'],
        lessons: ['libraryTabLessons', 'btn btn-primary'],
        exams: ['libraryTabExams', 'btn btn-primary']
    };
    Object.entries(tabs).forEach(([key, [id, activeClass]]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = key === tab ? activeClass : 'btn btn-secondary';
    });
    renderDocumentLibrary();
}

function getFilteredLibraryRows() {
    const keyword = (document.getElementById('librarySearch')?.value || '').trim().toLowerCase();
    const deptId = document.getElementById('libraryDeptFilter')?.value || '';
    const courseId = document.getElementById('libraryCourseFilter')?.value || '';
    const rows = documentLibraryData[currentLibraryTab] || [];
    return rows.filter(row => {
        const rowDept = String(row.targetDepartmentId || row.ownerDeptId || row.departmentId || '');
        const matchesDept = !deptId || rowDept === deptId;
        const matchesCourse = !courseId || String(row.courseId || row.ownerCourseId || '') === courseId;
        
        if (!matchesDept || !matchesCourse) return false;
        if (!keyword) return true;

        return [
            row.title,
            row.examTitle,
            row.courseTitle,
            row.courseCode,
            row.moduleTitle,
            row.contentType
        ].some(value => String(value || '').toLowerCase().includes(keyword));
    });
}

function renderDocumentLibrary() {
    const createBtn = document.getElementById('libraryCreateBtn');
    if (createBtn) {
        createBtn.textContent = currentLibraryTab === 'modules' ? '➕ Tạo Chương Mới' : currentLibraryTab === 'lessons' ? '➕ Tạo Bài Giảng Mới' : '➕ Tạo Quiz Mới';
    }

    const rows = getFilteredLibraryRows();
    const head = document.getElementById('documentLibraryHead');
    const body = document.getElementById('documentLibraryTable');
    if (!head || !body) return;

    if (currentLibraryTab === 'modules') {
        head.innerHTML = '<tr><th>ID</th><th>Tên chương</th><th>Level</th><th>Sử dụng trong</th><th>Bài giảng</th><th>Thao tác</th></tr>';
        body.innerHTML = rows.length ? rows.map(row => `
            <tr>
                <td>${row.moduleId}</td>
                <td><strong>${libraryEscape(row.title)}</strong></td>
                <td>${row.level ? `<span class="badge badge-info">Level ${row.level}</span>` : '<span style="color:#94a3b8">--</span>'}</td>
                <td>${row.deptName || row.categoryName || '<span style="color:#94a3b8">Hệ thống</span>'}</td>
                <td>${row.lessonsCount || 0}</td>
                <td>
                    <div style="display:flex;gap:8px;justify-content:flex-end">
                        <button class="btn btn-secondary btn-sm" onclick="openEditModuleModal(${row.moduleId})">Sửa</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteModule(${row.moduleId})">Xóa</button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Chưa có chương nào.</td></tr>';
        return;
    }

    if (currentLibraryTab === 'lessons') {
        head.innerHTML = '<tr><th>ID</th><th>Tên bài giảng</th><th>Thuộc chương</th><th>Khóa học</th><th>Tài liệu</th><th>Thao tác</th></tr>';
        body.innerHTML = rows.length ? rows.map(row => {
            const attachments = row.attachmentsCount ? `<span class="badge badge-blue">${row.attachmentsCount} tài liệu</span>` : '<span style="color:#94a3b8">Chưa có</span>';
            const video = row.videoUrl ? '<span class="badge badge-info">Video</span>' : '';
            const type = row.contentType ? `<span class="badge badge-purple">${libraryEscape(row.contentType)}</span>` : '';
            return `
            <tr>
                <td>${row.lessonId}</td>
                <td>
                    <strong>${libraryEscape(row.title)}</strong>
                    <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                        ${row.level ? `<span class="badge badge-info">Level ${row.level}</span>` : ''}
                        ${type}
                        ${video}
                    </div>
                </td>
                <td>${libraryEscape(row.moduleTitle || 'Chưa gán')}</td>
                <td><span class="badge badge-blue">${libraryEscape(row.courseTitle || 'Chưa gán khóa học')}</span></td>
                <td>${attachments}</td>
                <td>
                    <div style="display:flex;gap:8px;justify-content:flex-end">
                        <button class="btn btn-secondary btn-sm" onclick="openEditLessonModal(${row.lessonId})">Sửa</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteLesson(${row.lessonId})">Xóa</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Chưa có bài giảng nào.</td></tr>';
        return;
    }

    head.innerHTML = '<tr><th style="width:50px">ID</th><th>Tiêu đề Quiz</th><th style="width:100px">Level</th><th>Sử dụng trong</th><th style="width:200px">Cấu hình</th><th style="width:240px; text-align:right">Thao tác</th></tr>';
    body.innerHTML = rows.length ? rows.map(row => `
        <tr>
            <td style="color:#64748b; font-family:monospace">${row.examId}</td>
            <td>
                <div style="font-weight:700; color:#1e293b">${libraryEscape(row.examTitle)}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px">Cập nhật: ${fmtDate(row.createdAt)}</div>
            </td>
            <td>${row.level ? `<span class="badge badge-info" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd">Level ${row.level}</span>` : '<span style="color:#94a3b8">--</span>'}</td>
            <td><span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #ffedd5">${libraryEscape(row.courseTitle || 'Chưa gán')}</span></td>
            <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                    <span class="badge badge-info" style="font-size:10px" title="Thời gian">${row.durationMinutes || 0} phút</span>
                    <span class="badge badge-purple" style="font-size:10px" title="Điểm đỗ">Đỗ ${row.passScore || 0}</span>
                    <span class="badge badge-blue" style="font-size:10px; cursor:pointer" onclick="openExamQuestionsManagementModal(${row.examId})" title="Quản lý câu hỏi">📂 ${row.questionsCount || 0} câu</span>
                </div>
            </td>
            <td>
                <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                    <button class="btn btn-sm" style="background: linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; border:1px solid #fcd34d; font-weight:800; padding:5px 10px; font-size:11px; box-shadow: 0 1px 2px rgba(0,0,0,0.05)" onclick="suggestMultipleQuestionsAI(${row.examId})" title="AI Gợi ý bộ đề">🚀 AI</button>
                    <button class="btn btn-primary btn-sm" style="padding:5px 12px; background:#2563eb;" onclick="openExamQuestionsManagementModal(${row.examId})" title="Thiết kế câu hỏi">➕ Tạo</button>
                    <button class="btn btn-secondary btn-sm" style="padding:5px 12px;" onclick="openEditExamModal(${row.examId})" title="Sửa thông tin">📝</button>
                    <button class="btn btn-danger btn-sm" style="padding:5px 12px;" onclick="deleteExam(${row.examId})" title="Xóa Quiz">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">Chưa có quiz nào. Quý khách vui lòng nhấn "Tạo Quiz Mới" ở trên.</td></tr>';
}

function openLibraryCreateModal() {
    try {
        console.log('Opening library modal. Tab:', currentLibraryTab);
        
        if (currentLibraryTab === 'modules') {
            const select = document.getElementById('libraryModuleDeptInput');
            if (select) {
                const options = (loadedDepartmentsList || []).map(d => 
                    `<option value="${d.departmentId}">${libraryEscape(d.departmentName)}</option>`
                ).join('');
                select.innerHTML = options || '<option value="">(Không có phòng ban)</option>';
            }
            
            const mId = document.getElementById('libraryModuleId'); if (mId) mId.value = '';
            const mTitle = document.getElementById('libraryModuleTitleInput'); if (mTitle) mTitle.value = '';
            
            openModal('libraryModuleModal');
            return;
        }

        if (currentLibraryTab === 'lessons') {
            const select = document.getElementById('libraryLessonModuleInput');
            if (select) {
                const options = (documentLibraryData.modules || []).map(m => 
                    `<option value="${m.moduleId}">${libraryEscape(m.title)}</option>`
                ).join('');
                select.innerHTML = options || '<option value="">(Không có chương)</option>';
            }
            
            const lId = document.getElementById('libraryLessonId'); if (lId) lId.value = '';
            const lTitle = document.getElementById('libraryLessonTitleInput'); if (lTitle) lTitle.value = '';
            
            openModal('libraryLessonModal');
            return;
        }

        if (currentLibraryTab === 'exams') {
            const eId = document.getElementById('libraryExamId'); if (eId) eId.value = '';
            const eTitle = document.getElementById('libraryExamTitleInput'); if (eTitle) eTitle.value = '';
            const eLevel = document.getElementById('libraryExamLevelInput'); if (eLevel) eLevel.value = '';
            const eDuration = document.getElementById('libraryExamDurationInput'); if (eDuration) eDuration.value = 30;
            const ePass = document.getElementById('libraryExamPassScoreInput'); if (ePass) ePass.value = 50;
            const eMax = document.getElementById('libraryExamMaxAttemptsInput'); if (eMax) eMax.value = '';
            const eStart = document.getElementById('libraryExamStartDateInput'); if (eStart) eStart.value = '';
            const eEnd = document.getElementById('libraryExamEndDateInput'); if (eEnd) eEnd.value = '';
            
            const deptInput = document.getElementById('libraryExamTargetDeptInput');
            if (deptInput && typeof departments !== 'undefined') {
                const deptOpts = '<option value="">-- Tất cả phòng ban --</option>' + (departments || []).map(d => `<option value="${d.departmentId}">${d.departmentName}</option>`).join('');
                deptInput.innerHTML = deptOpts;
            }
            
            openModal('libraryExamModal');
            return;
        }
    } catch (e) {
        console.error('Failed to open library modal:', e);
        showToast('Lỗi khi mở bảng thêm mới: ' + e.message, 'error');
    }
}


function fillLibraryCourseOptions(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Chọn khóa học --</option>' + documentLibraryData.courses.map(course => `
        <option value="${course.courseId}">${libraryEscape(course.title || `Khóa học #${course.courseId}`)}</option>
    `).join('');
}

function fillLibraryModuleOptions(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Chọn chương --</option>' + documentLibraryData.modules.map(module => `
        <option value="${module.moduleId}">${libraryEscape(module.title || `Chương #${module.moduleId}`)}${module.courseTitle ? ` - ${libraryEscape(module.courseTitle)}` : ''}</option>
    `).join('');
}

async function syncDocumentLibraryAfterCreate(options = {}) {
    const {
        tab = currentLibraryTab,
        courseId = '',
        refreshCourseContent = false
    } = options;

    await loadDocumentLibrary();
    currentLibraryTab = tab;

    const deptFilter = document.getElementById('libraryDeptFilter');
    if (deptFilter) {
        // Clear filter after create in library to show the new item
        deptFilter.value = '';
    }

    renderDocumentLibrary();

    if (refreshCourseContent && currentContentCourseId && String(currentContentCourseId) === String(courseId)) {
        await loadBuilderLibrary();
        await loadCourseContent();
    }
}

async function submitLibraryModule() {
    const deptId = document.getElementById('libraryModuleDeptInput').value;
    const title = document.getElementById('libraryModuleTitleInput').value.trim();
    const level = parseInt(document.getElementById('libraryModuleLevelInput').value) || null;
    if (!deptId || !title) {
        showToast('Bạn phải chọn phòng ban và nhập tên chương.', 'error');
        return;
    }

    try {
        await apiFetch(`/api/it/courses/0/modules`, {
            method: 'POST',
            body: JSON.stringify({ title, level, targetDepartmentId: parseInt(deptId) })
        });
        closeModal('libraryModuleModal');
        showToast('Đã tạo chương mới và lưu vào kho.', 'success');
        await loadDocumentLibrary();
        renderDocumentLibrary();
    } catch (e) {
        showToast(e.message || 'Lỗi tạo chương', 'error');
    }
}

async function submitLibraryLesson() {
    const moduleId = document.getElementById('libraryLessonModuleInput').value;
    const title = document.getElementById('libraryLessonTitleInput').value.trim();
    const level = parseInt(document.getElementById('libraryLessonLevelInput').value) || null;
    const contentType = document.getElementById('libraryLessonTypeInput').value;
    const videoUrl = document.getElementById('libraryLessonVideoInput').value.trim();
    const contentBody = document.getElementById('libraryLessonBodyInput').value;
    if (!moduleId || !title) {
        showToast('Bạn phải chọn chương và nhập tên bài học.', 'error');
        return;
    }

    try {
        const created = await apiFetch(`/api/it/modules/${moduleId}/lessons`, {
            method: 'POST',
            body: JSON.stringify({ title, level, contentType, videoUrl, contentBody })
        });
        await uploadLessonAssets(created.id, 'libraryLessonFileInput', 'libraryLessonLinkInput');
        const selectedModule = (documentLibraryData.modules || []).find(m => String(m.moduleId) === String(moduleId));
        closeModal('libraryLessonModal');
        showToast('Đã tạo bài giảng mới.', 'success');
        await syncDocumentLibraryAfterCreate({
            tab: 'lessons',
            courseId: selectedModule?.courseId || '',
            refreshCourseContent: true
        });
    } catch (e) {
        showToast(e.message || 'Lỗi tạo bài giảng', 'error');
    }
}

async function submitLibraryExam() {
    const btn = event?.target || document.querySelector('#libraryExamModal .btn-primary');
    const originalText = btn ? btn.innerHTML : '💾 Lưu';
    
    console.log('--- submitLibraryExam EXECUTION START ---');
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-small"></span> Đang xử lý...';
        }

        const titleEl = document.getElementById('libraryExamTitleInput');
        const levelEl = document.getElementById('libraryExamLevelInput');
        const durationEl = document.getElementById('libraryExamDurationInput');
        const passScoreEl = document.getElementById('libraryExamPassScoreInput');
        const maxAttemptsEl = document.getElementById('libraryExamMaxAttemptsInput');
        const startEl = document.getElementById('libraryExamStartDateInput');
        const endEl = document.getElementById('libraryExamEndDateInput');
        const deptEl = document.getElementById('libraryExamTargetDeptInput');

        if (!titleEl) {
            throw new Error('Element libraryExamTitleInput not found in DOM');
        }

        const examTitle = titleEl.value.trim();
        const level = levelEl && levelEl.value ? parseInt(levelEl.value) : null;
        const durationMinutes = durationEl && durationEl.value ? parseInt(durationEl.value) : 30;
        const passScore = passScoreEl && passScoreEl.value ? parseFloat(passScoreEl.value) : 50;
        const maxAttempts = maxAttemptsEl && maxAttemptsEl.value ? parseInt(maxAttemptsEl.value) : null;
        const startDate = startEl && startEl.value ? startEl.value : null;
        const endDate = endEl && endEl.value ? endEl.value : null;
        const targetDepartmentId = deptEl && deptEl.value ? parseInt(deptEl.value) : null;

        console.log('Values collected:', { examTitle, level, durationMinutes, passScore, maxAttempts, startDate, endDate, targetDepartmentId });

        if (!examTitle) {
            showToast('Bạn phải nhập tiêu đề quiz.', 'warning');
            if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
            return;
        }

        const payload = { 
            examTitle, 
            level, 
            durationMinutes, 
            passScore, 
            maxAttempts, 
            startDate, 
            endDate, 
            targetDepartmentId,
            aiQuestions: lastGeneratedQuestions || []
        };

        console.log('Submitting payload to /api/it/courses/0/exams:', payload);

        const result = await apiFetch(`/api/it/courses/0/exams`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        console.log('API Response:', result);

        lastGeneratedQuestions = [];
        closeModal('libraryExamModal');
        showToast('Đã lưu bài quiz mới thành công.', 'success');
        
        await syncDocumentLibraryAfterCreate({
            tab: 'exams',
            courseId: 0,
            refreshCourseContent: true
        });

    } catch (e) {
        console.error('CRITICAL ERROR in submitLibraryExam:', e);
        showToast('Lỗi khi lưu bài quiz: ' + (e.message || 'Lỗi không xác định'), 'error', { persistent: true });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
        console.log('--- submitLibraryExam EXECUTION END ---');
    }
}

async function generateQuizWithAI(source = 'library') {
    const promptId = source === 'exam' ? 'aiExamPrompt' : 'aiQuizPrompt';
    const btnId = source === 'exam' ? 'btnGenerateExamAI' : 'btnGenerateQuizAI';
    const statusId = source === 'exam' ? 'aiExamStatus' : 'aiQuizStatus';
    const titleId = source === 'exam' ? 'examTitleInput' : 'libraryExamTitleInput';
    const durationId = source === 'exam' ? 'examDurationInput' : 'libraryExamDurationInput';

    const prompt = document.getElementById(promptId).value.trim();
    if (!prompt) {
        showToast('Vui lòng nhập yêu cầu cho AI (VD: 10 câu hỏi về PCCC)', 'warning');
        return;
    }

    const btn = document.getElementById(btnId);
    const status = document.getElementById(statusId);
    
    try {
        btn.disabled = true;
        status.innerHTML = '<span class="spinner-small"></span> AI đang thiết kế bộ câu hỏi cho bạn...';

        const result = await apiFetch('/api/it/generate-quiz-ai', {
            method: 'POST',
            body: JSON.stringify({ prompt })
        });

        if (result && result.examTitle) {
            document.getElementById(titleId).value = result.examTitle;
            if (result.durationMinutes) document.getElementById(durationId).value = result.durationMinutes;
            
            // Store questions to be saved later, mapping to ItCreateQuestionDto format
            if (result.questions && result.questions.length > 0) {
                lastGeneratedQuestions = result.questions.map(q => ({
                    questionText: q.questionText || q.QuestionText || 'Câu hỏi chưa có nội dung',
                    points: q.points || q.Points || 10,
                    options: (q.options || q.Options || []).map((opt, idx) => ({
                        optionText: typeof opt === 'string' ? opt : (opt.optionText || opt.OptionText || ''),
                        isCorrect: typeof opt === 'object' ? (!!opt.isCorrect || !!opt.IsCorrect) : ((idx + 1) === (q.correctOptionIndex || q.CorrectOptionIndex || 1))
                    }))
                }));
                showToast(`AI đã soạn thảo xong ${result.questions.length} câu hỏi! Vui lòng nhấn Lưu để hoàn tất.`, 'success');
                status.innerHTML = `<span style="color:#10b981">✨ Đã soạn sẵn ${result.questions.length} câu hỏi. Hãy nhấn nút Lưu bên dưới.</span>`;
            } else {
                showToast('AI đã soạn thảo xong thông tin! Vui lòng lưu.', 'success');
                status.innerHTML = '<span style="color:#10b981">✨ Đã tự động điền thông tin bài thi.</span>';
            }
        }
    } catch (e) {
        showToast(e.message || 'Lỗi AI', 'error');
        status.innerHTML = '<span style="color:#ef4444">Lỗi: ' + e.message + '</span>';
    } finally {
        btn.disabled = false;
    }
}

async function generateModuleWithAI(source) {
    const promptId = source === 'library' ? 'aiLibraryModulePrompt' : 'aiModulePrompt';
    const statusId = source === 'library' ? 'aiLibraryModuleStatus' : 'aiModuleStatus';
    const btnId = source === 'library' ? 'btnGenerateLibraryModuleAI' : 'btnGenerateModuleAI';
    const titleId = source === 'library' ? 'libraryModuleTitleInput' : 'moduleTitleInput';

    const prompt = document.getElementById(promptId).value.trim();
    if (!prompt) { showToast('Vui lòng nhập chủ đề chương!', 'warning'); return; }

    const statusEl = document.getElementById(statusId);
    const btn = document.getElementById(btnId);

    statusEl.innerHTML = '<span class="spinner-small"></span> Đang phân tích chủ đề...';
    btn.disabled = true;

    try {
        const data = await apiFetch('/api/it/generate-module-ai', {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt })
        });
        document.getElementById(titleId).value = data.title;
        statusEl.innerHTML = `<span style="color:#10b981">✨ Đã gợi ý chương: <b>${data.title}</b>. Bạn có thể chỉnh sửa thêm bên dưới.</span>`;
    } catch (e) {
        statusEl.innerHTML = `<span style="color:#ef4444">Lỗi: ${e.message}</span>`;
    } finally {
        btn.disabled = false;
    }
}

async function generateLessonWithAI(source) {
    const promptId = source === 'library' ? 'aiLibraryLessonPrompt' : 'aiLessonPrompt';
    const statusId = source === 'library' ? 'aiLibraryLessonStatus' : 'aiLessonStatus';
    const btnId = source === 'library' ? 'btnGenerateLibraryLessonAI' : 'btnGenerateLessonAI';
    const titleId = source === 'library' ? 'libraryLessonTitleInput' : 'lessonTitleInput';
    const bodyId = source === 'library' ? 'libraryLessonBodyInput' : 'lessonBodyInput';

    const prompt = document.getElementById(promptId).value.trim();
    if (!prompt) { showToast('Vui lòng nhập chủ đề bài giảng!', 'warning'); return; }

    const statusEl = document.getElementById(statusId);
    const btn = document.getElementById(btnId);

    statusEl.innerHTML = '<span class="spinner-small"></span> AI đang soạn thảo nội dung...';
    btn.disabled = true;

    try {
        const data = await apiFetch('/api/it/generate-lesson-ai', {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt })
        });
        document.getElementById(titleId).value = data.title;
        document.getElementById(bodyId).value = data.contentBody;
        statusEl.innerHTML = `<span style="color:#10b981">✨ Đã soạn thảo xong bài: <b>${data.title}</b>. Nội dung đã được điền vào phần Text.</span>`;
    } catch (e) {
        statusEl.innerHTML = `<span style="color:#ef4444">Lỗi: ${e.message}</span>`;
    } finally {
        btn.disabled = false;
    }
}


async function loadOverview() {
    try {
        const [stats, activeStats] = await Promise.all([
            apiFetch('/api/it/stats'),
            apiFetch('/api/it/users/active-stats')
        ]);
        document.getElementById('itStatsGrid').innerHTML = `
            <div class="stat-card blue">
                <div class="stat-icon blue">👥</div>
                <div class="stat-value">${fmtNumber(stats.totalUsers)}</div>
                <div class="stat-label">Người dùng</div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon green">🏢</div>
                <div class="stat-value">${fmtNumber(stats.totalDepartments)}</div>
                <div class="stat-label">Phòng ban</div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon purple">☁️</div>
                <div class="stat-value">${fmtNumber(stats.activeUsers)}</div>
                <div class="stat-label">Hoạt động</div>
            </div>
            <div class="stat-card orange" style="--card-accent:#f59e0b">
                <div class="stat-icon" style="background:rgba(245,158,11,.12);color:#d97706">🕒</div>
                <div class="stat-value">${fmtNumber(activeStats.recentlyActive || 0)}</div>
                <div class="stat-label">Online 30 ngày</div>
            </div>
        `;

        if (stats.userRoleDist && window.Chart) {
            const ctx = document.getElementById('userChart').getContext('2d');
            if (userChart) userChart.destroy();
            userChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(stats.userRoleDist),
                    datasets: [{ data: Object.values(stats.userRoleDist), backgroundColor: ['#3b82f6', '#10b981', '#6366f1'] }]
                },
                options: { plugins: { legend: { position: 'right' } } }
            });
        }

        const logs = await apiFetch('/api/it/auditlogs?pageSize=7');
        document.getElementById('recentLogs').innerHTML = (logs.logs || []).map(l => `
            <div class="log-item">
                <div style="font-weight:600">${l.userName}</div>
                <div style="font-size:12px;color:#64748b">${l.actionType} - ${fmtDateTime(l.createdAt)}</div>
                <div style="font-size:11px;color:#94a3b8">${l.description || ''}</div>
            </div>
        `).join('') || '<div style="padding:20px;text-align:center">Chưa có dữ liệu</div>';
    } catch(e) {
        console.error(e);
        document.getElementById('itStatsGrid').innerHTML = `<div class="card"><div class="card-body" style="color:#ef4444">Không tải được dashboard: ${e.message}</div></div>`;
        document.getElementById('recentLogs').innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444">Không tải được hoạt động gần đây</div>`;
        const chartEmpty = document.getElementById('userChartEmpty');
        if (chartEmpty) chartEmpty.style.display = 'block';
    }
}

async function loadUsers(page = 1) {
    const search = document.getElementById('userSearch')?.value || '';
    try {
        const data = await apiFetch(`/api/it/users?search=${encodeURIComponent(search)}&page=${page}&pageSize=15`);
        loadedUsersList = data.users || [];
        document.getElementById('usersTable').innerHTML = loadedUsersList.map(u => `
            <tr>
                <td><input type="checkbox" class="user-check" value="${u.userId}" onchange="updateSelectedList()"></td>
                <td><strong>${u.fullName}</strong><div style="font-size:11px;color:#94a3b8">@${u.username}</div></td>
                <td><code>${u.employeeCode || '—'}</code></td>
                <td><span class="badge badge-info">${u.department || 'N/A'}</span></td>
                <td>${statusBadge(u.status)}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditModal(${u.userId})" title="Sửa">📝</button>
                    <button class="btn btn-info btn-sm" onclick="openUserRoleModal(${u.userId})" style="padding: 6px; background:#6366f1;color:#fff;border:none" title="Role">🔑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.userId}, '${u.username}')" style="padding: 6px;" title="Khóa/Xóa">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch(e) {
        if(typeof console !== 'undefined') console.error(e);
        if(typeof showToast === 'function') showToast(e.message || 'Lỗi API Backend: Mã lỗi 500', 'error');
        if(typeof document !== 'undefined') {
            document.querySelectorAll('.loading-overlay').forEach(el => {
                if(el.parentElement && el.parentElement.tagName === 'TD') {
                    el.parentElement.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px;">Lỗi tải dữ liệu. Cần Update Database hoặc Code</div>';
                }
            });
        }
    }
}

async function loadAuditLogs(page = 1) {
    try {
        const data = await apiFetch(`/api/it/auditlogs?page=${page}&pageSize=15`);
        document.getElementById('fullAuditLogsTable').innerHTML = (data.logs || []).map(l => `
            <tr>
                <td>${fmtDateTime(l.createdAt)}</td>
                <td><strong>${l.userName}</strong></td>
                <td>${l.actionType}</td>
                <td>${l.description || ''}</td>
            </tr>
        `).join('');
    } catch(e) {
        if(typeof console !== 'undefined') console.error(e);
        if(typeof showToast === 'function') showToast(e.message || 'Lỗi API Backend: Mã lỗi 500', 'error');
    }
}

function updateSelectedList() {
    selectedUserIds = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value);
}
function toggleSelectAll(master) {
    document.querySelectorAll('.user-check').forEach(cb => cb.checked = master.checked);
    updateSelectedList();
}
function openBulkDeptModal() {
    if (selectedUserIds.length === 0) { showToast('Hãy chọn ít nhất 1 người', 'warning'); return; }
    document.getElementById('bulkCountText').textContent = `Đã chọn ${selectedUserIds.length} nhân viên.`;
    openModal('bulkDeptModal');
}
async function submitBulkDept() {
    const deptId = document.getElementById('bulkDeptSel').value;
    if (!deptId) return;
    try {
        for (let id of selectedUserIds) {
            await apiFetch(`/api/it/users/${id}`, { method: 'PUT', body: JSON.stringify({ departmentId: parseInt(deptId) }) });
        }
        showToast('Đã phân bổ thành công!');
        closeModal('bulkDeptModal');
        loadUsers(1);
    } catch(e) {
        showToast(e.message || 'Lỗi phân bổ', 'error');
    }
}

async function submitCreateUser() {
    const body = {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value || '123',
        fullName: document.getElementById('newFullName').value,
        employeeCode: document.getElementById('newEmployeeCode').value || ('NV' + Math.floor(Math.random() * 1000000)),
        email: document.getElementById('newEmail').value || (document.getElementById('newUsername').value + '@domain.com'),
        departmentId: parseInt(document.getElementById('newDepartment').value) || null
    };
    if(!body.username) { showToast('Vui lòng nhập tên đăng nhập!', 'error'); return; }
    
    try {
        await apiFetch('/api/it/users', { method: 'POST', body: JSON.stringify(body) });
        showToast('Tạo tài khoản thành công!');
        closeModal('createUserModal');
        loadUsers(1);
    } catch(e) {
        showToast(e.message || 'Lỗi tạo tài khoản', 'error');
    }
}

let loadedUsersList = [];

async function openEditModal(id) {
    const user = loadedUsersList.find(u => u.userId === id);
    if (!user) return;
    
    document.getElementById('editUserId').value = user.userId;
    document.getElementById('editFullName').value = user.fullName || '';
    document.getElementById('editDepartment').value = user.departmentId || '';
    document.getElementById('editStatus').value = user.status;
    document.getElementById('editPassword').value = '';
    
    openModal('editUserModal');
}

async function submitEditUser() {
    const id = document.getElementById('editUserId').value;
    const dpId = parseInt(document.getElementById('editDepartment').value);
    const body = {
        fullName: document.getElementById('editFullName').value,
        status: document.getElementById('editStatus').value,
        departmentId: isNaN(dpId) ? null : dpId,
        newPassword: document.getElementById('editPassword').value || null
    };
    
    try {
        await apiFetch(`/api/it/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Cập nhật thành công!');
        closeModal('editUserModal');
        loadUsers(1);
    } catch(e) {
        showToast(e.message || 'Lỗi cập nhật', 'error');
    }
}

async function openUserRoleModal(id) {
    if (!availableRoles.length) await refreshRoles();
    const user = loadedUsersList.find(u => u.userId === id);
    if (!user) return;

    document.getElementById('userRoleUserId').value = id;
    document.getElementById('userRoleUserName').value = user.fullName || user.username || '';
    const selectedRoleIds = new Set((user.roles || []).map(r => String(r.roleId)));
    document.getElementById('userRoleSelect').innerHTML = availableRoles.map(r =>
        `<option value="${r.roleId}" ${selectedRoleIds.has(String(r.roleId)) ? 'selected' : ''}>${r.roleName}</option>`
    ).join('');
    openModal('userRoleModal');
}

async function submitUserRoles() {
    const userId = document.getElementById('userRoleUserId').value;
    const user = loadedUsersList.find(u => String(u.userId) === String(userId));
    if (!user) return;

    const selectedRoleIds = Array.from(document.getElementById('userRoleSelect').selectedOptions).map(o => parseInt(o.value));
    const currentRoleIds = new Set((user.roles || []).map(r => r.roleId));

    try {
        for (const roleId of selectedRoleIds) {
            if (!currentRoleIds.has(roleId)) {
                await apiFetch(`/api/it/users/${userId}/roles/${roleId}`, { method: 'POST' });
            }
        }

        for (const role of (user.roles || [])) {
            if (!selectedRoleIds.includes(role.roleId)) {
                await apiFetch(`/api/it/users/${userId}/roles/${role.roleId}`, { method: 'DELETE' });
            }
        }

        showToast('Cập nhật role thành công!');
        closeModal('userRoleModal');
        loadUsers();
    } catch(e) {
        showToast(e.message || 'Lỗi cập nhật role', 'error');
    }
}

async function deleteUser(id, username) {
    if(!confirm(`Bạn có chắc muốn vô hiệu hóa (xóa) tài khoản: ${username}?`)) return;
    try {
        await apiFetch(`/api/it/users/${id}`, { method: 'DELETE' });
        showToast('Đã vô hiệu hóa tài khoản thành công!', 'warning');
        loadUsers(1);
    } catch(e) {
        showToast(e.message || 'Lỗi xóa tài khoản', 'error');
    }
}

// ==== Courses Management ====
let loadedCoursesList = [];
async function loadItCourses() {
    const search = document.getElementById('courseSearch')?.value || '';
    try {
        const res = await apiFetch(`/api/it/courses?search=${encodeURIComponent(search)}`);
        loadedCoursesList = res.courses || res || [];
        document.getElementById('itCoursesTable').innerHTML = loadedCoursesList.map(c => `
            <tr>
                <td>${c.courseId || c.id}</td>
                <td><code>${c.courseCode || '—'}</code></td>
                <td>
                    <div style="display:grid;gap:4px">
                        <strong>${c.title}</strong>
                        <span style="font-size:12px;color:#64748b">${c.description ? c.description.substring(0, 56) + (c.description.length > 56 ? '...' : '') : 'Chưa có mô tả'}</span>
                    </div>
                </td>
                <td>${c.level ? `<span class="badge badge-purple">Level ${c.level}</span>` : '<span style="color:#94a3b8">--</span>'}</td>
                <td><span class="badge badge-info">${c.category || 'N/A'}</span></td>
                <td>${c.isMandatory ? '<span class="badge" style="background:#fef2f2;color:#ef4444">Bắt buộc</span>' : '<span style="color:#94a3b8">Tùy chọn</span>'}</td>
                <td>${statusBadge(c.status || 'Active')}</td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                    <button class="btn btn-info btn-sm" onclick="openCourseContentModal(${c.courseId || c.id})" style="padding:6px;background:#3b82f6;color:white;border:none" title="Quản lý Nội dung 📂">📂 Nội dung</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditCourseModal(${c.courseId || c.id})" title="Sửa">📝</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.courseId || c.id})" style="padding: 6px;" title="Xóa">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="8" style="text-align:center">Không có dữ liệu</td></tr>';
    } catch(e) {
        document.getElementById('itCoursesTable').innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444">Không tải được khóa học: ${e.message}</td></tr>`;
    }
}
const debouncedLoadItCourses = debounce(loadItCourses, 400);

async function openCreateCourseModal() {
    if (!loadedCategoriesList.length) await loadCategories();
    document.getElementById('courseModalTitle').textContent = '➕ Thêm khóa học';
    document.getElementById('courseModalId').value = '';
    document.getElementById('courseModalCodeInput').value = '';
    document.getElementById('courseModalTitleInput').value = '';
    document.getElementById('courseModalDesc').value = '';
    document.getElementById('courseModalLevel').value = '';
    refreshCourseCategoryDropdown();
    document.getElementById('courseModalCategory').value = '';
    document.getElementById('courseModalStatus').value = 'Active';
    document.getElementById('courseModalStartDate').value = '';
    document.getElementById('courseModalEndDate').value = '';
    document.getElementById('courseModalTargetDept').value = '';
    document.getElementById('courseModalMandatory').checked = false;
    openModal('courseModal');
}

async function openEditCourseModal(id) {
    const c = loadedCoursesList.find(x => (x.courseId || x.id) == id);
    if (!c) return;
    if (!loadedCategoriesList.length) await loadCategories();
    refreshCourseCategoryDropdown(c.categoryId);
    document.getElementById('courseModalTitle').textContent = '📝 Sửa khóa học';
    document.getElementById('courseModalId').value = id;
    document.getElementById('courseModalCodeInput').value = c.courseCode || '';
    document.getElementById('courseModalTitleInput').value = c.title || '';
    document.getElementById('courseModalDesc').value = c.description || '';
    document.getElementById('courseModalLevel').value = c.level || '';
    document.getElementById('courseModalStatus').value = c.status || 'Active';
    document.getElementById('courseModalStartDate').value = c.startDate ? c.startDate.substring(0,10) : '';
    document.getElementById('courseModalEndDate').value = c.endDate ? c.endDate.substring(0,10) : '';
    let targetIdsStr = c.targetDepartmentIds || (c.targetDepartmentId ? c.targetDepartmentId.toString() : "");
    let targetIds = targetIdsStr.split(',').map(s => s.trim());
    Array.from(document.getElementById('courseModalTargetDept').options).forEach(o => o.selected = targetIds.includes(o.value));
    document.getElementById('courseModalMandatory').checked = !!c.isMandatory;
    openModal('courseModal');
}

async function generateWithAI() {
    const prompt = document.getElementById('aiPrompt').value;
    if (!prompt) return showToast('Vui lòng nhập chủ đề cho AI!', 'warning');
    
    const btn = document.getElementById('btnGenerateAI');
    btn.innerHTML = '✨ Đang nghĩ...';
    btn.disabled = true;
    
    try {
        const res = await apiFetch('/api/hr/ai-generate-course', { method: 'POST', body: JSON.stringify({ prompt }) });
        document.getElementById('courseModalTitleInput').value = res.title;
        document.getElementById('courseModalDesc').value = res.description;
        showToast('AI đã tạo xong nội dung!', 'success');
    } catch(e) {
        showToast('Lỗi AI: ' + e.message, 'error');
    } finally {
        btn.innerHTML = 'Tạo';
        btn.disabled = false;
    }
}

async function submitCourse() {
    const id = document.getElementById('courseModalId').value;
    const isEdit = !!id;
    const body = {
        courseCode: document.getElementById('courseModalCodeInput').value.trim(),
        title: document.getElementById('courseModalTitleInput').value,
        description: document.getElementById('courseModalDesc').value,
        level: parseInt(document.getElementById('courseModalLevel').value) || null,
        categoryId: parseInt(document.getElementById('courseModalCategory').value) || null,
        status: document.getElementById('courseModalStatus').value,
        startDate: document.getElementById('courseModalStartDate').value || null,
        endDate: document.getElementById('courseModalEndDate').value || null,
        targetDepartmentIds: Array.from(document.getElementById('courseModalTargetDept').selectedOptions).map(o => parseInt(o.value)).filter(v => !isNaN(v)),
        isMandatory: document.getElementById('courseModalMandatory').checked
    };
    if (!body.title) { showToast('Bạn phải nhập tên khóa học!', 'error'); return; }

    try {
        if (isEdit) {
            await apiFetch(`/api/it/courses/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Cập nhật khóa học thành công!');
        } else {
            await apiFetch(`/api/it/courses`, { method: 'POST', body: JSON.stringify(body) });
            showToast('Tạo khóa học thành công!');
        }
        closeModal('courseModal');
        loadItCourses();
    } catch(e) {
        showToast(e.message || 'Lỗi', 'error');
    }
}

function refreshCourseCategoryDropdown(selectedId) {
    const el = document.getElementById('courseModalCategory');
    if (!el) return;
    el.innerHTML = '<option value="">-- Chọn danh mục --</option>' + loadedCategoriesList.map(c =>
        `<option value="${c.categoryId}" ${String(c.categoryId) === String(selectedId || '') ? 'selected' : ''}>${c.categoryName}</option>`
    ).join('');
}

async function deleteCourse(id) {
    if (!confirm('Bạn có chắc muốn xóa khóa học này?')) return;
    try {
        await apiFetch(`/api/it/courses/${id}`, { method: 'DELETE' });
        showToast('Xóa thành công!', 'warning');
        loadItCourses();
    } catch(e) {
        showToast(e.message || 'Lỗi', 'error');
    }
}

// ==== Departments Management ====
let loadedDepartmentsList = [];
async function loadItDepartments() {
    try {
        const data = await apiFetch(`/api/it/departments`);
        loadedDepartmentsList = data || [];
        document.getElementById('itDepartmentsTable').innerHTML = loadedDepartmentsList.map(d => `
            <tr>
                <td>${d.departmentId}</td>
                <td><strong>${d.departmentName}</strong></td>
                <td>${d.managerName ? `<span class="badge badge-green">${d.managerName}</span>` : '<span style="color:#94a3b8">Chưa có</span>'}</td>
                <td>${d.userCount || 0} nhân viên</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="openDepartmentDetailModal(${d.departmentId})" style="padding:6px;background:#2563eb;color:#fff;border:none" title="Chi tiết">👥</button>
                    <button class="btn btn-secondary btn-sm" onclick="openEditDeptModal(${d.departmentId})" title="Sửa">📝</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDept(${d.departmentId})" style="padding: 6px;" title="Xóa">🗑️</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center">Không có dữ liệu</td></tr>';
    } catch(e) {
        document.getElementById('itDepartmentsTable').innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444">Không tải được phòng ban: ${e.message}</td></tr>`;
    }
}

function openCreateDeptModal() {
    document.getElementById('deptModalTitle').textContent = '➕ Thêm phòng ban';
    document.getElementById('deptModalId').value = '';
    document.getElementById('deptModalName').value = '';
    openModal('deptModal');
}

function openEditDeptModal(id) {
    const d = loadedDepartmentsList.find(x => x.departmentId == id);
    if (!d) return;
    document.getElementById('deptModalTitle').textContent = '📝 Sửa phòng ban';
    document.getElementById('deptModalId').value = id;
    document.getElementById('deptModalName').value = d.departmentName || '';
    openModal('deptModal');
}

async function submitDepartment() {
    const id = document.getElementById('deptModalId').value;
    const isEdit = !!id;
    const body = {
        departmentName: document.getElementById('deptModalName').value
    };
    if (!body.departmentName) { showToast('Bạn phải nhập tên phòng ban!', 'error'); return; }

    try {
        if (isEdit) {
            await apiFetch(`/api/it/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Cập nhật phòng ban thành công!');
        } else {
            await apiFetch(`/api/it/departments`, { method: 'POST', body: JSON.stringify(body) });
            showToast('Tạo phòng ban thành công!');
        }
        closeModal('deptModal');
        loadItDepartments();
        refreshDepartmentsDropdown();
    } catch(e) {
        showToast(e.message || 'Lỗi', 'error');
    }
}

async function deleteDept(id) {
    if (!confirm('Bạn có chắc muốn xóa phòng ban này?')) return;
    try {
        await apiFetch(`/api/it/departments/${id}`, { method: 'DELETE' });
        showToast('Xóa thành công!', 'warning');
        loadItDepartments();
        refreshDepartmentsDropdown();
    } catch(e) {
         showToast(e.message || 'Lỗi', 'error');
    }
}

// ==== Course Content Management (Builder) ====
let currentContentCourseId = null;
let currentCourseContentParams = { modules: [], exams: [] };

async function openCourseContentModal(courseId) {
    currentContentCourseId = courseId;
    currentModuleId = null;
    document.getElementById('contentCourseId').value = courseId;
    
    const course = loadedCoursesList.find(c => (c.courseId || c.id) == courseId);
    if (course) {
        document.getElementById('contentModalTitle').textContent = 'Nội dung: ' + (course.title || '');
        if (course.level) {
            document.getElementById('builderLevelFilter').value = course.level;
        }
    }
    
    openModal('courseContentModal');
    await loadBuilderLibrary();
    await loadCourseContent();
}

async function loadBuilderLibrary() {
    try {
        if (!documentLibraryData || !documentLibraryData.modules.length) {
            await loadDocumentLibrary();
        }
        renderBuilderBoards();
    } catch (e) {
        showToast('Lỗi tải thư viện: ' + e.message, 'error');
    }
}

function renderBuilderBoards() {
    const levelFilter = document.getElementById('builderLevelFilter').value;
    const filterFn = (item) => !levelFilter || String(item.level) === String(levelFilter);
    
    const mods = (documentLibraryData.modules || []).filter(filterFn);
    document.getElementById('libModulesList').innerHTML = mods.map(m => `
        <div class="builder-item" draggable="true" ondragstart="handleDragStart(event, 'module', ${m.moduleId}, '${m.title.replace(/'/g, "\\'")}', ${m.level || 0})">
            <span style="color:#1d4ed8">🧩</span>
            <div style="flex:1">
                <div style="font-size:12px; font-weight:600;">${libraryEscape(m.title)}</div>
                <div style="font-size:10px; color:#64748b">ID: ${m.moduleId} ${m.level ? "| L" + m.level : ""}</div>
            </div>
        </div>
    `).join('') || '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:11px;">Trống</div>';

    const lessons = (documentLibraryData.lessons || []).filter(filterFn);
    document.getElementById('libLessonsList').innerHTML = lessons.map(l => `
        <div class="builder-item" draggable="true" ondragstart="handleDragStart(event, 'lesson', ${l.lessonId}, '${l.title.replace(/'/g, "\\'")}', ${l.level || 0})">
            <span style="color:#15803d">📄</span>
            <div style="flex:1">
                <div style="font-size:12px; font-weight:600;">${libraryEscape(l.title)}</div>
                <div style="font-size:10px; color:#64748b">${l.contentType} | ID: ${l.lessonId} ${l.level ? "| L" + l.level : ""}</div>
            </div>
        </div>
    `).join('') || '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:11px;">Trống</div>';

    const exams = (documentLibraryData.exams || []).filter(filterFn);
    document.getElementById('libExamsList').innerHTML = exams.map(e => `
        <div class="builder-item" draggable="true" ondragstart="handleDragStart(event, 'exam', ${e.examId}, '${e.examTitle.replace(/'/g, "\\'")}', ${e.level || 0})">
            <span style="color:#c2410c">❓</span>
            <div style="flex:1">
                <div style="font-size:12px; font-weight:600;">${libraryEscape(e.examTitle)}</div>
                <div style="font-size:10px; color:#64748b">${e.durationMinutes}p | ID: ${e.examId} ${e.level ? "| L" + e.level : ""}</div>
            </div>
        </div>
    `).join('') || '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:11px;">Trống</div>';
}

async function loadCourseContent() {
    if (!currentContentCourseId) return;
    try {
        const data = await apiFetch('/api/it/courses/' + currentContentCourseId + '/content');
        currentCourseContentParams = data;
        renderBuilderStructure();
    } catch(e) {
        showToast('Lỗi tải nội dung: ' + e.message, 'error');
    }
}

function renderBuilderStructure() {
    const data = currentCourseContentParams;
    const structureList = document.getElementById('builderStructureList');
    const emptyMsg = document.getElementById('builderEmptyMessage');
    
    if ((!data.modules || data.modules.length === 0) && (!data.exams || data.exams.length === 0)) {
        structureList.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    
    emptyMsg.style.display = 'none';
    let html = '';
    
    if (data.modules && data.modules.length > 0) {
        data.modules.forEach(m => {
            html += `
            <div class="structure-module">
                <div class="structure-module-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:18px;">🧩</span>
                        <div>
                            <div style="font-weight:700; color:#0f172a; font-size:13px;">${libraryEscape(m.title)}</div>
                            <div style="font-size:11px; color:#64748b;">Chương • ${m.lessons ? m.lessons.length : 0} bài học ${m.level ? "• L" + m.level : ""}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" style="padding:4px 8px; border:none; background:#f1f5f9;" onclick="openEditModuleModal(${m.moduleId})">📝</button>
                        <button class="btn btn-danger btn-sm" style="padding:4px 8px; border:none; background:#fef2f2; color:#ef4444;" onclick="unlinkModule(${m.moduleId})">🗑️</button>
                        <button class="btn btn-primary btn-sm" style="padding:4px 8px;" onclick="openLessonModal(${m.moduleId})">➕ Bài học</button>
                    </div>
                </div>
                <div class="structure-module-body" id="drop-module-${m.moduleId}" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleModuleDrop(event, ${m.moduleId})">
                    ${(m.lessons && m.lessons.length > 0) ? m.lessons.map(l => `
                        <div class="structure-item">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span style="font-size:13px; color:#3b82f6;">${l.contentType === "Video" ? "▶️" : "📄"}</span>
                                <span style="font-weight:600;">${libraryEscape(l.title)}</span>
                                ${l.level ? '<span class="badge-level level-' + l.level + '">L' + l.level + '</span>' : ""}
                            </div>
                            <div style="display:flex; gap:4px;">
                                <button class="btn btn-sm" style="padding:2px 6px; border:none; background:transparent;" onclick="openEditLessonModal(${l.lessonId})">📝</button>
                                <button class="btn btn-sm" style="padding:2px 6px; border:none; background:transparent; color:#ef4444;" onclick="unlinkLesson(${l.lessonId})">🗑️</button>
                            </div>
                        </div>
                    `).join('') : '<div style="text-align:center; padding:15px; color:#cbd5e1; font-size:11px; border:1px dashed #f1f5f9; border-radius:6px;">Kéo bài giảng vào đây</div>'}
                </div>
            </div>`;
        });
    }
    
    if (data.exams && data.exams.length > 0) {
        data.exams.forEach(e => {
            html += `
            <div class="structure-module" style="border-left:4px solid #f97316;">
                <div class="structure-module-header" style="background:#fff7ed;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:18px;">❓</span>
                        <div>
                            <div style="font-weight:700; color:#c2410c; font-size:13px;">${libraryEscape(e.examTitle)}</div>
                            <div style="font-size:11px; color:#9a3412;">Quiz • ${e.durationMinutes}p • Đỗ ${e.passScore} ${e.level ? "• L" + e.level : ""}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" style="padding:4px 8px; border:none; background:#fff;" onclick="openEditExamModal(${e.examId})">📝</button>
                        <button class="btn btn-danger btn-sm" style="padding:4px 8px; border:none; background:#fff; color:#ef4444;" onclick="deleteExam(${e.examId})">🗑️</button>
                    </div>
                </div>
            </div>`;
        });
    }
    structureList.innerHTML = html;
}

// DRAG & DROP LOGIC
let dragData = null;
function handleDragStart(e, type, id, title, level) {
    dragData = { type, id, title, level };
    e.dataTransfer.setData('text/plain', id);
    if(e.target) e.target.classList.add('dragging');
}
document.addEventListener('dragend', (e) => {
    if (e.target && e.target.classList) e.target.classList.remove('dragging');
    document.querySelectorAll('.drop-zone-active').forEach(z => z.classList.remove('drop-zone-active'));
});
function handleDragOver(e) {
    e.preventDefault();
    if(e.currentTarget) e.currentTarget.classList.add('drop-zone-active');
}
function handleDragLeave(e) {
    if (e.currentTarget) e.currentTarget.classList.remove('drop-zone-active');
}
async function handleMainDrop(e) {
    e.preventDefault();
    handleDragLeave(e);
    if (!dragData) return;
    if (dragData.type === 'module') {
        if (confirm('Gán chương "' + dragData.title + '" vào khóa học này?')) {
            try {
                await apiFetch(`/api/it/modules/${dragData.id}/link-to-course/${currentContentCourseId}`, {
                    method: 'POST'
                });
                showToast('Đã gán chương vào khóa học.'); 
                loadCourseContent();
                await loadDocumentLibrary();
            } catch (err) { showToast(err.message, 'error'); }
        }
    } else if (dragData.type === 'exam') {
        if (confirm('Gán Quiz "' + dragData.title + '" vào khóa học này?')) {
            try {
                const result = await apiFetch(`/api/it/exams/${dragData.id}/link-to-course/${currentContentCourseId}`, {
                    method: 'POST'
                });
                if (result.info) {
                    showToast(result.info, 'warning');
                } else {
                    showToast('Đã gán Quiz vào khóa học.'); 
                }
                loadCourseContent();
                await loadDocumentLibrary();
            } catch (err) { 
                showToast(err.message, 'error'); 
            }
        }
    } else if (dragData.type === 'lesson') {
        showToast('Kéo bài giảng vào chương cụ thể!', 'warning');
    }
    dragData = null;
}
async function handleModuleDrop(e, moduleId) {
    e.stopPropagation(); e.preventDefault();
    handleDragLeave(e);
    if (!dragData || dragData.type !== 'lesson') return;
    if (confirm('Gán bài giảng "' + dragData.title + '" vào chương này?')) {
        try {
            await apiFetch(`/api/it/lessons/${dragData.id}/link-to-module/${moduleId}`, {
                method: 'POST'
            });
            showToast('Đã gán bài giảng vào chương.'); 
            loadCourseContent();
            await loadDocumentLibrary();
        } catch (err) { showToast(err.message, 'error'); }
    }
    dragData = null;
}

function openModuleModal() {
    document.getElementById('moduleTitleInput').value = '';
    document.getElementById('moduleLevelInput').value = '';
    openModal('moduleModal');
}

async function submitModule() {
    const title = document.getElementById('moduleTitleInput').value;
    if (!title) { showToast('Nhập tên chương!', 'error'); return; }
    try {
        const level = parseInt(document.getElementById('moduleLevelInput').value) || null;
        await apiFetch(`/api/it/courses/${currentContentCourseId}/modules`, { method: 'POST', body: JSON.stringify({ title, level, sortOrder: currentCourseContentParams.modules.length }) });
        closeModal('moduleModal');
        showToast('Thêm chương thành công!');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) {
        showToast(e.message || 'Lỗi thêm chương', 'error');
    }
}

function openLessonModal(moduleId) {
    document.getElementById('lessonModuleId').value = moduleId;
    document.getElementById('lessonTitleInput').value = '';
    document.getElementById('lessonLevelInput').value = '';
    document.getElementById('lessonTypeInput').value = 'Video';
    document.getElementById('lessonVideoInput').value = '';
    document.getElementById('lessonLinkInput').value = '';
    document.getElementById('lessonFileInput').value = '';
    document.getElementById('lessonBodyInput').value = '';
    openModal('lessonModal');
}

async function submitLesson() {
    const moduleId = document.getElementById('lessonModuleId').value;
    const body = {
        title: document.getElementById('lessonTitleInput').value,
        level: parseInt(document.getElementById('lessonLevelInput').value) || null,
        contentType: document.getElementById('lessonTypeInput').value,
        videoUrl: document.getElementById('lessonVideoInput').value,
        contentBody: document.getElementById('lessonBodyInput').value
    };
    if (!body.title) { showToast('Nhập tên bài học!', 'error'); return; }
    try {
        const created = await apiFetch(`/api/it/modules/${moduleId}/lessons`, { method: 'POST', body: JSON.stringify(body) });
        const lessonId = created.id;
        await uploadLessonAssets(lessonId, 'lessonFileInput', 'lessonLinkInput');
        closeModal('lessonModal');
        showToast('Thêm bài học thành công!');
        await loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) {
        showToast(e.message || 'Lỗi tạo bài học', 'error');
    }
}

async function deleteLesson(lessonId) {
    if (!confirm('Xóa vĩnh viễn bài học này khỏi KHO TÀI LIỆU? Bạn không thể hoàn tác.')) return;
    try {
        await apiFetch(`/api/it/lessons/${lessonId}`, { method: 'DELETE' });
        showToast('Đã xóa vĩnh viễn khỏi kho', 'warning');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) {
        showToast(e.message || 'Lỗi xóa bài học', 'error');
    }
}

async function unlinkLesson(lessonId) {
    if (!confirm('Gỡ bài học này khỏi khóa học? (Vẫn giữ lại bài học trong KHO)')) return;
    try {
        await apiFetch(`/api/it/lessons/${lessonId}/unlink`, { method: 'POST' });
        showToast('Đã gỡ khỏi khóa học', 'info');
        loadCourseContent();
    } catch(e) {
        showToast(e.message || 'Lỗi gỡ bài học', 'error');
    }
}

async function unlinkModule(moduleId) {
    if (!confirm('Gỡ chương này khỏi khóa học? (Vẫn giữ lại chương trong KHO)')) return;
    try {
        await apiFetch(`/api/it/modules/${moduleId}/unlink`, { method: 'POST' });
        showToast('Đã gỡ chương khỏi khóa học', 'info');
        loadCourseContent();
    } catch(e) {
        showToast(e.message || 'Lỗi gỡ chương', 'error');
    }
}

function openEditLessonModal(lessonId) {
    const lesson = currentCourseContentParams.modules.flatMap(m => m.lessons || []).find(l => l.lessonId === lessonId)
        || documentLibraryData.lessons.find(l => l.lessonId === lessonId);
    if (!lesson) return;

    document.getElementById('editLessonId').value = lessonId;
    document.getElementById('editLessonTitleInput').value = lesson.title || '';
    document.getElementById('editLessonLevelInput').value = lesson.level || '';
    document.getElementById('editLessonTypeInput').value = lesson.contentType || 'Video';
    document.getElementById('editLessonVideoInput').value = lesson.videoUrl || '';
    document.getElementById('editLessonLinkInput').value = '';
    document.getElementById('editLessonFileInput').value = '';
    document.getElementById('editLessonBodyInput').value = lesson.contentBody || '';
    openModal('editLessonModal');
}

async function submitEditLesson() {
    const lessonId = document.getElementById('editLessonId').value;
    const body = {
        title: document.getElementById('editLessonTitleInput').value,
        level: parseInt(document.getElementById('editLessonLevelInput').value) || null,
        contentType: document.getElementById('editLessonTypeInput').value,
        videoUrl: document.getElementById('editLessonVideoInput').value,
        contentBody: document.getElementById('editLessonBodyInput').value
    };
    if (!body.title) { showToast('Nhập tên bài học!', 'error'); return; }

    try {
        await apiFetch(`/api/it/lessons/${lessonId}`, { method: 'PUT', body: JSON.stringify(body) });
        await uploadLessonAssets(lessonId, 'editLessonFileInput', 'editLessonLinkInput');
        closeModal('editLessonModal');
        showToast('Cập nhật bài học thành công!');
        await loadCourseContent();
        await loadDocumentLibrary();
        if (currentModuleId) renderModuleDetails(currentModuleId);
    } catch(e) {
        showToast(e.message || 'Lỗi cập nhật bài học', 'error');
    }
}

async function uploadLessonAssets(lessonId, fileInputId, linkInputId) {
    const fileInput = document.getElementById(fileInputId);
    const linkInput = document.getElementById(linkInputId);

    if (fileInput?.files?.length) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const res = await fetch(`/api/it/lessons/${lessonId}/attachments/upload`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.error || 'Upload file tài liệu thất bại.');
        }
    }

    if (linkInput?.value?.trim()) {
        await apiFetch(`/api/it/lessons/${lessonId}/attachments/link`, {
            method: 'POST',
            body: JSON.stringify({
                fileName: 'Link tài liệu',
                url: linkInput.value.trim()
            })
        });
    }
}

async function deleteAttachment(attachmentId) {
    if (!confirm('Bạn có chắc muốn bỏ tài liệu này?')) return;
    try {
        await apiFetch(`/api/it/attachments/${attachmentId}`, { method: 'DELETE' });
        await loadCourseContent();
        await loadDocumentLibrary();
        showToast('Đã bỏ tài liệu.', 'warning');
    } catch (e) {
        showToast(e.message || 'Lỗi xóa tài liệu', 'error');
    }
}

function openExamModal() {
    const title = document.getElementById('examTitleInput'); if (title) title.value = '';
    const level = document.getElementById('examLevelInput'); if (level) level.value = '';
    const duration = document.getElementById('examDurationInput'); if (duration) duration.value = 30;
    const pass = document.getElementById('examPassScoreInput'); if (pass) pass.value = 50;
    const max = document.getElementById('examMaxAttemptsInput'); if (max) max.value = '';
    const start = document.getElementById('scheduleStartTime'); if (start) start.value = '';
    const end = document.getElementById('scheduleEndTime'); if (end) end.value = '';
    
    const deptInput = document.getElementById('examTargetDeptInput');
    if (deptInput) {
        const deptOpts = '<option value="">-- Tất cả phòng ban --</option>' + departments.map(d => `<option value="${d.departmentId}">${d.departmentName}</option>`).join('');
        deptInput.innerHTML = deptOpts;
    }
    openModal('examModal');
}

async function submitExam() {
    const body = {
        examTitle: document.getElementById('examTitleInput')?.value,
        level: parseInt(document.getElementById('examLevelInput')?.value) || null,
        durationMinutes: parseInt(document.getElementById('examDurationInput')?.value) || 30,
        passScore: parseFloat(document.getElementById('examPassScoreInput')?.value) || 50,
        maxAttempts: parseInt(document.getElementById('examMaxAttemptsInput')?.value) || null,
        startDate: document.getElementById('scheduleStartTime')?.value || null,
        endDate: document.getElementById('scheduleEndTime')?.value || null,
        targetDepartmentId: parseInt(document.getElementById('examTargetDeptInput')?.value) || null
    };
    if (!body.examTitle) { showToast('Yêu cầu nhập tên bài kiểm tra!', 'error'); return; }
    try {
        const finalBody = { ...body, aiQuestions: lastGeneratedQuestions };
        await apiFetch(`/api/it/courses/${currentContentCourseId}/exams`, { method: 'POST', body: JSON.stringify(finalBody) });
        lastGeneratedQuestions = [];
        closeModal('examModal');
        showToast('Tạo bài kiểm tra thành công!');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) {
        showToast(e.message || 'Lỗi tạo bài kiểm tra', 'error');
    }
}

async function renderExamDetails(examId, title) {
    document.getElementById('contentEmptyState').style.display = 'none';
    const activeState = document.getElementById('contentActiveState');
    activeState.style.display = 'block';
    
    activeState.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8">Đang tải câu hỏi...</div>`;
    
    try {
        const questions = await apiFetch(`/api/it/exams/${examId}/questions`);
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
            <h2 style="margin:0; font-size:18px;">Quiz: ${title}</h2>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary btn-sm" onclick="openEditExamModal(${examId})">📝 Sửa</button>
                <button class="btn btn-danger btn-sm" onclick="deleteExam(${examId})">🗑️ Xóa</button>
                <button class="btn btn-primary btn-sm" onclick="openQuestionModal(${examId})">➕ Thêm Câu Hỏi</button>
            </div>
        </div>`;
        
        if (questions && questions.length > 0) {
            let qhtml = '<ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:15px;">';
            questions.forEach((q, idx) => {
                let optionsHtml = '';
                if(q.options) {
                    optionsHtml = '<div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:5px;">';
                    q.options.forEach(o => {
                        optionsHtml += `<div style="padding:4px 8px; border-radius:4px; font-size:13px; ${o.isCorrect ? 'background:#dcfce7;color:#166534;font-weight:bold;' : 'background:#f1f5f9;color:#475569;'}">${o.isCorrect ? '✔' : '⚪'} ${o.optionText}</div>`;
                    });
                    optionsHtml += '</div>';
                }
                qhtml += `<li style="padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; position:relative;">
                    <div style="font-weight:bold; color:#1e293b; margin-bottom:5px;">Câu ${idx+1}: <span style="font-weight:normal">${q.questionText}</span></div>
                    <div style="font-size:12px; color:#3b82f6; margin-bottom:5px;">Điểm: ${q.points}</div>
                    ${optionsHtml}
                    <button class="btn btn-danger btn-sm" style="position:absolute; top:10px; right:10px;" onclick="deleteQuestion(${examId}, ${q.questionId})">Xóa</button>
                </li>`;
            });
            qhtml += '</ul>';
            html += qhtml;
        } else {
            html += `<div style="text-align:center; padding:30px; background:#f8fafc; color:#94a3b8; border-radius:4px;">Chưa có câu hỏi nào. Bạn hãy nhấn Thêm.</div>`;
        }
        activeState.innerHTML = html;
    } catch(e) {
        activeState.innerHTML = `<div style="color:red">Lỗi: ${e.message}</div>`;
    }
}

function openQuestionModal(examId) {
    document.getElementById('questionExamId').value = examId;
    document.getElementById('qTextInput').value = '';
    document.getElementById('qPointsInput').value = '10';
    document.getElementById('qOpt1').value = '';
    document.getElementById('qOpt2').value = '';
    document.getElementById('qOpt3').value = '';
    document.getElementById('qOpt4').value = '';
    openModal('questionModal');
}

async function submitQuestion() {
    const examId = document.getElementById('questionExamId').value;
    const correctVal = document.querySelector('input[name="qCorrectOption"]:checked').value;
    const body = {
        questionText: document.getElementById('qTextInput').value,
        points: parseFloat(document.getElementById('qPointsInput').value) || 10,
        options: []
    };
    
    if (!body.questionText) { showToast('Yêu cầu nhập nội dung!', 'error'); return; }
    
    for (let i = 1; i <= 4; i++) {
        const text = document.getElementById('qOpt' + i).value;
        if (text.trim() !== "") {
            body.options.push({ optionText: text, isCorrect: (correctVal == i) });
        }
    }
    
    if (body.options.length < 2) { showToast('Yêu cầu ít nhất 2 đáp án!', 'error'); return; }
    
    try {
        await apiFetch(`/api/it/exams/${examId}/questions`, { method: 'POST', body: JSON.stringify(body) });
        closeModal('questionModal');
        showToast('Câu Hỏi đã được thêm!');
        renderExamDetails(examId, 'Loading...'); 
        setTimeout(() => loadCourseContent(), 500);
    } catch (e) {
        showToast(e.message || 'Lỗi thêm câu hỏi', 'error');
    }
}

async function suggestQuestionWithAI() {
    const context = document.getElementById('aiQuestionContext').value.trim();
    const btn = document.getElementById('btnSuggestQuestionAI');
    
    if (!context) {
        showToast('Vui lòng nhập chủ đề gợi ý!', 'warning');
        return;
    }

    try {
        if (btn) btn.disabled = true;
        showToast('AI đang soạn câu hỏi...', 'info');
        
        const result = await apiFetch('/api/it/generate-quiz-ai', {
            method: 'POST',
            body: JSON.stringify({ prompt: context })
        });

        if (result && result.questions && result.questions.length > 0) {
            const q = result.questions[0];
            document.getElementById('qTextInput').value = q.questionText;
            
            if (q.options && q.options.length >= 2) {
                for (let i = 1; i <= 4; i++) {
                    const optInput = document.getElementById('qOpt' + i);
                    const radio = document.querySelector(`input[name="qCorrectOption"][value="${i}"]`);
                    if (optInput) {
                        optInput.value = q.options[i-1] ? (typeof q.options[i-1] === 'string' ? q.options[i-1] : (q.options[i-1].optionText || '')) : '';
                    }
                    if (radio && i === ((q.correctOptionIndex || 0) + 1)) {
                        radio.checked = true;
                    }
                }
            }
            showToast('AI đã gợi ý xong!', 'success');
        } else {
            showToast('AI không trả về kết quả phù hợp.', 'warning');
        }
    } catch (e) {
        showToast('Lỗi AI: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function deleteQuestion(examId, questionId) {
    if (!confirm('Xóa câu hỏi này?')) return;
    try {
        await apiFetch(`/api/it/exams/${examId}/questions/${questionId}`, { method: 'DELETE' });
        showToast('Đã xóa', 'warning');
        renderExamDetails(examId, 'Loading...');
    } catch(e) {
        showToast(e.message || 'Lỗi xóa câu hỏi', 'error');
    }
}

const debouncedLoadUsers = debounce(() => loadUsers(1), 400);

// ============================================================
// CATEGORIES
// ============================================================
let loadedCategoriesList = [];
async function loadCategories() {
    try {
        const cats = await apiFetch('/api/it/categories');
        loadedCategoriesList = cats || [];
        document.getElementById('categoriesTable').innerHTML = loadedCategoriesList.map(c => `
            <tr>
                <td>${c.categoryId}</td>
                <td><strong>${c.categoryName}</strong></td>
                <td><span class="badge badge-info">${c.courseCount}</span></td>
                <td>${c.faqCount}</td>
                <td>${c.questionBankCount}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditCategoryModal(${c.categoryId})">📝</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.categoryId}, '${(c.categoryName||'').replace(/'/g,"\\'")}')" style="padding:6px">🗑️</button>
                </td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center">Chưa có danh mục nào</td></tr>';

        refreshCourseCategoryDropdown();
    } catch(e) {
        document.getElementById('categoriesTable').innerHTML = '<tr><td colspan="6" style="color:red">Lỗi tải dữ liệu</td></tr>';
    }
}

function openCreateCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = '➕ Thêm danh mục';
    document.getElementById('categoryModalId').value = '';
    document.getElementById('categoryModalName').value = '';
    const sel = document.getElementById('categoryModalDept');
    sel.innerHTML = '<option value="">-- Không có --</option>' + departments.map(d => `<option value="${d.departmentId}">${d.departmentName}</option>`).join('');
    openModal('categoryModal');
}

function openEditCategoryModal(id) {
    const c = loadedCategoriesList.find(x => x.categoryId == id);
    if (!c) return;
    document.getElementById('categoryModalTitle').textContent = '📝 Sửa danh mục';
    document.getElementById('categoryModalId').value = id;
    document.getElementById('categoryModalName').value = c.categoryName || '';
    const sel = document.getElementById('categoryModalDept');
    sel.innerHTML = '<option value="">-- Không có --</option>' + departments.map(d => `<option value="${d.departmentId}" ${d.departmentId == c.ownerDeptId ? 'selected' : ''}>${d.departmentName}</option>`).join('');
    openModal('categoryModal');
}

async function submitCategory() {
    const id = document.getElementById('categoryModalId').value;
    const body = {
        categoryName: document.getElementById('categoryModalName').value,
        ownerDeptId: parseInt(document.getElementById('categoryModalDept').value) || null
    };
    if (!body.categoryName) { showToast('Nhập tên danh mục!', 'error'); return; }
    try {
        if (id) {
            await apiFetch(`/api/it/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Cập nhật danh mục thành công!');
        } else {
            await apiFetch('/api/it/categories', { method: 'POST', body: JSON.stringify(body) });
            showToast('Thêm danh mục thành công!');
        }
        closeModal('categoryModal');
        loadCategories();
        refreshDepartmentsDropdown();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

async function deleteCategory(id, name) {
    if (!confirm(`Xóa danh mục "${name}"?`)) return;
    try {
        await apiFetch(`/api/it/categories/${id}`, { method: 'DELETE' });
        showToast('Đã xóa!', 'warning');
        loadCategories();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

// ============================================================
// FAQS
// ============================================================
let loadedFaqsList = [];
async function loadFaqs() {
    const search = document.getElementById('faqSearch')?.value || '';
    try {
        const faqs = await apiFetch(`/api/it/faqs?search=${encodeURIComponent(search)}`);
        loadedFaqsList = faqs || [];
        document.getElementById('faqsTable').innerHTML = loadedFaqsList.map(f => `
            <tr>
                <td style="max-width:280px"><strong>${f.question}</strong></td>
                <td style="max-width:300px;color:#475569;font-size:13px">${(f.answer||'').substring(0,120)}${f.answer && f.answer.length>120?'...':''}</td>
                <td><span class="badge badge-info">${f.categoryName}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditFaqModal(${f.faqId})">📝</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteFaq(${f.faqId})" style="padding:6px">🗑️</button>
                </td>
            </tr>`).join('') || '<tr><td colspan="4" style="text-align:center">Chưa có FAQ nào</td></tr>';
    } catch(e) {
        document.getElementById('faqsTable').innerHTML = '<tr><td colspan="4" style="color:red">Lỗi tải dữ liệu</td></tr>';
    }
}
const debouncedLoadFaqs = debounce(() => loadFaqs(), 400);

async function openCreateFaqModal() {
    document.getElementById('faqModalTitle').textContent = '➕ Thêm FAQ';
    document.getElementById('faqModalId').value = '';
    document.getElementById('faqModalQ').value = '';
    document.getElementById('faqModalA').value = '';
    await refreshFaqCatDropdown();
    openModal('faqModal');
}

async function openEditFaqModal(id) {
    const f = loadedFaqsList.find(x => x.faqId == id);
    if (!f) return;
    document.getElementById('faqModalTitle').textContent = '📝 Sửa FAQ';
    document.getElementById('faqModalId').value = id;
    document.getElementById('faqModalQ').value = f.question || '';
    document.getElementById('faqModalA').value = f.answer || '';
    await refreshFaqCatDropdown(f.categoryId);
    openModal('faqModal');
}

async function refreshFaqCatDropdown(selectedId) {
    try {
        if (!loadedCategoriesList.length) await loadCategories();
        const opts = '<option value="">-- Chọn danh mục --</option>' + loadedCategoriesList.map(c =>
            `<option value="${c.categoryId}" ${c.categoryId == selectedId ? 'selected' : ''}>${c.categoryName}</option>`).join('');
        document.getElementById('faqModalCat').innerHTML = opts;
    } catch(e) { }
}

async function submitFaq() {
    const id = document.getElementById('faqModalId').value;
    const body = {
        question: document.getElementById('faqModalQ').value,
        answer: document.getElementById('faqModalA').value,
        categoryId: parseInt(document.getElementById('faqModalCat').value) || null
    };
    if (!body.question) { showToast('Nhập câu hỏi!', 'error'); return; }
    try {
        if (id) {
            await apiFetch(`/api/it/faqs/${id}`, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Cập nhật FAQ thành công!');
        } else {
            await apiFetch('/api/it/faqs', { method: 'POST', body: JSON.stringify(body) });
            showToast('Thêm FAQ thành công!');
        }
        closeModal('faqModal');
        loadFaqs();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

async function deleteFaq(id) {
    if (!confirm('Xóa FAQ này?')) return;
    try {
        await apiFetch(`/api/it/faqs/${id}`, { method: 'DELETE' });
        showToast('Đã xóa!', 'warning');
        loadFaqs();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

// ============================================================
// ANALYTICS
// ============================================================
let analyticsCharts = {};
async function loadAnalytics() {
    try {
        const data = await apiFetch('/api/it/analytics');

        if (data.userByDept && data.userByDept.length) {
            const ctx1 = document.getElementById('deptChart').getContext('2d');
            if (analyticsCharts.dept) analyticsCharts.dept.destroy();
            analyticsCharts.dept = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: data.userByDept.map(d => d.department),
                    datasets: [{ label: 'Nhân viên', data: data.userByDept.map(d => d.userCount),
                        backgroundColor: '#3b82f6', borderRadius: 6 }]
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }

        if (data.courseByCategory && data.courseByCategory.length) {
            const ctx2 = document.getElementById('catChart').getContext('2d');
            if (analyticsCharts.cat) analyticsCharts.cat.destroy();
            analyticsCharts.cat = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: data.courseByCategory.map(c => c.category),
                    datasets: [{ data: data.courseByCategory.map(c => c.courseCount),
                        backgroundColor: ['#3b82f6','#10b981','#f59e0b','#6366f1','#ef4444','#06b6d4'] }]
                },
                options: { plugins: { legend: { position: 'right' } } }
            });
        }

        if (data.enrollmentByMonth && data.enrollmentByMonth.length) {
            const ctx3 = document.getElementById('enrollChart').getContext('2d');
            if (analyticsCharts.enroll) analyticsCharts.enroll.destroy();
            analyticsCharts.enroll = new Chart(ctx3, {
                type: 'line',
                data: {
                    labels: data.enrollmentByMonth.map(e => `${e.month}/${e.year}`),
                    datasets: [{ label: 'Lượt đăng ký', data: data.enrollmentByMonth.map(e => e.count),
                        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4 }]
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        }

        const es = data.examStats;
        if (es && es.total > 0) {
            const ctx4 = document.getElementById('examChart').getContext('2d');
            if (analyticsCharts.exam) analyticsCharts.exam.destroy();
            analyticsCharts.exam = new Chart(ctx4, {
                type: 'doughnut',
                data: {
                    labels: ['Đạt', 'Không đạt'],
                    datasets: [{ data: [es.passed, es.failed], backgroundColor: ['#10b981', '#ef4444'] }]
                },
                options: { plugins: { legend: { position: 'bottom' } } }
            });
            document.getElementById('examStatText').textContent = `Tỉ lệ pass: ${es.passRate}% (${es.passed}/${es.total} lượt thi)`;
        } else {
            document.getElementById('examStatText').textContent = 'Chưa có dữ liệu thi';
        }

        document.getElementById('topCoursesTable').innerHTML = (data.topCourses || []).map((c, i) =>
            `<tr><td><strong>#${i+1}</strong></td><td>${c.title}</td><td><span class="badge badge-info">${c.enrollments} học viên</span></td></tr>`
        ).join('') || '<tr><td colspan="3" style="text-align:center">Chưa có dữ liệu</td></tr>';
    } catch(e) { showToast('Lỗi tải analytics: ' + e.message, 'error'); }
}

async function loadSchedules() {
    try {
        const data = await apiFetch('/api/it/schedules');
        loadedSchedules = data.schedules || [];
        scheduleCourseOptions = data.courseOptions || [];
        const courseSelect = document.getElementById('scheduleCourseInput');
        if (courseSelect) {
            courseSelect.innerHTML = '<option value="">-- Chọn khóa học --</option>' + scheduleCourseOptions.map(c => `<option value="${c.courseId}">${c.title}</option>`).join('');
        }
        const now = new Date();
        const upcoming = loadedSchedules.filter(s => s.startTime && new Date(s.startTime) >= now);
        document.getElementById('scheduleStats').innerHTML = `
            <div class="stat-card blue"><div class="stat-icon blue">🗓️</div><div class="stat-value">${loadedSchedules.length}</div><div class="stat-label">Tổng lịch học</div></div>
            <div class="stat-card cyan"><div class="stat-icon cyan">⌛</div><div class="stat-value">${upcoming.length}</div><div class="stat-label">Sắp diễn ra</div></div>
            <div class="stat-card green"><div class="stat-icon green">👥</div><div class="stat-value">${loadedSchedules.reduce((sum, s) => sum + (s.currentParticipants || 0), 0)}</div><div class="stat-label">Lượt đăng ký</div></div>
            <div class="stat-card orange"><div class="stat-icon orange">📍</div><div class="stat-value">${new Set(loadedSchedules.map(s => s.location || 'Chưa rõ')).size}</div><div class="stat-label">Địa điểm</div></div>
        `;
        document.getElementById('scheduleCards').innerHTML = upcoming.slice(0, 8).map(s => `
            <div class="permission-tile" style="min-height:auto">
                <div class="permission-tile-key">${s.title || s.courseTitle}</div>
                <div class="permission-tile-desc">${s.courseTitle || 'N/A'} • ${s.location || 'Chưa có địa điểm'}</div>
                <div style="margin-top:10px;font-size:12px;color:#475569">${fmtDateTime(s.startTime)} - ${fmtDateTime(s.endTime)}</div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                    <span class="badge badge-info">${s.instructor || 'Chưa phân công'}</span>
                    <span class="badge badge-green">${fmtNumber(s.currentParticipants || 0)}/${fmtNumber(s.maxParticipants || 0)}</span>
                </div>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button class="btn btn-secondary btn-sm" onclick="openScheduleModal(${s.eventId})">Sửa</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.eventId})">Xóa</button>
                </div>
            </div>
        `).join('') || '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🗓️</div><div class="empty-title">Chưa có lịch học sắp tới</div><div class="empty-desc">Thêm lịch học mới để hiển thị ở đây.</div></div>';
        document.getElementById('scheduleTable').innerHTML = loadedSchedules.map(s => `
            <tr>
                <td><strong>${s.title || s.courseTitle}</strong><div style="font-size:12px;color:#64748b">${s.notes || 'Không có ghi chú'}</div></td>
                <td>${s.courseTitle || 'N/A'}</td>
                <td><div style="display:grid;gap:4px"><span>${fmtDateTime(s.startTime)}</span><span style="color:#64748b">${fmtDateTime(s.endTime)}</span></div></td>
                <td>${s.location || '—'}</td>
                <td>${s.instructor || '<span style="color:#94a3b8">Chưa có</span>'}</td>
                <td>${fmtNumber(s.currentParticipants || 0)} / ${fmtNumber(s.maxParticipants || 0)}</td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button class="btn btn-secondary btn-sm" onclick="openScheduleModal(${s.eventId})">📝</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.eventId})">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center;color:#94a3b8">Chưa có lịch học nào</td></tr>';
    } catch (e) {
        showToast(e.message || 'Lỗi tải lịch học', 'error');
    }
}

function toDateTimeLocal(value) {
    if (!value) return '';
    const d = new Date(value);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

function openScheduleModal(id) {
    const item = loadedSchedules.find(s => s.eventId === id);
    document.getElementById('scheduleModalTitle').textContent = item ? 'Sửa lịch học' : 'Thêm lịch học';
    document.getElementById('scheduleId').value = item?.eventId || '';
    document.getElementById('scheduleTitleInput').value = item?.title || '';
    document.getElementById('scheduleCourseInput').value = item?.courseId || '';
    document.getElementById('scheduleInstructorInput').value = item?.instructor || '';
    document.getElementById('scheduleLocationInput').value = item?.location || '';
    document.getElementById('scheduleStartInput').value = toDateTimeLocal(item?.startTime);
    document.getElementById('scheduleEndInput').value = toDateTimeLocal(item?.endTime);
    document.getElementById('scheduleMaxInput').value = item?.maxParticipants || '';
    document.getElementById('scheduleNotesInput').value = item?.notes || '';
    openModal('scheduleModal');
}

async function submitSchedule() {
    const id = document.getElementById('scheduleId').value;
    const body = {
        title: document.getElementById('scheduleTitleInput').value,
        courseId: parseInt(document.getElementById('scheduleCourseInput').value) || 0,
        instructor: document.getElementById('scheduleInstructorInput').value,
        location: document.getElementById('scheduleLocationInput').value,
        startTime: document.getElementById('scheduleStartInput').value || null,
        endTime: document.getElementById('scheduleEndInput').value || null,
        maxParticipants: parseInt(document.getElementById('scheduleMaxInput').value) || null,
        notes: document.getElementById('scheduleNotesInput').value
    };

    try {
        await apiFetch(id ? `/api/it/schedules/${id}` : '/api/it/schedules', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(body)
        });
        closeModal('scheduleModal');
        showToast(id ? 'Đã cập nhật lịch học.' : 'Đã tạo lịch học.', 'success');
        loadSchedules();
    } catch (e) {
        showToast(e.message || 'Lỗi lưu lịch học', 'error');
    }
}

async function deleteSchedule(id) {
    if (!confirm('Bạn có chắc muốn xóa lịch học này?')) return;
    try {
        await apiFetch(`/api/it/schedules/${id}`, { method: 'DELETE' });
        showToast('Đã xóa lịch học.', 'warning');
        loadSchedules();
    } catch (e) {
        showToast(e.message || 'Lỗi xóa lịch học', 'error');
    }
}

// ============================================================
// BACKUP
// ============================================================
async function loadBackupLogs() {
    try {
        const logs = await apiFetch('/api/it/backuplogs');
        document.getElementById('backupLogsTable').innerHTML = (logs || []).map(b => `
            <tr>
                <td>${b.backupId}</td>
                <td><code style="font-size:12px">${b.fileName}</code></td>
                <td><span class="badge ${b.backupType==='Full'?'badge-info':b.backupType==='Incremental'?'badge-purple':'badge-green'}">${b.backupType}</span></td>
                <td>${fmtDateTime(b.createdAt)}</td>
            </tr>`).join('') || '<tr><td colspan="4" style="text-align:center">Chưa có bản backup nào</td></tr>';
    } catch(e) {
        showToast('Lỗi tải backup logs', 'error');
    }
}

async function createBackup() {
    const backupType = document.getElementById('backupTypeSelect').value;
    const msgEl = document.getElementById('backupMsg');
    msgEl.textContent = '⌛ Đang tạo backup...';
    try {
        const res = await apiFetch('/api/it/backuplogs', { method: 'POST', body: JSON.stringify({ backupType }) });
        msgEl.textContent = `✅ Backup thành công! File: ${res.fileName}`;
        showToast('Tạo backup thành công!', 'success');
        loadBackupLogs();
    } catch(e) {
        msgEl.textContent = '❌ Lỗi: ' + e.message;
        showToast('Lỗi tạo backup: ' + e.message, 'error');
    }
}

// ============================================================
// PERMISSIONS
// ============================================================
async function loadPermissions() {
    try {
        await Promise.all([refreshRoles(), refreshPermissionUsers()]);
        onPermissionTargetTypeChange();
        await loadPermissionBoard();
    } catch(e) {
        showToast('Lỗi tải dữ liệu quyền', 'error');
    }
}

function openPermissionModal() {
    showToast('Màn hình phân quyền mới đang dùng bảng chọn ở phía trên.', 'info');
}

function submitPermissionRoles() {
    closeModal('permissionModal');
    showToast('Vui lòng dùng bảng phân quyền mới để bật/tắt chức năng.', 'info');
}

function onPermissionTargetTypeChange() {
    const type = document.getElementById('permissionTargetType').value;
    currentPermissionTarget.type = type;
    document.getElementById('permissionRoleWrap').style.display = type === 'role' ? '' : 'none';
    document.getElementById('permissionUserWrap').style.display = type === 'user' ? '' : 'none';
    currentPermissionTarget.id = parseInt(document.getElementById(type === 'role' ? 'permissionRoleTarget' : 'permissionUserTarget').value) || null;
}

async function loadPermissionBoard() {
    const type = document.getElementById('permissionTargetType').value;
    const targetId = parseInt(document.getElementById(type === 'role' ? 'permissionRoleTarget' : 'permissionUserTarget').value) || null;
    currentPermissionTarget = { type, id: targetId };
    if (!targetId) return;

    try {
        const data = await apiFetch(type === 'role'
            ? `/api/it/roles/${targetId}/permissions`
            : `/api/it/users/${targetId}/permissions`);
        activePermissionBoard = data.permissions || [];
        renderPermissionBoard(activePermissionBoard);

        const enabledCount = activePermissionBoard.filter(p => p.enabled).length;
        const roleLine = type === 'user' && data.roleNames?.length ? ` • Role hiện có: ${data.roleNames.join(', ')}` : '';
        document.getElementById('permissionBoardTitle').textContent =
            `${type === 'role' ? 'Role' : 'Người dùng'}: ${data.targetName || '--'} • ${enabledCount}/${activePermissionBoard.length} chức năng bật${roleLine}`;
        
    } catch(e) {
        showToast(e.message || 'Lỗi tải quyền', 'error');
    }
}

function renderPermissionBoard(permissions) {
    const board = document.getElementById('permissionsBoard');
    if (!permissions.length) {
        board.innerHTML = '<div style="padding:48px;color:#94a3b8;text-align:center">Chưa có chức năng nào định nghĩa trong catalog.</div>';
        return;
    }

    const groups = permissions.reduce((acc, item) => {
        const key = item.category || 'Khác';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const sortedCats = Object.keys(groups).sort();

    board.innerHTML = sortedCats.map(cat => `
        <div class="permission-category-group" data-category="${cat}">
            <div class="permission-category-header">
                <i>${(permissionVisualMap[(groups[cat][0]?.permissionKey)]?.icon) || '📂'}</i>
                <span class="permission-category-title">${cat}</span>
            </div>
            <div class="permission-category-content">
                ${groups[cat].map(p => {
                    const isInherited = p.source === 'role' || p.source === 'role+user';
                    const visual = permissionVisualMap[p.permissionKey] || { icon: '✨', accent: '#2563eb' };
                    return `
                        <div class="permission-item ${!p.isFunctional ? 'non-functional' : ''}" data-key="${p.permissionKey}" data-desc="${p.description}">
                            <div class="permission-info">
                                <div class="permission-name">
                                    <span style="color:${visual.accent}">${visual.icon}</span>
                                    <span>${p.description || p.permissionKey}</span>
                                    ${p.isFunctional ? '' : '<span class="badge badge-gray" style="font-size:9px;margin-left:4px">Bảo trì</span>'}
                                </div>
                                <div class="permission-desc">${p.permissionKey} • ${p.description || 'Chức năng hệ thống'}</div>
                            </div>
                            <div class="permission-meta">
                                ${isInherited ? `<span class="permission-badge-inherited">Kế thừa từ Role</span>` : ''}
                                <label class="lms-switch">
                                    <input type="checkbox" ${p.enabled ? 'checked' : ''} 
                                           ${(isInherited && currentPermissionTarget.type === 'user') ? 'disabled' : ''}
                                           onchange="togglePermission(${p.permissionId}, this.checked, '${p.source}')">
                                    <span class="lms-slider"></span>
                                </label>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function filterPermissions() {
    const q = document.getElementById('permissionSearch').value.toLowerCase();
    const items = document.querySelectorAll('.permission-item');
    let visibleCount = 0;

    items.forEach(item => {
        const key = item.getAttribute('data-key').toLowerCase();
        const desc = item.getAttribute('data-desc').toLowerCase();
        const matches = key.includes(q) || desc.includes(q);
        item.style.display = matches ? 'flex' : 'none';
        if (matches) visibleCount++;
    });

    // Hide categories that have no visible children
    document.querySelectorAll('.permission-category-group').forEach(group => {
        const visibleItems = group.querySelectorAll('.permission-item[style="display: flex;"]');
        group.style.display = visibleItems.length ? 'block' : 'none';
    });
}

async function togglePermission(permissionId, shouldEnable, source) {
    if (!currentPermissionTarget.id) return;
    
    // User level block for inherited permissions
    if (currentPermissionTarget.type === 'user' && (source === 'role' || source === 'role+user')) {
        showToast('Quyền này đang kế thừa từ role. Hãy tắt ở phân quyền role nếu muốn bỏ.', 'warning');
        loadPermissionBoard(); // Revert switch UI
        return;
    }

    const url = currentPermissionTarget.type === 'role'
        ? `/api/it/roles/${currentPermissionTarget.id}/permissions/${permissionId}/toggle`
        : `/api/it/users/${currentPermissionTarget.id}/permissions/${permissionId}/toggle`;

    try {
        const res = await apiFetch(url, { method: 'POST' });
        // After toggle, we reload but we can also optimistically update
        showToast(shouldEnable ? 'Đã bật chức năng.' : 'Đã tắt chức năng.', 'success');
        refreshMyPermissionProfile();
        
        // Update local state and re-render header info without redrawing everything immediately if possible
        // But for simplicity and consistency with inheritance logic, we reload board
        setTimeout(() => loadPermissionBoard(), 300);
    } catch (e) {
        showToast(e.message || 'Lỗi cập nhật quyền', 'error');
        loadPermissionBoard(); // Revert switch UI
    }
}

// ============================================================
// NEWSLETTER
// ============================================================
async function loadNewsletter() {
    try {
        const data = await apiFetch('/api/it/newsletter');
        const subs = data.subscriptions || [];

        document.getElementById('newsletterStats').innerHTML = `
            <div class="stat-card blue"><div class="stat-icon blue">📬</div><div class="stat-value">${data.total}</div><div class="stat-label">Tổng đăng ký</div></div>
            <div class="stat-card green"><div class="stat-icon green">✅</div><div class="stat-value">${data.subscribed}</div><div class="stat-label">Đang đăng ký</div></div>
            <div class="stat-card red" style="--card-accent:#ef4444"><div class="stat-icon" style="background:rgba(239,68,68,.12);color:#ef4444">🚫</div><div class="stat-value">${data.unsubscribed}</div><div class="stat-label">Đã huỷ</div></div>
        `;

        document.getElementById('newsletterTable').innerHTML = subs.map(s => `
            <tr>
                <td><strong>${s.fullName}</strong></td>
                <td>${s.email || '—'}</td>
                <td>${s.isSubscribed ? '<span class="badge badge-green">Đang đăng ký</span>' : '<span class="badge" style="background:#fef2f2;color:#ef4444">Đã huỷ</span>'}</td>
                <td>
                    <button class="btn btn-sm ${s.isSubscribed?'btn-danger':'btn-primary'}" onclick="toggleNewsletter(${s.subId}, ${!s.isSubscribed})">
                        ${s.isSubscribed ? '🚫 Huỷ' : '✅ Kích hoạt'}
                    </button>
                </td>
            </tr>`).join('') || '<tr><td colspan="4" style="text-align:center">Chưa có đăng ký nào</td></tr>';
    } catch(e) {
        showToast('Lỗi tải dữ liệu newsletter', 'error');
    }
}

async function toggleNewsletter(subId, newStatus) {
    try {
        await apiFetch(`/api/it/newsletter/${subId}`, { method: 'PUT', body: JSON.stringify({ isSubscribed: newStatus }) });
        showToast(newStatus ? 'Đã kích hoạt!' : 'Đã huỷ đăng ký!', 'success');
        loadNewsletter();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

async function loadSettings() {
    try {
        loadedSettings = await apiFetch('/api/it/settings');
        document.getElementById('settingsTable').innerHTML = (loadedSettings || []).map(s => `
            <tr>
                <td><code>${s.settingKey}</code></td>
                <td style="max-width:420px">${(s.settingValue || '').substring(0, 140)}${s.settingValue && s.settingValue.length > 140 ? '...' : ''}</td>
                <td>${s.modifiedAt ? fmtDateTime(s.modifiedAt) : '—'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openSettingModal('${(s.settingKey || '').replace(/'/g, "\\'")}')">📝</button></td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center">Chưa có cài đặt nào</td></tr>';
    } catch(e) {
        showToast('Lỗi tải cài đặt', 'error');
    }
}

function openSettingModal(settingKey) {
    const setting = loadedSettings.find(s => s.settingKey === settingKey);
    if (!setting) return;

    document.getElementById('settingModalKey').value = setting.settingKey;
    document.getElementById('settingModalLabel').value = setting.settingKey;
    document.getElementById('settingModalValue').value = setting.settingValue || '';
    openModal('settingModal');
}

async function submitSetting() {
    const key = document.getElementById('settingModalKey').value;
    const value = document.getElementById('settingModalValue').value;
    try {
        await apiFetch(`/api/it/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(value) });
        closeModal('settingModal');
        showToast('Lưu cài đặt thành công!');
        loadSettings();
    } catch(e) {
        showToast(e.message || 'Lỗi cập nhật cài đặt', 'error');
    }
}

// ============================================================
// EXAM QUESTION MANAGEMENT (MULTI-BUILDER)
// ============================================================
let currentExamQuestions = [];

async function openExamQuestionsManagementModal(examId) {
    document.getElementById('qMgmtExamId').value = examId;
    const container = document.getElementById('questionsListContainer');
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><span class="spinner-small"></span> Đang tải câu hỏi...</div>';
    
    const quiz = documentLibraryData.exams.find(e => e.examId === examId);
    if (quiz) {
        document.getElementById('qMgmtTitle').textContent = `Quản lý câu hỏi: ${quiz.examTitle}`;
    }

    openModal('examQuestionsManagementModal');

    try {
        const questions = await apiFetch(`/api/it/exams/${examId}/questions`);
        currentExamQuestions = questions || [];
        renderQuestionRows();
    } catch (e) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Lỗi: ${e.message}</div>`;
    }
}

function renderQuestionRows() {
    const container = document.getElementById('questionsListContainer');
    container.innerHTML = '';
    
    if (currentExamQuestions.length === 0) {
        addNewQuestionUI();
        return;
    }

    currentExamQuestions.forEach((q, idx) => {
        addNewQuestionUI(q, idx + 1);
    });
    
    updateNextQuestionNum();
}

function addNewQuestionUI(data = null, index = null) {
    const container = document.getElementById('questionsListContainer');
    const idx = index || (container.querySelectorAll('.question-row-item').length + 1);
    
    const div = document.createElement('div');
    div.className = 'question-row-item';
    div.style = 'background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:18px; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.02);';
    
    const questionText = data ? data.questionText : '';
    const points = data ? data.points : 10;
    const options = data ? data.options : [
        { optionText: '', isCorrect: true },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false }
    ];

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
            <div style="font-weight:bold; color:#1e293b; font-size:15px;">Câu ${idx}</div>
            <button class="btn btn-danger btn-sm" onclick="this.closest('.question-row-item').remove(); updateNextQuestionNum(); redistributePoints();" style="padding:4px 8px; font-size:11px;">🗑️ Loại bỏ</button>
        </div>
        <div class="form-group" style="margin-bottom:12px;">
            <input type="text" class="form-input q-text" placeholder="Nhập nội dung câu hỏi..." value="${libraryEscape(questionText)}">
        </div>
        <div class="grid-2" style="gap:10px;">
            ${options.map((opt, i) => `
                <div style="display:flex; align-items:center; gap:8px; background:#f8fafc; padding:8px; border-radius:6px; border:1px solid #f1f5f9;">
                    <input type="radio" name="correct_${idx}" class="q-correct" value="${i}" ${opt.isCorrect ? 'checked' : ''}>
                    <input type="text" class="form-input q-opt" style="border:none; background:transparent; padding:4px;" placeholder="Đáp án ${i+1}" value="${libraryEscape(opt.optionText)}">
                </div>
            `).join('')}
        </div>
        <div style="margin-top:10px; display:flex; justify-content:flex-end;">
            <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:12px; color:#64748b;">Điểm:</label>
                <input type="number" class="form-input q-points" style="width:60px; padding:4px;" value="${points}">
            </div>
        </div>
    `;
    
    container.appendChild(div);
    updateNextQuestionNum();
    
    // Tự động chia lại điểm khi thêm mới
    redistributePoints();
}

function redistributePoints() {
    const examId = parseInt(document.getElementById('qMgmtExamId').value);
    const quiz = documentLibraryData.exams.find(e => e.examId === examId);
    if (!quiz) return;
    
    const rows = document.querySelectorAll('.question-row-item');
    if (rows.length === 0) return;
    
    // Chỉ chia đều khi chưa có điểm được sửa tay hoặc khi thêm/xóa câu
    const totalTarget = quiz.passScore || 50;
    const avg = Math.floor(totalTarget / rows.length);
    const remainder = totalTarget % rows.length;
    
    rows.forEach((row, i) => {
        const input = row.querySelector('.q-points');
        // Chia đều, câu cuối cùng nhận phần dư để đảm bảo tổng luôn khớp
        input.value = (i === rows.length - 1) ? (avg + remainder) : avg;
    });
}

function updateNextQuestionNum() {
    const container = document.getElementById('questionsListContainer');
    const count = container.querySelectorAll('.question-row-item').length;
    document.getElementById('nextQuestionNum').textContent = count + 1;
}

async function saveExamQuestionsBatch() {
    const examId = document.getElementById('qMgmtExamId').value;
    const container = document.getElementById('questionsListContainer');
    const rows = container.querySelectorAll('.question-row-item');
    const statusEl = document.getElementById('qMgmtStatus');
    
    const questions = [];
    let hasError = false;

    let totalPoints = 0;
    rows.forEach((row, idx) => {
        const text = row.querySelector('.q-text').value.trim();
        const points = parseFloat(row.querySelector('.q-points').value) || 0;
        totalPoints += points;
        const optsEls = row.querySelectorAll('.q-opt');
        const correctIdx = parseInt(row.querySelector('.q-correct:checked')?.value || '0');
        
        const options = [];
        optsEls.forEach((optEl, i) => {
            const optText = optEl.value.trim();
            if (optText) {
                options.push({ optionText: optText, isCorrect: i === correctIdx });
            }
        });

        if (!text) {
            showToast(`Câu ${idx+1} chưa có nội dung!`, 'error');
            hasError = true;
            return;
        }
        if (options.length < 2) {
            showToast(`Câu ${idx+1} cần ít nhất 2 đáp án!`, 'error');
            hasError = true;
            return;
        }

        questions.push({ questionText: text, points, options });
    });

    const quiz = documentLibraryData.exams.find(e => e.examId === parseInt(examId));
    const maxAllowed = quiz ? quiz.passScore : 100;
    if (totalPoints > maxAllowed) {
        showToast(`Tổng điểm (${totalPoints}) không được vượt quá Điểm đỗ quy định (${maxAllowed})!`, 'error');
        hasError = true;
    }

    if (hasError) return;
    if (questions.length === 0) {
        showToast('Vui lòng thêm ít nhất 1 câu hỏi!', 'warning');
        return;
    }

    try {
        statusEl.innerHTML = '<span class="spinner-small"></span> Đang lưu...';
        
        // We need a Batch API, but if it doesn't exist, we iterate. 
        // Given the existing code, I'll see if I can add a batch endpoint or just use single ones.
        // For now, I'll use the single one in a loop for compatibility, 
        // effectively replacing the existing implementation which likely wipes them first if we had a batch API.
        
        // Step 1: Delete all old questions for this exam (simplified approach for this UI)
        // Note: Real production should have a proper batch sync endpoint.
        
        // For this task, I will assume we add them. 
        // To strictly follow "Saving", I'll delete existing and add new.
        
        const existing = await apiFetch(`/api/it/exams/${examId}/questions`);
        for (const q of (existing || [])) {
            await apiFetch(`/api/it/exams/${examId}/questions/${q.questionId}`, { method: 'DELETE' });
        }

        for (const q of questions) {
            await apiFetch(`/api/it/exams/${examId}/questions`, {
                method: 'POST',
                body: JSON.stringify(q)
            });
        }

        showToast('Đã lưu tất cả câu hỏi thành công!', 'success');
        closeModal('examQuestionsManagementModal');
        await loadDocumentLibrary();
        renderDocumentLibrary();
    } catch (e) {
        showToast('Lỗi khi lưu câu hỏi: ' + e.message, 'error');
        statusEl.innerHTML = '<span style="color:#ef4444">Lỗi lưu dữ liệu.</span>';
    } finally {
        statusEl.innerHTML = '';
    }
}

async function suggestMultipleQuestionsAI(examIdOverride = null) {
    const examId = examIdOverride || document.getElementById('qMgmtExamId').value;
    const quiz = documentLibraryData.exams.find(e => e.examId == examId);
    if (!quiz) return;

    const prompt = prompt(`Bạn muốn AI thiết kế bộ câu hỏi về chủ đề gì?\n(Ví dụ: 5 câu hỏi trắc nghiệm về ${quiz.examTitle})`, `5 câu hỏi trắc nghiệm về ${quiz.examTitle}`);
    if (!prompt) return;

    const btn = document.getElementById('btnGenerateMultiAI');
    if (btn) btn.disabled = true;
    showToast('AI đang soạn thảo bộ câu hỏi...', 'info');

    try {
        const result = await apiFetch('/api/it/generate-quiz-ai', {
            method: 'POST',
            body: JSON.stringify({ prompt })
        });

        if (result && result.questions && result.questions.length > 0) {
            if (examIdOverride) {
                // If called from table row, open modal first
                await openExamQuestionsManagementModal(examId);
            }
            
            // Append generated questions
            result.questions.forEach(q => {
                addNewQuestionUI(q);
            });
            showToast(`AI đã soạn thảo xong ${result.questions.length} câu hỏi! Hãy kiểm tra và nhấn Lưu.`, 'success');
        } else {
            showToast('AI không trả về kết quả phù hợp.', 'warning');
        }
    } catch (e) {
        showToast('Lỗi AI: ' + e.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function submitEditModule() {
    const id = document.getElementById('editModuleId').value;
    const title = document.getElementById('editModuleTitleInput').value;
    const level = parseInt(document.getElementById('editModuleLevelInput').value) || null;
    if (!title) { showToast('Nhập tên chương!', 'error'); return; }
    try {
        await apiFetch(`/api/it/modules/${id}`, { method: 'PUT', body: JSON.stringify({ title, level }) });
        closeModal('editModuleModal');
        showToast('Sửa chương thành công!');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

async function deleteModule(moduleId) {
    if (!confirm('Xóa chương này và toàn bộ bài học bên trong?')) return;
    try {
        await apiFetch(`/api/it/modules/${moduleId}`, { method: 'DELETE' });
        showToast('Đã xóa chương!', 'warning');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

// ============================================================
// EXAM - EDIT & DELETE
// ============================================================
function openEditExamModal(examId) {
    const exam = currentCourseContentParams.exams.find(e => e.examId === examId)
        || documentLibraryData.exams.find(e => e.examId === examId);
    if (!exam) return;
    document.getElementById('editExamId').value = examId;
    document.getElementById('editExamTitleInput').value = exam.examTitle || '';
    document.getElementById('editExamLevelInput').value = exam.level || '';
    document.getElementById('editExamDurationInput').value = exam.durationMinutes || 30;
    document.getElementById('editExamPassScoreInput').value = exam.passScore || 50;
    document.getElementById('editExamMaxAttemptsInput').value = exam.maxAttempts || '';
    document.getElementById('editExamStartDateInput').value = exam.startDate ? exam.startDate.substring(0, 10) : '';
    document.getElementById('editExamEndDateInput').value = exam.endDate ? exam.endDate.substring(0, 10) : '';
    const deptOpts = '<option value="">-- Tất cả phòng ban --</option>' + departments.map(d => `<option value="${d.departmentId}" ${d.departmentId == exam.targetDepartmentId ? 'selected' : ''}>${d.departmentName}</option>`).join('');
    document.getElementById('editExamTargetDeptInput').innerHTML = deptOpts;
    openModal('editExamModal');
}

async function submitEditExam() {
    const id = document.getElementById('editExamId').value;
    const body = {
        examTitle: document.getElementById('editExamTitleInput').value,
        level: parseInt(document.getElementById('editExamLevelInput').value) || null,
        durationMinutes: parseInt(document.getElementById('editExamDurationInput').value) || 30,
        passScore: parseFloat(document.getElementById('editExamPassScoreInput').value) || 50,
        maxAttempts: parseInt(document.getElementById('editExamMaxAttemptsInput').value) || null,
        startDate: document.getElementById('editExamStartDateInput').value || null,
        endDate: document.getElementById('editExamEndDateInput').value || null,
        targetDepartmentId: parseInt(document.getElementById('editExamTargetDeptInput').value) || null
    };
    if (!body.examTitle) { showToast('Nhập tên bài kiểm tra!', 'error'); return; }
    try {
        await apiFetch(`/api/it/exams/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        closeModal('editExamModal');
        showToast('Cập nhật bài kiểm tra thành công!');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

async function deleteExam(examId) {
    if (!confirm('Xóa bài kiểm tra này? Toàn bộ câu hỏi và lịch sử thi sẽ bị xóa.')) return;
    try {
        await apiFetch(`/api/it/exams/${examId}`, { method: 'DELETE' });
        showToast('Đã xóa bài kiểm tra!', 'warning');
        loadCourseContent();
        await loadDocumentLibrary();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

// ============================================================
// JOB TITLE CRUD
// ============================================================
async function loadJobTitles() {
    try {
        const titles = await apiFetch('/api/it/jobtitles');
        const tbody = document.getElementById('jobTitlesTable');
        if (!titles || titles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:40px">Chưa có chức danh nào</td></tr>';
            return;
        }
        tbody.innerHTML = titles.map(t => `
            <tr>
                <td>${t.jobTitleId || t.id}</td>
                <td><strong>${t.titleName || t.title}</strong></td>
                <td><span class="badge badge-info">Grade ${t.gradeLevel || 'N/A'}</span></td>
                <td><span style="font-weight:600;color:#3b82f6">${t.userCount || 0} người</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditJobTitleModal(${t.jobTitleId || t.id}, '${(t.titleName || t.title || '').replace(/'/g, "\\'")}', ${t.gradeLevel || 'null'})">Sửa</button>
                    <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626" onclick="deleteJobTitle(${t.jobTitleId || t.id}, '${(t.titleName || t.title || '').replace(/'/g, "\\'")}', ${t.userCount || 0})">Xóa</button>
                </td>
            </tr>`).join('');
    } catch(e) {
        showToast('Lỗi tải chức danh', 'error');
    }
}

function openCreateJobTitleModal() {
    document.getElementById('jobTitleModalId').value = '';
    document.getElementById('jobTitleModalName').value = '';
    document.getElementById('jobTitleModalGrade').value = '';
    document.getElementById('jobTitleModalTitle').textContent = 'Thêm Chức Danh';
    openModal('jobTitleModal');
}

function openEditJobTitleModal(id, name, grade) {
    document.getElementById('jobTitleModalId').value = id;
    document.getElementById('jobTitleModalName').value = name;
    document.getElementById('jobTitleModalGrade').value = grade ?? '';
    document.getElementById('jobTitleModalTitle').textContent = 'Sửa Chức Danh';
    openModal('jobTitleModal');
}

async function submitJobTitle() {
    const id = document.getElementById('jobTitleModalId').value;
    const titleName = document.getElementById('jobTitleModalName').value.trim();
    const gradeRaw = document.getElementById('jobTitleModalGrade').value.trim();
    const gradeLevel = gradeRaw ? parseInt(gradeRaw) : null;

    if (!titleName) { showToast('Vui lòng nhập tên chức danh!', 'error'); return; }

    try {
        const body = { titleName, gradeLevel };
        if (id) {
            await apiFetch('/api/it/jobtitles/' + id, { method: 'PUT', body: JSON.stringify(body) });
            showToast('Đã cập nhật chức danh!', 'success');
        } else {
            await apiFetch('/api/it/jobtitles', { method: 'POST', body: JSON.stringify(body) });
            showToast('Đã thêm chức danh mới!', 'success');
        }
        closeModal('jobTitleModal');
        loadJobTitles();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

async function deleteJobTitle(id, name, userCount) {
    if (userCount > 0) { showToast('Không thể xóa! Còn ' + userCount + ' NV đang dùng chức danh này.', 'error'); return; }
    if (!confirm('Xác nhận xóa chức danh: ' + name + '?')) return;
    try {
        await apiFetch('/api/it/jobtitles/' + id, { method: 'DELETE' });
        showToast('Đã xóa chức danh!', 'warning');
        loadJobTitles();
    } catch(e) { showToast(e.message || 'Lỗi', 'error'); }
}

// ============================================================
// EXPORT EXCEL
// ============================================================
async function exportExcel(type) {
    const msgEl = document.getElementById('exportMsg');
    if (msgEl) { msgEl.style.display = 'block'; }

    let url = '/api/it/export/' + type;
    if (type === 'users') {
        const status = document.getElementById('exportUserStatus')?.value || '';
        if (status) url += '?status=' + encodeURIComponent(status);
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Lỗi server: ' + response.status);
        }
        const blob = await response.blob();
        const contentDisp = response.headers.get('Content-Disposition') || '';
        let fileName = 'export.xlsx';
        const match = contentDisp.match(/filename[^;=\n]*=((['"])(.*?)\2|([^;\n]*))/);
        if (match) fileName = match[3] || match[4] || fileName;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast('Tải file thành công: ' + fileName, 'success');
    } catch(e) {
        showToast('Lỗi xuất file: ' + (e.message || e), 'error');
    } finally {
        if (msgEl) { setTimeout(() => { msgEl.style.display = 'none'; }, 3000); }
    }
}

async function openDepartmentDetailModal(id) {
    document.getElementById('departmentDetailId').value = id;
    document.getElementById('departmentEmployeesTable').innerHTML = '<tr><td colspan="7"><div class="loading-overlay"><div class="spinner"></div></div></td></tr>';
    openModal('departmentDetailModal');
    try {
        const data = await apiFetch(`/api/it/departments/${id}`);
        document.getElementById('departmentDetailTitle').textContent = `Chi tiết phòng ban: ${data.departmentName}`;
        document.getElementById('departmentManagerSelect').innerHTML =
            '<option value="">-- Chọn trưởng phòng --</option>' +
            (data.employees || []).map(e =>
                `<option value="${e.userId}" ${data.managerId === e.userId ? 'selected' : ''}>${e.fullName || e.username} (${e.employeeCode || 'N/A'})</option>`
            ).join('');
        document.getElementById('departmentEmployeesTable').innerHTML = (data.employees || []).map(e => `
            <tr>
                <td><code>${e.employeeCode || '—'}</code></td>
                <td><strong>${e.fullName || 'N/A'}</strong></td>
                <td>${e.username || '—'}</td>
                <td>${e.email || '—'}</td>
                <td>${e.jobTitle || '—'}</td>
                <td>${statusBadge(e.status || 'Inactive')}</td>
                <td>${e.isDepartmentManager ? '<span class="badge badge-green">Trưởng phòng</span>' : ((e.roles || []).map(r => `<span class="badge badge-purple">${r.roleName}</span>`).join(' ') || '—')}</td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center">Phòng ban chưa có nhân viên</td></tr>';
    } catch (e) {
        showToast(e.message || 'Lỗi tải chi tiết phòng ban', 'error');
    }
}

async function assignDepartmentManager() {
    const departmentId = parseInt(document.getElementById('departmentDetailId').value);
    const userId = parseInt(document.getElementById('departmentManagerSelect').value);
    if (!userId) {
        showToast('Vui lòng chọn nhân viên để gán trưởng phòng.', 'error');
        return;
    }
    try {
        await apiFetch(`/api/it/departments/${departmentId}/manager`, {
            method: 'PUT',
            body: JSON.stringify({ userId })
        });
        showToast('Đã cập nhật trưởng phòng thành công!', 'success');
        await openDepartmentDetailModal(departmentId);
        await loadItDepartments();
        await loadUsers(1);
    } catch (e) {
        showToast(e.message || 'Lỗi cập nhật trưởng phòng', 'error');
    }
}

document.addEventListener('DOMContentLoaded', init);
