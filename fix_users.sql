-- Fix User Data: Encoding, Employee Codes, and Roles (Two-Step Migration)
BEGIN TRANSACTION;
BEGIN TRY
    -- 1. Identify Role IDs from earlier cleanup
    DECLARE @AdminID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'ADMIN');
    DECLARE @ItID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'IT');
    DECLARE @HrID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'HR');
    DECLARE @DeptID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Department Manager');
    DECLARE @InstrID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Instructor');
    DECLARE @EmpID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Employee');

    -- 2. Clean existing UserRoles
    DELETE FROM UserRoles;

    -- 3. Step 1: Assign temporary unique codes to avoid constraint violations
    -- We use the UserID as a suffix to ensure global uniqueness during the transition
    UPDATE Users SET EmployeeCode = 'TEMP_' + CAST(UserID AS VARCHAR);

    -- 4. Step 2: Update Users to their final data
    UPDATE Users SET FullName = N'Administrator', EmployeeCode = 'ADM001', Status = 'Active' WHERE Username = 'admin';
    UPDATE Users SET FullName = N'Hoàng Xuân Hiếu', EmployeeCode = 'NV001', Status = 'Active' WHERE Username = 'hoangxuanhieu';
    UPDATE Users SET FullName = N'Nguyễn HR Manager', EmployeeCode = 'NV002', Status = 'Active' WHERE Username = 'hr_manager';
    UPDATE Users SET FullName = N'Trần IT Manager', EmployeeCode = 'NV003', Status = 'Active' WHERE Username = 'it_manager';
    UPDATE Users SET FullName = N'Duy Hiếu', EmployeeCode = 'NV004', Status = 'Active' WHERE Username IN ('hiu882008', 'hiu662008');
    UPDATE Users SET FullName = N'Nguyễn Văn B', EmployeeCode = 'STU001', Status = 'Active' WHERE Username = 'Van B';
    UPDATE Users SET FullName = N'Hoàng Văn Thụ', EmployeeCode = 'STU002', Status = 'Active' WHERE Username = 'hoangvanthu';
    UPDATE Users SET FullName = N'Trần Văn C', EmployeeCode = 'STU003', Status = 'Active' WHERE Username = 'huhu';
    UPDATE Users SET FullName = N'Lê Văn D', EmployeeCode = 'STU004', Status = 'Active' WHERE Username = 'NVPRO';
    UPDATE Users SET FullName = N'Nguyễn Văn A', EmployeeCode = 'STU005', Status = 'Active' WHERE Username = 'student_1';

    -- 5. Re-assign Roles based on clean standard
    -- Admin
    INSERT INTO UserRoles (UserID, RoleID) SELECT UserID, @AdminID FROM Users WHERE Username IN ('admin', 'hoangxuanhieu');
    -- IT
    INSERT INTO UserRoles (UserID, RoleID) SELECT UserID, @ItID FROM Users WHERE Username IN ('it_manager');
    -- HR
    INSERT INTO UserRoles (UserID, RoleID) SELECT UserID, @HrID FROM Users WHERE Username IN ('hr_manager');
    -- Dept Manager
    INSERT INTO UserRoles (UserID, RoleID) SELECT UserID, @DeptID FROM Users WHERE Username IN ('hiu882008', 'hiu662008', 'hr_manager_new');
    -- Employees
    INSERT INTO UserRoles (UserID, RoleID) SELECT UserID, @EmpID FROM Users WHERE Username IN ('student_1', 'sale_manager', 'Van B', 'hoangvanthu', 'huhu', 'NVPRO');

    -- Final cleanup for anyone left with NULL status
    UPDATE Users SET Status = 'Active' WHERE Status IS NULL OR Status = '';

    COMMIT TRANSACTION;
    PRINT 'User data and role assignments fixed successfully with two-step migration.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrorMessage, 16, 1);
END CATCH;
GO
