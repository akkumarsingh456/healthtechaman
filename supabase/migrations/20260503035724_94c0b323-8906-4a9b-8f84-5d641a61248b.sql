UPDATE public.students SET photo_url = 'https://chsjhycuuwrlluwlumfb.supabase.co/storage/v1/object/public/student-photos/6f7fa8bf-d4c9-444c-87e6-d98580d87778/profile.png?t=' || extract(epoch from now())::bigint, full_name = 'Annie' WHERE id = '48e54580-1cc9-4910-993c-d9628a8c4c7b';

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Annie', 'display_name', 'Annie')
WHERE id = '6f7fa8bf-d4c9-444c-87e6-d98580d87778';