using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using KhoaHoc.Models;
using KhoaHoc.Models.ViewModels;

namespace KhoaHoc.Controllers;

public class AdminController : Controller
{
    private readonly CorporateLmsProContext _db;

    public AdminController(CorporateLmsProContext db)
    {
        _db = db;
    }

    private int? GetCurrentUserId()
    {
        var idStr = HttpContext.Session.GetString("UserID");
        if (int.TryParse(idStr, out int id)) return id;
        return null;
    }

    private IActionResult? RequireAdmin()
    {
        var role = HttpContext.Session.GetString("Role");
        if (GetCurrentUserId() == null || role != "ADMIN")
            return RedirectToAction("Login", "Auth");
        return null;
    }

    private async Task LogAction(string actionType, string tableName, string description)
    {
        int? userId = GetCurrentUserId();
        if (userId == null) return;

        var log = new AuditLog
        {
            UserId = userId,
            ActionType = actionType,
            TableName = tableName,
            Description = description,
            Ipaddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            CreatedAt = DateTime.Now
        };
        _db.AuditLogs.Add(log);
        await _db.SaveChangesAsync();
    }

    public async Task<IActionResult> Index()
    {
        var auth = RequireAdmin();
        if (auth != null) return auth;

        var vm = new AdminDashboardViewModel();
        
        vm.TotalLearners = await _db.Users.CountAsync();
        
        // Calculate completion rate and average score from real data
        var userProgresses = await _db.UserPathProgresses.ToListAsync();
        vm.CompletionRate = userProgresses.Any() ? Math.Round(userProgresses.Average(p => (double)(p.PercentComplete ?? 0)), 1) : 0;
        
        var userExams = await _db.UserExams.Where(e => e.Score != null).ToListAsync();
        vm.AverageScore = userExams.Any() ? Math.Round((double)userExams.Average(e => e.Score!.Value), 1) : 0;

        vm.Users = await _db.Users
            .Include(u => u.Department)
            .Include(u => u.Roles)
            .OrderByDescending(u => u.UserId)
            .ToListAsync();
            
        vm.RecentLogs = await _db.AuditLogs
            .Include(l => l.User)
            .OrderByDescending(l => l.CreatedAt)
            .Take(50)
            .ToListAsync();
            
        vm.AvailableRoles = await _db.Roles.ToListAsync();
        vm.Departments = await _db.Departments.ToListAsync();

        return View(vm);
    }

    [HttpPost]
    public async Task<IActionResult> AddUser(string username, string fullName, string email, int? departmentId, string roleName)
    {
        var auth = RequireAdmin();
        if (auth != null) return Json(new { success = false, message = "Unauthorized" });

        if (await _db.Users.AnyAsync(u => u.Username == username))
            return Json(new { success = false, message = "Username already exists" });

        var user = new User
        {
            Username = username,
            FullName = fullName,
            Email = email,
            DepartmentId = departmentId > 0 ? departmentId : null,
            Status = "Active",
            PasswordHash = SHA256.HashData(Encoding.UTF8.GetBytes("123456aA@"))
        };

        if (!string.IsNullOrEmpty(roleName))
        {
            var role = await _db.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName);
            if (role != null) user.Roles.Add(role);
        }

        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await LogAction("CREATE", "Users", $"Thêm mới người dùng {username}");

        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> EditUser(int userId, string fullName, string email, int? departmentId)
    {
        var auth = RequireAdmin();
        if (auth != null) return Json(new { success = false, message = "Unauthorized" });

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Json(new { success = false, message = "User not found" });

        user.FullName = fullName;
        user.Email = email;
        user.DepartmentId = departmentId > 0 ? departmentId : null;

        await _db.SaveChangesAsync();
        await LogAction("UPDATE", "Users", $"Cập nhật thông tin người dùng {user.Username}");

        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> DeleteUser(int userId)
    {
        var auth = RequireAdmin();
        if (auth != null) return Json(new { success = false, message = "Unauthorized" });

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Json(new { success = false, message = "User not found" });

        // Soft delete
        user.Status = "Deleted";
        await _db.SaveChangesAsync();
        await LogAction("DELETE", "Users", $"Đã xóa (soft) người dùng {user.Username}");

        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> ResetPassword(int userId)
    {
        var auth = RequireAdmin();
        if (auth != null) return Json(new { success = false, message = "Unauthorized" });

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Json(new { success = false, message = "User not found" });

        user.PasswordHash = SHA256.HashData(Encoding.UTF8.GetBytes("123456aA@"));
        await _db.SaveChangesAsync();
        await LogAction("UPDATE", "Users", $"Reset mật khẩu cho người dùng {user.Username}");

        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> ToggleStatus(int userId)
    {
        var auth = RequireAdmin();
        if (auth != null) return Json(new { success = false, message = "Unauthorized" });

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Json(new { success = false, message = "User not found" });

        user.Status = user.Status == "Active" ? "Locked" : "Active";
        await _db.SaveChangesAsync();
        await LogAction("UPDATE", "Users", $"Thay đổi trạng thái tài khoản {user.Username} thành {user.Status}");

        return Json(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> ChangeRole(int userId, int roleId)
    {
        var auth = RequireAdmin();
        if (auth != null) return Json(new { success = false, message = "Unauthorized" });

        var user = await _db.Users.Include(u => u.Roles).FirstOrDefaultAsync(u => u.UserId == userId);
        if (user == null) return Json(new { success = false, message = "User not found" });

        var role = await _db.Roles.FindAsync(roleId);
        if (role == null) return Json(new { success = false, message = "Role not found" });

        user.Roles.Clear();
        user.Roles.Add(role);
        
        await _db.SaveChangesAsync();
        await LogAction("UPDATE", "UserRoles", $"Thay đổi role của {user.Username} thành {role.RoleName}");

        return Json(new { success = true });
    }
}
