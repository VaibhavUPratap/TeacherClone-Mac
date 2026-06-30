-- Migration: Google OAuth role upsert support
-- Allows users to INSERT their own profile row (needed for first-time Google sign-in
-- where the trigger may have already run but the role needs updating via the app).

-- Allow users to insert their own profile row (idempotent: drop first, then create)
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Update the handle_new_user trigger to use ON CONFLICT DO UPDATE
-- so that re-signing in via Google still sets the role if it was previously NULL.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'role', 'student')
    )
    ON CONFLICT (id) DO UPDATE
        SET
            -- Only overwrite role when the existing value is NULL (preserves intentional roles)
            role      = COALESCE(profiles.role, EXCLUDED.role),
            full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
