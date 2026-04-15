import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // Always allow: static assets, API routes, auth flow
  const isPublic =
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth') ||
    pathname === '/favicon.ico'

  if (isPublic) return response

  const isLoginPage = pathname.startsWith('/login')

  // Allow guests — guestName cookie is a session cookie (deleted when browser closes)
  const hasGuestCookie = !!request.cookies.get('guestName')?.value

  // Unauthenticated and not a guest → go to login
  if (!session && !hasGuestCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already authenticated and on login page → go home
  if ((session || hasGuestCookie) && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|mp3|mp4|wav|pdf)$).*)'],
}
