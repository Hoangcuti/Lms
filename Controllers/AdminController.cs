using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using KhoaHoc.Models;

namespace KhoaHoc.Controllers;

public class AdminController : Controller
{
    private readonly CorporateLmsProContext _db;

    public AdminController(CorporateLmsProContext db)
    {
        _db = db;
    }

    private IActionResult? RequireAdmin()
    {
        var role = HttpContext.Session.GetString("Role");
        if (HttpContext.Session.GetString("UserID") == null)
            return RedirectToAction("Login", "Auth");
        if (role != "ADMIN")
            return RedirectToAction("Login", "Auth");
        return null;
    }

    public IActionResult Index()
    {
        var auth = RequireAdmin();
        if (auth != null) return auth;
        return View();
    }
}
