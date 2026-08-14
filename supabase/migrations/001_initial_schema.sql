-- Productive OS - Supabase Database Schema Migration
-- Migration 001: Initial Schema, Indexes & Row Level Security (RLS) Policies

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 1. PROFILES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

--------------------------------------------------------------------------------
-- 2. WORKSPACES & MEMBERS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners & members can SELECT workspaces" ON public.workspaces
    FOR SELECT USING (
        auth.uid() = owner_id OR 
        EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = id AND user_id = auth.uid())
    );

CREATE POLICY "Workspace owners can INSERT workspaces" ON public.workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Workspace owners can UPDATE workspaces" ON public.workspaces
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Workspace owners can DELETE workspaces" ON public.workspaces
    FOR DELETE USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace membership" ON public.workspace_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
    );

--------------------------------------------------------------------------------
-- 3. PROJECTS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#38BDF8',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 4. GOALS & KEY RESULTS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    quarter TEXT DEFAULT 'Q3 2026',
    timeframe TEXT,
    progress INT DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'In Progress' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals" ON public.goals
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_value NUMERIC NOT NULL,
    current_value NUMERIC DEFAULT 0 NOT NULL,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage key results" ON public.key_results
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 5. TASKS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'work',
    status TEXT DEFAULT 'PENDING' NOT NULL,
    priority TEXT DEFAULT 'HIGH' NOT NULL,
    due_date DATE,
    due_time TIME,
    is_daily BOOLEAN DEFAULT FALSE,
    streak INT DEFAULT 0,
    estimate_mins INT DEFAULT 60,
    completed_at TIMESTAMPTZ,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks" ON public.tasks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 6. HABITS & HABIT LOGS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    frequency TEXT DEFAULT 'DAILY',
    target INT DEFAULT 1,
    color TEXT DEFAULT '#38BDF8',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage habits" ON public.habits
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT TRUE NOT NULL,
    value INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage habit logs" ON public.habit_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 7. NOTES
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Work',
    content TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their notes" ON public.notes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 8. CALENDAR EVENTS & TIME BLOCKS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    color TEXT DEFAULT '#38BDF8',
    category TEXT DEFAULT 'work',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage calendar events" ON public.calendar_events
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT DEFAULT 60 NOT NULL,
    type TEXT DEFAULT 'focus',
    color TEXT DEFAULT '#38BDF8',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage time blocks" ON public.time_blocks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 9. USER SETTINGS
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    accent_color TEXT DEFAULT '#38BDF8',
    clock_style TEXT DEFAULT 'apple',
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage user_settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON public.tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON public.notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON public.notes(deleted_at);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON public.time_blocks(date);

--------------------------------------------------------------------------------
-- AUTOMATIC TRIGGER REGISTRATION FOR UPDATED_AT
--------------------------------------------------------------------------------
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspaces_modtime BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_modtime BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_modtime BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_key_results_modtime BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_modtime BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_habits_modtime BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_modtime BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_modtime BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_blocks_modtime BEFORE UPDATE ON public.time_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_modtime BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
