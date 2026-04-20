using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using KhoaHoc.Models;

namespace KhoaHoc.Controllers;

public class AuthController : Controller
{
    private readonly CorporateLmsProContext _db;

    public AuthController(CorporateLmsProContext db)
    {
        _db = db;
    }

    [HttpGet]
    public IActionResult Login()
    {
        // Nếu đã có Session UserID -> Đẩy về trang chủ tương ứng luôn
        if (HttpContext.Session.GetString("UserID") != null)
        {
            return RedirectToDashboard();
        }
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Login(string username, string password)
    {
        // 1. Kiểm tra đầu vào trống
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            ViewBag.Error = "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.";
            return View();
        }
        
        username = username.Trim();
        password = password.Trim();

        // 2. Tìm User trong DB (bao gồm cả Roles và Department để check quyền sau này)
        var user = await _db.Users
            .Include(u => u.Roles)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Username == username && u.Status == "Active");

        if (user == null)
        {
            ViewBag.Error = "Tên đăng nhập không tồn tại hoặc tài khoản đã bị khóa.";
            return View();
        }

        // 3. KIỂM TRA MẬT KHẨU (PHẦN QUAN TRỌNG NHẤT)
        bool passwordValid = false;
        if (user.PasswordHash != null)
        {
            // Băm mật khẩu người dùng vừa nhập bằng SHA256
            byte[] inputBytes = Encoding.UTF8.GetBytes(password);
            byte[] hashedInput = SHA256.HashData(inputBytes);

            // Chuyển cả 2 sang chuỗi Hex (viết hoa) để so sánh cho chính xác tuyệt đối
            string storedHashHex = Convert.ToHexString(user.PasswordHash);
            string inputHashHex = Convert.ToHexString(hashedInput);

            if (storedHashHex.Equals(inputHashHex, StringComparison.OrdinalIgnoreCase))
            {
                passwordValid = true;
            }
            // Fallback: nếu Database lưu password dưới dạng plain text
            else if (Encoding.UTF8.GetString(user.PasswordHash) == password)
            {
                passwordValid = true;
            }
        }

        if (!passwordValid)
        {
            ViewBag.Error = "Mật khẩu không chính xác.";
            return View();
        }

        // 4. THIẾT LẬP SESSION (Lưu thông tin tạm thời)
        HttpContext.Session.SetString("UserID", user.UserId.ToString());
        HttpContext.Session.SetString("FullName", user.FullName ?? user.Username ?? "Người dùng");
        HttpContext.Session.SetString("Username", user.Username ?? "");
        HttpContext.Session.SetString("DepartmentID", user.DepartmentId?.ToString() ?? "0");
        HttpContext.Session.SetString("DepartmentName", user.Department?.DepartmentName ?? "");
        
        string role = DetermineRole(user);
        HttpContext.Session.SetString("Role", role);

        // 5. THIẾT LẬP COOKIE AUTHENTICATION (Dùng cho [Authorize])
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Name, user.Username ?? ""),
            new Claim("FullName", user.FullName ?? ""),
            new Claim(ClaimTypes.Role, role)
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var authProperties = new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
        };

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme, 
            new ClaimsPrincipal(claimsIdentity), 
            authProperties);

        // 6. CẬP NHẬT THỜI GIAN ĐĂNG NHẬP CUỐI
        user.LastLogin = DateTime.Now;
        await _db.SaveChangesAsync();

        return RedirectToDashboard();
    }

    [HttpGet]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        HttpContext.Session.Clear();
        return RedirectToAction("Login");
    }

    private string DetermineRole(User user)
    {
        var roleNames = user.Roles.Select(r => r.RoleName?.ToUpper() ?? "").ToList();

        // Thứ tự ưu tiên: ADMIN > IT > HR > Department Manager > Instructor > Employee
        if (roleNames.Contains("ADMIN")) return "ADMIN";
        if (roleNames.Contains("IT") || user.IsItadmin == true) return "IT";
        if (roleNames.Contains("HR")) return "HR";
        if (roleNames.Contains("DEPARTMENT MANAGER") || user.IsDeptAdmin == true || roleNames.Contains("MANAGER") || roleNames.Contains("DEPT ADMIN")) 
            return "Department Manager";
        if (roleNames.Contains("INSTRUCTOR") || roleNames.Contains("TRAINER")) return "Instructor";

        return "Employee";
    }

    private IActionResult RedirectToDashboard()
    {
        var role = HttpContext.Session.GetString("Role");
        return role switch
        {
            "ADMIN" => RedirectToAction("Index", "Admin"),
            "IT" => RedirectToAction("Index", "IT"),
            "HR" => RedirectToAction("Index", "HR"),
            "Department Manager" => RedirectToAction("Index", "DeptManager"),
            "Instructor" => RedirectToAction("Index", "Instructor"),
            _ => RedirectToAction("Index", "Student")
        };
    }

    [HttpGet]
    public async Task<IActionResult> GetDepartmentInfo(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return Json(new { success = false });

        var user = await _db.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Username == username && u.Status == "Active");

        if (user == null || user.Department == null)
            return Json(new { success = false });

        return Json(new
        {
            success = true,
            deptName = user.Department.DepartmentName
        });
    }
}
