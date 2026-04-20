using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using KhoaHoc.Models;

namespace KhoaHoc.Controllers;

public class HRController : Controller
{
    private readonly CorporateLmsProContext _db;
    private readonly KhoaHoc.Services.IEmailService _emailService;
    private readonly KhoaHoc.Services.IAIService _aiService;

    public HRController(CorporateLmsProContext db, KhoaHoc.Services.IEmailService emailService, KhoaHoc.Services.IAIService aiService)
    {
        _db = db;
        _emailService = emailService;
        _aiService = aiService;
    }

    private IActionResult? RequireHR()
    {
        var role = HttpContext.Session.GetString("Role");
        if (HttpContext.Session.GetString("UserID") == null)
            return RedirectToAction("Login", "Auth");
        if (role != "HR" && role != "IT" && role != "ADMIN")
            return RedirectToAction("Login", "Auth");
        return null;
    }

    private int GetCurrentUserId() =>
        int.Parse(HttpContext.Session.GetString("UserID") ?? "0");

    private int GetCurrentDeptId() =>
        int.Parse(HttpContext.Session.GetString("DepartmentID") ?? "0");

    private IActionResult? RequireHRApi()
    {
        var auth = RequireHR();
        if (auth != null)
            return Json(new { error = "Unauthorized" });

        var role = HttpContext.Session.GetString("Role");
        if (role != "HR" && role != "ADMIN")
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Chỉ nhân sự HR hoặc Admin mới có quyền thực hiện thao tác này." });

        return null;
    }

    // Dashboard chính HR
    public async Task<IActionResult> Index()
    {
        var auth = RequireHR();
        if (auth != null) return auth;
        return View();
    }

    // API: KPIs tổng quan HR
    [HttpGet("/api/hr/stats")]
    public async Task<IActionResult> Stats()
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        int deptId = GetCurrentDeptId();
        var query = _db.Users.Where(u => u.Status == "Active");
        // HR thường xem toàn bộ, nếu có deptId cụ thể thì mới lọc
        if (deptId > 0 && HttpContext.Session.GetString("Role") != "ADMIN") 
            query = query.Where(u => u.DepartmentId == deptId);

        var totalEmployees = await query.CountAsync();
        
        var assignmentQuery = _db.TrainingAssignments.AsQueryable();
        var totalAssignments = await assignmentQuery.CountAsync();

        var enrollmentQuery = _db.Enrollments.AsQueryable();
        var completedTrainings = await enrollmentQuery.CountAsync(e => e.Status == "Completed");

        var certQuery = _db.Certificates.AsQueryable();
        var totalCertificates = await certQuery.CountAsync();

        var budgetData = await _db.DeptTrainingBudgets
            .Where(b => b.Year == DateTime.Now.Year)
            .SumAsync(b => (decimal?)b.TotalBudget) ?? 0;

        var spentData = await _db.DeptTrainingBudgets
            .Where(b => b.Year == DateTime.Now.Year)
            .SumAsync(b => (decimal?)b.SpentAmount) ?? 0;

        return Json(new
        {
            totalEmployees,
            totalAssignments,
            completedTrainings,
            totalCertificates,
            totalBudget = budgetData,
            spentBudget = spentData,
            budgetUsagePercent = budgetData > 0 ? Math.Round(spentData / budgetData * 100, 1) : 0
        });
    }

    // API: Danh sách phân công đào tạo
    [HttpGet("/api/hr/assignments")]
    public async Task<IActionResult> GetAssignments(string? search, string? priority, int page = 1, int pageSize = 15)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var query = _db.TrainingAssignments
            .Include(ta => ta.User)
                .ThenInclude(u => u!.Department)
            .Include(ta => ta.Course)
            .Include(ta => ta.AssignedByNavigation)
            .AsQueryable();

        if (!string.IsNullOrEmpty(search))
            query = query.Where(ta => (ta.User != null && ta.User.FullName!.Contains(search))
                                   || (ta.Course != null && ta.Course.Title!.Contains(search)));

        if (!string.IsNullOrEmpty(priority) && priority != "all")
            query = query.Where(ta => ta.Priority == priority);

        var total = await query.CountAsync();
        var assignments = await query
            .OrderByDescending(ta => ta.AssignedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ta => new
            {
                assignmentId = ta.AssignmentId,
                employeeName = ta.User != null ? ta.User.FullName : "N/A",
                department = ta.User != null && ta.User.Department != null ? ta.User.Department.DepartmentName : "N/A",
                courseName = ta.Course != null ? ta.Course.Title : "N/A",
                assignedBy = ta.AssignedByNavigation != null ? ta.AssignedByNavigation.FullName : "N/A",
                assignedDate = ta.AssignedDate,
                dueDate = ta.DueDate,
                priority = ta.Priority
            })
            .ToListAsync();

        return Json(new { total, page, assignments });
    }

    // API: Tạo phân công đào tạo mới
    [HttpPost("/api/hr/assignments")]
    public async Task<IActionResult> CreateAssignment([FromBody] CreateAssignmentDto dto)
    {
        var auth = RequireHRApi();
        if (auth != null) return auth;

        var assignment = new TrainingAssignment
        {
            UserId = dto.UserId,
            CourseId = dto.CourseId,
            AssignedBy = GetCurrentUserId(),
            AssignedDate = DateTime.Now,
            DueDate = dto.DueDate,
            Priority = dto.Priority ?? "Normal"
        };

        _db.TrainingAssignments.Add(assignment);

        var existingEnrollment = await _db.Enrollments
            .FirstOrDefaultAsync(e => e.UserId == dto.UserId && e.CourseId == dto.CourseId);

        if (existingEnrollment == null)
        {
            _db.Enrollments.Add(new Enrollment
            {
                UserId = dto.UserId,
                CourseId = dto.CourseId,
                EnrollDate = DateTime.Now,
                ProgressPercent = 0,
                Status = "NotStarted"
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new { success = true, assignmentId = assignment.AssignmentId });
    }

    // API: Ngân sách theo phòng ban
    [HttpGet("/api/hr/budget")]
    public async Task<IActionResult> GetBudget(int? year)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        int targetYear = year ?? DateTime.Now.Year;

        var budgets = await _db.DeptTrainingBudgets
            .Include(b => b.Dept)
            .Where(b => b.Year == targetYear)
            .Select(b => new
            {
                budgetId = b.BudgetId,
                department = b.Dept != null ? b.Dept.DepartmentName : "N/A",
                year = b.Year,
                totalBudget = b.TotalBudget,
                spentAmount = b.SpentAmount,
                remaining = (b.TotalBudget ?? 0) - (b.SpentAmount ?? 0),
                usagePercent = b.TotalBudget > 0
                    ? Math.Round((double)(b.SpentAmount ?? 0) / (double)b.TotalBudget! * 100, 1)
                    : 0.0
            })
            .OrderByDescending(b => b.totalBudget)
            .ToListAsync();

        return Json(budgets);
    }

    // API: Báo cáo kỹ năng theo phòng ban
    [HttpGet("/api/hr/skills")]
    public async Task<IActionResult> SkillReport(int? departmentId)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var query = _db.UserSkills
            .Include(us => us.User)
                .ThenInclude(u => u.Department)
            .Include(us => us.Skill)
            .AsQueryable();

        if (departmentId.HasValue)
            query = query.Where(us => us.User.DepartmentId == departmentId);

        var skillData = await query
            .GroupBy(us => us.Skill.SkillName)
            .Select(g => new
            {
                skillName = g.Key,
                averageScore = Math.Round(g.Average(us => (double)(us.LevelScore ?? 0)), 1),
                employeeCount = g.Count()
            })
            .OrderByDescending(s => s.averageScore)
            .ToListAsync();

        var departments = await _db.Departments
            .Select(d => new { d.DepartmentId, d.DepartmentName })
            .ToListAsync();

        return Json(new { skillData, departments });
    }

    // API: Tiến độ học tập theo phòng ban
    [HttpGet("/api/hr/training-progress")]
    public async Task<IActionResult> TrainingProgress()
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var data = await _db.Enrollments
            .Include(e => e.User)
                .ThenInclude(u => u!.Department)
            .Where(e => e.User != null && e.User.Department != null)
            .GroupBy(e => e.User!.Department!.DepartmentName)
            .Select(g => new
            {
                department = g.Key,
                total = g.Count(),
                completed = g.Count(e => e.Status == "Completed"),
                inProgress = g.Count(e => e.Status == "InProgress"),
                notStarted = g.Count(e => e.Status == "NotStarted"),
                completionRate = g.Count() > 0
                    ? Math.Round((double)g.Count(e => e.Status == "Completed") / g.Count() * 100, 1)
                    : 0.0
            })
            .ToListAsync();

        return Json(data);
    }

    // API: Danh sách nhân viên
    [HttpGet("/api/hr/employees")]
    public async Task<IActionResult> GetEmployees(int? departmentId)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var query = _db.Users
            .Include(u => u.Department)
            .AsQueryable();

        if (departmentId.HasValue)
            query = query.Where(u => u.DepartmentId == departmentId);

        var employees = await query
            .Select(u => new
            {
                userId = u.UserId,
                fullName = u.FullName,
                department = u.Department != null ? u.Department.DepartmentName : "N/A",
                employeeCode = u.EmployeeCode,
                email = u.Email,
                status = u.Status,
                assignedCount = _db.TrainingAssignments.Count(ta => ta.UserId == u.UserId),
                completedCount = _db.Enrollments.Count(e => e.UserId == u.UserId && e.Status == "Completed")
            })
            .OrderBy(u => u.fullName)
            .ToListAsync();

        return Json(employees);
    }

    // API: Chi tiết Hồ sơ năng lực (Profile)
    [HttpGet("/api/hr/employees/{id}/profile")]
    public async Task<IActionResult> GetEmployeeProfile(int id)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var user = await _db.Users
            .Include(u => u.Department)
            .Include(u => u.JobTitle)
            .FirstOrDefaultAsync(u => u.UserId == id);

        if (user == null) return NotFound("User not found");

        var courses = await _db.Enrollments
            .Include(e => e.Course)
            .Where(e => e.UserId == id)
            .Select(e => new {
                title = e.Course!.Title,
                progress = e.ProgressPercent,
                status = e.Status,
                enrollDate = e.EnrollDate
            })
            .ToListAsync();

        var skills = await _db.UserSkills
            .Include(s => s.Skill)
            .Where(s => s.UserId == id)
            .Select(s => new {
                skillName = s.Skill!.SkillName,
                score = s.LevelScore,
                lastEvaluated = s.LastAssessed
            })
            .ToListAsync();

        return Json(new {
            fullName = user.FullName,
            email = user.Email,
            employeeCode = user.EmployeeCode,
            departmentName = user.Department?.DepartmentName ?? "N/A",
            jobTitle = user.JobTitle?.TitleName ?? "N/A",
            status = user.Status,
            courses,
            skills
        });
    }

    // HR update status nhân viên
    [HttpPatch("/api/hr/employees/{id}/status")]
    public async Task<IActionResult> UpdateEmployeeStatus(int id, [FromBody] string status)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.Status = status == "Active" ? "Active" : "Inactive";
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // API: Danh sách departments
    [HttpGet("/api/hr/departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var depts = await _db.Departments
            .Select(d => new { d.DepartmentId, d.DepartmentName })
            .ToListAsync();
        return Json(depts);
    }

    [HttpGet("/api/hr/courses")]
    public async Task<IActionResult> GetCourses()
    {
        var auth = RequireHRApi();
        if (auth != null) return auth;

        var courses = await _db.Courses
            .Where(c => c.Status != "Deleted")
            .Select(c => new { 
                c.CourseId, 
                c.Title, 
                c.IsMandatory,
                c.Status,
                moduleCount = c.CourseModules.Count(),
                lessonCount = c.CourseModules.SelectMany(m => m.Lessons).Count(),
                examCount = c.Exams.Count()
            })
            .ToListAsync();
        return Json(courses);
    }

    // AI generate content
    [HttpPost("/api/hr/ai-generate-course")]
    public async Task<IActionResult> GenerateCourseAI([FromBody] PromptDto dto)
    {
        var auth = RequireHR();
        if (auth != null) return Json(new { error = "Unauthorized" });

        var topic = dto.Prompt?.Trim() ?? "Kỹ năng mới";
        var generatedData = await _aiService.GenerateCourseContentAsync(topic);

        return Ok(generatedData);
    }
}

// DTOs (Restated to ensure compilation)
public class CreateAssignmentDto
{
    public int UserId { get; set; }
    public int CourseId { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Priority { get; set; }
}

public class PromptDto
{
    public string Prompt { get; set; } = "";
}
