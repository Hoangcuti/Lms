using System;
using System.Collections.Generic;

namespace KhoaHoc.Models.ViewModels;

public class CourseReportViewModel
{
    public int CourseId { get; set; }
    public string CourseCode { get; set; } = null!;
    public string Title { get; set; } = null!;
    public int TotalLearners { get; set; }
    public double CompletionRate { get; set; }
    public double AverageScore { get; set; }
}
