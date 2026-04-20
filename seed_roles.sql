-- SEED ROLES FOR RBAC RESTRUCTURE
-- Roles: ADMIN, IT, HR, Department Manager, Instructor, Employee

IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'ADMIN')
    INSERT INTO Roles (RoleName) VALUES ('ADMIN');

IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'IT')
    INSERT INTO Roles (RoleName) VALUES ('IT');

IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'HR')
    INSERT INTO Roles (RoleName) VALUES ('HR');

IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'Department Manager')
    INSERT INTO Roles (RoleName) VALUES ('Department Manager');

IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'Instructor')
    INSERT INTO Roles (RoleName) VALUES ('Instructor');

IF NOT EXISTS (SELECT * FROM Roles WHERE RoleName = 'Employee')
    INSERT INTO Roles (RoleName) VALUES ('Employee');

-- Consistency Check / Data Cleanup (Optional)
-- UPDATE Roles SET RoleName = 'Department Manager' WHERE RoleName = 'Manager' OR RoleName = 'DEPT ADMIN';
