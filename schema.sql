-- =====================================================================
-- NESCAFÉ ROAST - SUPABASE BACKEND SCHEMA
-- =====================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com)
-- to initialize tables, row-level security, and authentication triggers.

-- 1. Create Profiles Table (to store custom user metadata synced from auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Allow public read-access to profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Allow users to insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);


-- 2. Create Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blend TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Reservations Policies
CREATE POLICY "Allow users to view their own reservations" ON public.reservations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own reservations" ON public.reservations
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 3. Sync User Meta on Registration (Postgres trigger function)
-- When a user registers via Supabase Auth with standard metadata (e.g. full_name),
-- this trigger will automatically insert a matching profile entry.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, updated_at)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nescafe Connoisseur'),
        now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
