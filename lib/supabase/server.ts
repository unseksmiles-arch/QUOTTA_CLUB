
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieItem = {
  name: string;
  value: string;
  options?: Parameters<
    Awaited<ReturnType<typeof cookies>>['set']
  >[2];
};

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: CookieItem[]) {
          try {
            items.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies.
          }
        },
      },
    }
  );
}
