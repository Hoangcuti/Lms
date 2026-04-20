-- ============================================================
-- Script cập nhật database: Thêm cột mới cho bảng Exams
-- Ngày: 2026-04-17
-- Mục đích: Thêm số lần làm, ngày bắt đầu, ngày kết thúc, phòng ban
-- ============================================================

-- Kiểm tra và thêm cột MaxAttempts (số lần làm tối đa)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Exams' AND COLUMN_NAME = 'MaxAttempts'
)
BEGIN
    ALTER TABLE Exams ADD MaxAttempts INT NULL;
    PRINT 'Đã thêm cột MaxAttempts vào bảng Exams';
END
ELSE
    PRINT 'Cột MaxAttempts đã tồn tại';

-- Kiểm tra và thêm cột StartDate (ngày bắt đầu)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Exams' AND COLUMN_NAME = 'StartDate'
)
BEGIN
    ALTER TABLE Exams ADD StartDate DATE NULL;
    PRINT 'Đã thêm cột StartDate vào bảng Exams';
END
ELSE
    PRINT 'Cột StartDate đã tồn tại';

-- Kiểm tra và thêm cột EndDate (ngày kết thúc)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Exams' AND COLUMN_NAME = 'EndDate'
)
BEGIN
    ALTER TABLE Exams ADD EndDate DATE NULL;
    PRINT 'Đã thêm cột EndDate vào bảng Exams';
END
ELSE
    PRINT 'Cột EndDate đã tồn tại';

-- Kiểm tra và thêm cột TargetDepartmentId (phòng ban mục tiêu)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Exams' AND COLUMN_NAME = 'TargetDepartmentId'
)
BEGIN
    ALTER TABLE Exams ADD TargetDepartmentId INT NULL;
    PRINT 'Đã thêm cột TargetDepartmentId vào bảng Exams';
END
ELSE
    PRINT 'Cột TargetDepartmentId đã tồn tại';

-- Xác nhận kết quả
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Exams'
ORDER BY ORDINAL_POSITION;

PRINT '✅ Hoàn tất cập nhật database cho bảng Exams!';
