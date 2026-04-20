using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using KhoaHoc.Models;

namespace KhoaHoc.Controllers;

public class DeptManagerController : Controller
{
    private readonly CorporateLmsProContext _db;

    public DeptManagerController(CorporateLmsProContext db)
    {
        _db = db;
    }

    private IActionResult? RequireManager()
    {
        var role = HttpContext.Session.GetString("Role");
        if (HttpContext.Session.GetString("UserID") == null)
            return RedirectToAction("Login", "Auth");
        if (role != "Department Manager")
            return RedirectToAction("Login", "Auth");
        return null;
    }

    public IActionResult Index()
    {
        var auth = RequireManager();
        if (auth != null) return auth;
        return View();
    }
}
