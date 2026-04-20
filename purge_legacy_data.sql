-- BULLETPROOF PURGE LEGACY USER DATA (KEEP ONLY _TEST ACCOUNTS)
-- This version handles ownership transfers to prevent FK conflicts on shared content (Courses, etc.)

BEGIN TRANSACTION;
BEGIN TRY
    -- 1. Identify Target and Purge IDs
    DECLARE @NewAdminID INT = (SELECT TOP 1 UserID FROM Users WHERE Username = 'admin_test');
    
    IF OBJECT_ID('tempdb..#UsersToPurge') IS NOT NULL DROP TABLE #UsersToPurge;
    CREATE TABLE #UsersToPurge (UserID INT);
    INSERT INTO #UsersToPurge (UserID)
    SELECT UserID FROM Users 
    WHERE Username NOT LIKE '%_test' AND UserID <> @NewAdminID;

    -- 2. First Pass: Delete Multi-level Dependencies (Self-referencing or indirect)
    -- UserAnswers links to UserExams
    DELETE ua FROM UserAnswers ua
    JOIN UserExams ue ON ua.UserExamID = ue.UserExamID
    WHERE ue.UserID IN (SELECT UserID FROM #UsersToPurge);

    -- 3. Dynamic Handling of all 40+ FKs based on Column Semantics
    DECLARE @TableName NVARCHAR(255);
    DECLARE @ColumnName NVARCHAR(255);
    DECLARE @Sql NVARCHAR(MAX);

    DECLARE fk_cursor CURSOR FOR
    SELECT OBJECT_NAME(f.parent_object_id) AS TableName, COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName
    FROM sys.foreign_keys AS f
    INNER JOIN sys.foreign_key_columns AS fc ON f.OBJECT_ID = fc.constraint_object_id
    WHERE OBJECT_NAME(f.referenced_object_id) = 'Users';

    OPEN fk_cursor;
    FETCH NEXT FROM fk_cursor INTO @TableName, @ColumnName;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Ignore the Users table itself for now
        IF @TableName <> 'Users'
        BEGIN
            -- CASE A: Ownership/Metadata columns -> RE-ASSIGN to new Admin
            IF @ColumnName IN ('CreatedBy', 'UpdatedBy', 'InstructorID', 'TrainerID', 'AuthorID', 'ApproverID')
            BEGIN
                SET @Sql = 'UPDATE ' + QUOTENAME(@TableName) + ' SET ' + QUOTENAME(@ColumnName) + ' = ' + CAST(@NewAdminID AS NVARCHAR) + 
                           ' WHERE ' + QUOTENAME(@ColumnName) + ' IN (SELECT UserID FROM #UsersToPurge)';
                EXEC sp_executesql @Sql;
            END
            -- CASE B: Identity/Assignment columns -> DELETE record
            ELSE IF @ColumnName IN ('UserID', 'UserId', 'CandidateID', 'StudentID')
            BEGIN
                SET @Sql = 'DELETE FROM ' + QUOTENAME(@TableName) + ' WHERE ' + QUOTENAME(@ColumnName) + ' IN (SELECT UserID FROM #UsersToPurge)';
                EXEC sp_executesql @Sql;
            END
        END
        FETCH NEXT FROM fk_cursor INTO @TableName, @ColumnName;
    END

    CLOSE fk_cursor;
    DEALLOCATE fk_cursor;

    -- 4. Manual clean for known edge cases
    IF OBJECT_ID('SurveyResults') IS NOT NULL
        DELETE FROM SurveyResults WHERE UserId IN (SELECT UserID FROM #UsersToPurge);

    -- 5. Final Step: Delete the Users
    DELETE FROM Users WHERE UserID IN (SELECT UserID FROM #UsersToPurge);

    COMMIT TRANSACTION;
    PRINT 'Legacy user data purged. All content ownership transferred to Admin (ID ' + CAST(@NewAdminID AS VARCHAR) + ').';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrorMessage, 16, 1);
    
    IF CURSOR_STATUS('global', 'fk_cursor') >= 0
    BEGIN
        CLOSE fk_cursor;
        DEALLOCATE fk_cursor;
    END
END CATCH;

IF OBJECT_ID('tempdb..#UsersToPurge') IS NOT NULL DROP TABLE #UsersToPurge;
GO
