using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace KhoaHoc.Models;

[Table("DocumentLibrary")]
public partial class DocumentLibrary
{
    [Key]
    [Column("ID")]
    public int Id { get; set; }

    [StringLength(255)]
    public string? Title { get; set; }

    [StringLength(500)]
    public string? FilePath { get; set; }

    [Column("SharedByDeptID")]
    public int? SharedByDeptId { get; set; }
}
