// PostgreSQL Connection Pool Manager
const { Pool } = require('pg');

let pool;
let schemaInitialized = false;

function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
        
        pool = new Pool({
            connectionString: connectionString,
            ssl: connectionString && connectionString.includes('localhost') 
                ? false 
                : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
        });
    }
    return pool;
}

// Helper for single query execution with automatic first-time table initialization
async function query(text, params) {
    const p = getPool();

    // Auto-initialize schema once if not already initialized
    if (!schemaInitialized) {
        try {
            await initSchemaInternal(p);
            schemaInitialized = true;
        } catch (e) {
            console.error('Schema initialization failed:', e);
            throw e;
        }
    }

    const start = Date.now();
    try {
        const res = await p.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('Executed query', { text: text.substring(0, 80), duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Database Schema Initialization Script
async function initSchemaInternal(poolClient) {
    const schemaSql = `
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        -- Users Table
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            register_number VARCHAR(32) UNIQUE NOT NULL,
            full_name VARCHAR(128) NOT NULL,
            email VARCHAR(128) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(16) NOT NULL DEFAULT 'student',
            department VARCHAR(64) DEFAULT 'CSE',
            section VARCHAR(16),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Experiments Catalog Table
        CREATE TABLE IF NOT EXISTS experiments (
            id INT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            aim TEXT NOT NULL,
            total_stages INT DEFAULT 5,
            is_active BOOLEAN DEFAULT TRUE
        );

        -- Insert default experiments catalog if empty
        INSERT INTO experiments (id, title, aim, total_stages) VALUES
            (1, 'Study of Network Cables, Network Commands & PT UI', 'To study and perform identification of network cables, IP networking commands, and explore the Cisco Packet Tracer user interface.', 3),
            (2, 'Study of IP Addressing & Cable Pinout Construction', 'To study IP addressing and construct straight-through and crossover cables using T568A/T568B standards.', 4),
            (3, 'Router Configuration Through a Console', 'To establish a console session with a Cisco router, configure basic settings, passwords, and interface parameters using Cisco IOS CLI.', 4),
            (4, 'Design of Subnet IP Addressing in Packet Tracer', 'To design, configure, and verify IPv4 subnets across dual routers with static routing in a simulated WAN.', 4),
            (5, 'Demonstration of Static and Default Routing', 'To configure, verify, and compare static routing and quad-zero default routing across dual Cisco routers in a WAN topology.', 5)
        ON CONFLICT (id) DO NOTHING;

        -- Experiment Progress Table
        CREATE TABLE IF NOT EXISTS experiment_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id UUID REFERENCES users(id) ON DELETE CASCADE,
            experiment_id INT REFERENCES experiments(id),
            status VARCHAR(32) DEFAULT 'not_started',
            progress_percentage INT DEFAULT 0,
            completed_milestones JSONB DEFAULT '[]'::jsonb,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            last_activity TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            UNIQUE(student_id, experiment_id)
        );

        -- Simulation Meaningful Event Logs Table
        CREATE TABLE IF NOT EXISTS simulation_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id UUID REFERENCES users(id) ON DELETE CASCADE,
            experiment_id INT REFERENCES experiments(id),
            stage VARCHAR(64) NOT NULL,
            event_type VARCHAR(64) NOT NULL,
            event_payload JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Quiz Attempts Table
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id UUID REFERENCES users(id) ON DELETE CASCADE,
            experiment_id INT REFERENCES experiments(id),
            attempt_number INT NOT NULL,
            score INT NOT NULL,
            total_questions INT NOT NULL,
            answers_summary JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Certificates Table
        CREATE TABLE IF NOT EXISTS certificates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            certificate_code VARCHAR(64) UNIQUE NOT NULL,
            student_id UUID REFERENCES users(id) ON DELETE CASCADE,
            experiment_id INT REFERENCES experiments(id),
            final_score INT NOT NULL,
            issued_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(student_id, experiment_id)
        );

        -- Classrooms Table (Persistent Faculty Courses/Sections)
        CREATE TABLE IF NOT EXISTS classrooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            faculty_id UUID REFERENCES users(id) ON DELETE CASCADE,
            classroom_code VARCHAR(16) UNIQUE NOT NULL,
            name VARCHAR(128) NOT NULL,
            section VARCHAR(32) NOT NULL,
            academic_year VARCHAR(16) DEFAULT '2025-2026',
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Classroom Members Table (Student Enrollments & Lifecycle)
        CREATE TABLE IF NOT EXISTS classroom_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
            student_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(16) NOT NULL DEFAULT 'active',
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            left_at TIMESTAMPTZ,
            last_active TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(classroom_id, student_id)
        );

        -- Performance Indexes for High Concurrency (300+ Simultaneous Students)
        CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom ON classroom_members(classroom_id);
        CREATE INDEX IF NOT EXISTS idx_classroom_members_student ON classroom_members(student_id);
        CREATE INDEX IF NOT EXISTS idx_classrooms_faculty ON classrooms(faculty_id);
        CREATE INDEX IF NOT EXISTS idx_sim_events_student_exp ON simulation_events(student_id, experiment_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_exp ON quiz_attempts(student_id, experiment_id);
        CREATE INDEX IF NOT EXISTS idx_exp_progress_student_exp ON experiment_progress(student_id, experiment_id);
        CREATE INDEX IF NOT EXISTS idx_certificates_student_exp ON certificates(student_id, experiment_id);
    `;
    return poolClient.query(schemaSql);
}

module.exports = {
    getPool,
    query,
    initSchema: async () => initSchemaInternal(getPool())
};
