using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using KhoaHoc.Models;

namespace KhoaHoc.Controllers;

public class InstructorController : Controller
{
    private readonly CorporateLmsProContext _db;

    public InstructorController(CorporateLmsProContext db)
    {
        _db = db;
    }

    private IActionResult? RequireInstructor()
    {
        var role = HttpContext.Session.GetString("Role");
        if (HttpContext.Session.GetString("UserID") == null)
            return RedirectToAction("Login", "Auth");
        if (role != "Instructor")
            return RedirectToAction("Login", "Auth");
        return null;
    }

    public IActionResult Index()
    {
        var auth = RequireInstructor();
        if (auth != null) return auth;
        return View();
    }
}
