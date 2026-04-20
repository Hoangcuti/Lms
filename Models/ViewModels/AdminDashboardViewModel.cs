using System.Collections.Generic;
using KhoaHoc.Models;

namespace KhoaHoc.Models.ViewModels;

public class AdminDashboardViewModel
{
    public int TotalLearners { get; set; }
    public double CompletionRate { get; set; }
    public double AverageScore { get; set; }
    public List<User> Users { get; set; } = new List<User>();
    public List<AuditLog> RecentLogs { get; set; } = new List<AuditLog>();
    public List<Role> AvailableRoles { get; set; } = new List<Role>();
    public List<Department> Departments { get; set; } = new List<Department>();
}
