-- ============================================================
-- Harvee Designs - Full Stack Developer Assessment
-- Combined Database Schema (Task 1 + Task 2)
-- Database: PostgreSQL
-- ============================================================

-- ============================================================
-- TASK 1: AI-Powered Student Course Allocation System
-- ============================================================

CREATE TYPE category_type AS ENUM ('General', 'OBC', 'SC', 'ST');
CREATE TYPE allocation_status AS ENUM ('ALLOCATED', 'REJECTED', 'PENDING');

-- Courses offered by the university
CREATE TABLE courses (
    course_id       SERIAL PRIMARY KEY,
    course_name     VARCHAR(150) NOT NULL UNIQUE,
    total_seats     INTEGER NOT NULL CHECK (total_seats > 0),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category-wise reserved seats per course (normalized instead of columns per category)
CREATE TABLE course_reservations (
    reservation_id  SERIAL PRIMARY KEY,
    course_id       INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    category        category_type NOT NULL,
    reserved_seats  INTEGER NOT NULL CHECK (reserved_seats >= 0),
    filled_seats    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (course_id, category)
);

-- Students who applied
CREATE TABLE students (
    student_id       SERIAL PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    marks            NUMERIC(5,2) NOT NULL CHECK (marks >= 0 AND marks <= 100),
    category         category_type NOT NULL,
    application_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student's ranked course preferences (Priority 1,2,3...)
CREATE TABLE student_preferences (
    preference_id   SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    course_id       INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    priority        SMALLINT NOT NULL CHECK (priority > 0),
    UNIQUE (student_id, priority),
    UNIQUE (student_id, course_id)
);

-- Final allocation result per student (one row per student, one course max — per business rule)
CREATE TABLE allocations (
    allocation_id     SERIAL PRIMARY KEY,
    student_id        INTEGER NOT NULL UNIQUE REFERENCES students(student_id) ON DELETE CASCADE,
    course_id         INTEGER REFERENCES courses(course_id) ON DELETE SET NULL,
    allocated_priority SMALLINT,  -- which preference number got fulfilled (NULL if rejected)
    status            allocation_status NOT NULL DEFAULT 'PENDING',
    processed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_marks ON students (marks DESC, application_date ASC);
CREATE INDEX idx_preferences_student ON student_preferences (student_id, priority);
CREATE INDEX idx_allocations_course ON allocations (course_id);

-- ============================================================
-- TASK 2: AI SQL Assistant (Dynamic Dataset Upload + NL to SQL)
-- ============================================================

-- Metadata for every uploaded dataset
CREATE TABLE datasets (
    dataset_id      SERIAL PRIMARY KEY,
    dataset_name    VARCHAR(150) NOT NULL,
    table_name      VARCHAR(100) NOT NULL UNIQUE, -- actual dynamically created table name e.g. ds_1_sales
    original_filename VARCHAR(255),
    row_count       INTEGER DEFAULT 0,
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Column-level schema detected for each dataset (for validation + AI context)
CREATE TABLE dataset_columns (
    column_id       SERIAL PRIMARY KEY,
    dataset_id      INTEGER NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    column_name     VARCHAR(100) NOT NULL,
    inferred_type   VARCHAR(50) NOT NULL, -- TEXT, INTEGER, NUMERIC, DATE, BOOLEAN
    ordinal_position SMALLINT NOT NULL,
    UNIQUE (dataset_id, column_name)
);

-- History of natural language questions -> generated SQL -> results
CREATE TABLE query_history (
    query_id        SERIAL PRIMARY KEY,
    dataset_id      INTEGER NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    user_question   TEXT NOT NULL,
    generated_sql   TEXT NOT NULL,
    was_valid       BOOLEAN NOT NULL DEFAULT TRUE,
    error_message   TEXT,
    row_count_returned INTEGER,
    executed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_history_dataset ON query_history (dataset_id, executed_at DESC);

-- NOTE: Actual uploaded data is stored in dynamically created tables (e.g. ds_1_sales_data)
-- generated at runtime by the backend based on detected CSV/Excel schema. These are NOT
-- fixed in this schema file since their structure varies per upload.
