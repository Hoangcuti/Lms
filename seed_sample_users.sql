-- SEED STANDARDIZED TEST USERS FOR ALL 6 ROLES
BEGIN TRANSACTION;
BEGIN TRY
    -- 1. Identify Role IDs
    DECLARE @AdminID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'ADMIN');
    DECLARE @ItID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'IT');
    DECLARE @HrID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'HR');
    DECLARE @DeptID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Department Manager');
    DECLARE @InstrID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Instructor');
    DECLARE @EmpID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Employee');

    DECLARE @SharedHash VARBINARY(MAX) = 0x8D969EEF6ECAD3C29A3A629280E686CF0C3F5D5A86AFF3CA12020C923ADC6C92;

    -- 2. Create New Users
    -- Clean up any existing test accounts first to allow re-runs
    DELETE FROM UserRoles WHERE UserID IN (SELECT UserID FROM Users WHERE Username LIKE '%_test');
    DELETE FROM Users WHERE Username LIKE '%_test';

    -- ADMIN TEST
    INSERT INTO Users (Username, FullName, Email, PasswordHash, EmployeeCode, Status, DepartmentID)
    VALUES ('admin_test', N'Super Administrator', 'admin_test@lms.pro', @SharedHash, 'ADM_TEST', 'Active', 1);
    DECLARE @UidAdmin INT = SCOPE_IDENTITY();
    INSERT INTO UserRoles (UserID, RoleID) VALUES (@UidAdmin, @AdminID);

    -- IT TEST
    INSERT INTO Users (Username, FullName, Email, PasswordHash, EmployeeCode, Status, DepartmentID)
    VALUES ('it_test', N'IT System Admin', 'it_test@lms.pro', @SharedHash, 'IT_TEST', 'Active', 1);
    DECLARE @UidIt INT = SCOPE_IDENTITY();
    INSERT INTO UserRoles (UserID, RoleID) VALUES (@UidIt, @ItID);

    -- HR TEST
    INSERT INTO Users (Username, FullName, Email, PasswordHash, EmployeeCode, Status, DepartmentID)
    VALUES ('hr_test', N'HR Specialist', 'hr_test@lms.pro', @SharedHash, 'HR_TEST', 'Active', 2);
    DECLARE @UidHr INT = SCOPE_IDENTITY();
    INSERT INTO UserRoles (UserID, RoleID) VALUES (@UidHr, @HrID);

    -- DEPT MANAGER TEST
    INSERT INTO Users (Username, FullName, Email, PasswordHash, EmployeeCode, Status, DepartmentID)
    VALUES ('mgr_test', N'Department Lead', 'mgr_test@lms.pro', @SharedHash, 'MGR_TEST', 'Active', 3);
    DECLARE @UidMgr INT = SCOPE_IDENTITY();
    INSERT INTO UserRoles (UserID, RoleID) VALUES (@UidMgr, @DeptID);

    -- INSTRUCTOR TEST
    INSERT INTO Users (Username, FullName, Email, PasswordHash, EmployeeCode, Status, DepartmentID)
    VALUES ('ins_test', N'Senior Instructor', 'ins_test@lms.pro', @SharedHash, 'INS_TEST', 'Active', 4);
    DECLARE @UidIns INT = SCOPE_IDENTITY();
    INSERT INTO UserRoles (UserID, RoleID) VALUES (@UidIns, @InstrID);

    -- EMPLOYEE TEST
    INSERT INTO Users (Username, FullName, Email, PasswordHash, EmployeeCode, Status, DepartmentID)
    VALUES ('emp_test', N'Regular Employee', 'emp_test@lms.pro', @SharedHash, 'EMP_TEST', 'Active', 1);
    DECLARE @UidEmp INT = SCOPE_IDENTITY();
    INSERT INTO UserRoles (UserID, RoleID) VALUES (@UidEmp, @EmpID);

    COMMIT TRANSACTION;
    PRINT '6 Standardized Test Users created and assigned successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrorMessage, 16, 1);
END CATCH;
GO
