-- BULLETPROOF CLEANUP ROLES AND MIGRATE ASSIGNMENTS
-- Uses a Delete-then-Insert pattern to safely merge roles without PK violations.

BEGIN TRANSACTION;
BEGIN TRY
    -- 1. Ensure exactly 6 target roles exist with standard names
    IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'ADMIN') INSERT INTO Roles (RoleName) VALUES ('ADMIN');
    IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'IT') INSERT INTO Roles (RoleName) VALUES ('IT');
    IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'HR') INSERT INTO Roles (RoleName) VALUES ('HR');
    IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'Department Manager') INSERT INTO Roles (RoleName) VALUES ('Department Manager');
    IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'Instructor') INSERT INTO Roles (RoleName) VALUES ('Instructor');
    IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'Employee') INSERT INTO Roles (RoleName) VALUES ('Employee');

    -- Get unique target IDs
    DECLARE @AdminID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'ADMIN');
    DECLARE @ItID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'IT');
    DECLARE @HrID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'HR');
    DECLARE @DeptID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Department Manager');
    DECLARE @InstrID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Instructor');
    DECLARE @EmpID INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Employee');

    -- 2. Create Comprehensive Mapping Table for ALL redundant roles
    IF OBJECT_ID('tempdb..#RoleMapping') IS NOT NULL DROP TABLE #RoleMapping;
    CREATE TABLE #RoleMapping (OldRoleID INT, NewRoleID INT);

    -- Map anything that sounds like Admin
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @AdminID FROM Roles WHERE RoleName IN ('Admin', 'Administrator', 'IT Admin (Support)', 'IT Admin') AND RoleID <> @AdminID;
    
    -- Map anything that sounds like IT
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @ItID FROM Roles WHERE RoleName IN ('IT Admin', 'IT Manager', 'IT') AND RoleID <> @ItID;
    
    -- Map anything that sounds like HR
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @HrID FROM Roles WHERE RoleName IN ('HR Manager', 'HR Admin', 'HR Manager', 'HR') AND RoleID <> @HrID;
    
    -- Map anything that sounds like Dept Manager
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @DeptID FROM Roles WHERE RoleName IN ('Dept Admin', 'Manager', 'Trưởng phòng', 'Department Manager') AND RoleID <> @DeptID;
    
    -- Map anything that sounds like Instructor
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @InstrID FROM Roles WHERE RoleName IN ('Giảng viên', 'Instructor') AND RoleID <> @InstrID;
    
    -- Map anything that sounds like Employee
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @EmpID FROM Roles WHERE RoleName IN ('Student', 'Nhân viên', 'Nhân viên', 'Employee') AND RoleID <> @EmpID;

    -- Map everything else that isn't one of our 6 targets to Employee (default)
    INSERT INTO #RoleMapping (OldRoleID, NewRoleID)
    SELECT RoleID, @EmpID FROM Roles 
    WHERE RoleID NOT IN (@AdminID, @ItID, @HrID, @DeptID, @InstrID, @EmpID)
    AND RoleID NOT IN (SELECT OldRoleID FROM #RoleMapping);

    -- 3. MIGRATE USER ROLES
    -- Copy assignments to be moved
    IF OBJECT_ID('tempdb..#TempUserRoles') IS NOT NULL DROP TABLE #TempUserRoles;
    SELECT DISTINCT UserID, rm.NewRoleID AS RoleID
    INTO #TempUserRoles
    FROM UserRoles ur
    JOIN #RoleMapping rm ON ur.RoleID = rm.OldRoleID;

    -- Delete old assignments
    DELETE ur FROM UserRoles ur JOIN #RoleMapping rm ON ur.RoleID = rm.OldRoleID;

    -- Insert new assignments (only if they don't already exist)
    INSERT INTO UserRoles (UserID, RoleID)
    SELECT tur.UserID, tur.RoleID
    FROM #TempUserRoles tur
    WHERE NOT EXISTS (
        SELECT 1 FROM UserRoles ur2 
        WHERE ur2.UserID = tur.UserID AND ur2.RoleID = tur.RoleID
    );

    -- 4. MIGRATE ROLE PERMISSIONS
    -- Copy assignments to be moved
    IF OBJECT_ID('tempdb..#TempRolePermissions') IS NOT NULL DROP TABLE #TempRolePermissions;
    SELECT DISTINCT PermissionID, rm.NewRoleID AS RoleID
    INTO #TempRolePermissions
    FROM RolePermissions rp
    JOIN #RoleMapping rm ON rp.RoleID = rm.OldRoleID;

    -- Delete old assignments
    DELETE rp FROM RolePermissions rp JOIN #RoleMapping rm ON rp.RoleID = rm.OldRoleID;

    -- Insert new assignments (only if they don't already exist)
    INSERT INTO RolePermissions (PermissionID, RoleID)
    SELECT trp.PermissionID, trp.RoleID
    FROM #TempRolePermissions trp
    WHERE NOT EXISTS (
        SELECT 1 FROM RolePermissions rp2 
        WHERE rp2.PermissionID = trp.PermissionID AND rp2.RoleID = trp.RoleID
    );

    -- 5. DELETE REDUNDANT ROLES
    DELETE FROM Roles
    WHERE RoleID IN (SELECT OldRoleID FROM #RoleMapping);

    -- 6. FINAL CLEANUP: Set Role Names exactly
    UPDATE Roles SET RoleName = 'ADMIN' WHERE RoleID = @AdminID;
    UPDATE Roles SET RoleName = 'IT' WHERE RoleID = @ItID;
    UPDATE Roles SET RoleName = 'HR' WHERE RoleID = @HrID;
    UPDATE Roles SET RoleName = 'Department Manager' WHERE RoleID = @DeptID;
    UPDATE Roles SET RoleName = 'Instructor' WHERE RoleID = @InstrID;
    UPDATE Roles SET RoleName = 'Employee' WHERE RoleID = @EmpID;

    COMMIT TRANSACTION;
    PRINT 'Roles cleanup and migration completed successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrorMessage, 16, 1);
END CATCH;

IF OBJECT_ID('tempdb..#RoleMapping') IS NOT NULL DROP TABLE #RoleMapping;
IF OBJECT_ID('tempdb..#TempUserRoles') IS NOT NULL DROP TABLE #TempUserRoles;
IF OBJECT_ID('tempdb..#TempRolePermissions') IS NOT NULL DROP TABLE #TempRolePermissions;
GO
 Broadway
