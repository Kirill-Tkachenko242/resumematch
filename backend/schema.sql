-- 1. Users: candidates, companies and admins in one table
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('candidate', 'company', 'admin')),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 2. Admin-configurable matching rules per job category
CREATE TABLE job_categories (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,   -- e.g. 'Software Engineer'
  accepted_degrees JSONB DEFAULT '[]',            -- ["Computer Science", "Software Engineering"]
  skill_weights    JSONB DEFAULT '{}'             -- {"Python": 35, "SQL": 25}
);

-- 3. Resumes (one per uploaded document "family")
CREATE TABLE resumes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(150),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 4. Resume versions (each upload/edit = new version)
CREATE TABLE resume_versions (
  id               SERIAL PRIMARY KEY,
  resume_id        INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  version_number   INTEGER NOT NULL,
  file_name        VARCHAR(255),
  parsed_text      TEXT,
  structured_data  JSONB,                         -- skills, experience, education from Claude
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE (resume_id, version_number)
);

-- 5. Job postings created by companies
CREATE TABLE job_postings (
  id                      SERIAL PRIMARY KEY,
  company_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id             INTEGER REFERENCES job_categories(id),
  title                   VARCHAR(150) NOT NULL,
  description             TEXT NOT NULL,
  structured_requirements JSONB,                  -- extracted by Claude
  status                  VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at              TIMESTAMP DEFAULT NOW()
);

-- 6. Applications: a candidate applies to a job with a specific resume version
CREATE TABLE applications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id            INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  resume_version_id INTEGER NOT NULL REFERENCES resume_versions(id),
  status            VARCHAR(20) DEFAULT 'submitted',
  created_at        TIMESTAMP DEFAULT NOW()
);

-- 7. Match score history: every analysis result is stored
CREATE TABLE match_scores (
  id                SERIAL PRIMARY KEY,
  resume_version_id INTEGER NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
  job_id            INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,  -- NULL if candidate pasted own text
  job_text          TEXT,                                                    -- the pasted description in that case
  application_id    INTEGER REFERENCES applications(id) ON DELETE SET NULL,
  overall_score     NUMERIC(5,2) NOT NULL,
  category_scores   JSONB,                        -- {"skills": 88, "experience": 80, "keywords": 84}
  explanation       JSONB,                        -- text explanation per category
  created_at        TIMESTAMP DEFAULT NOW()
);