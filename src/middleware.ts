import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login']
const PUBLIC_API_PREFIXES = ['/api/users/count', '/api/onboarding/complete']

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true
  }

  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isOnboardingPath = pathname.startsWith('/onboarding')
  const isPublic = isPublicPath(pathname)

  if (!user) {
    if (isOnboardingPath) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .maybeSingle()

  const onboardingComplete = profile?.onboarding_completed === true

  if (pathname === '/login') {
    return NextResponse.redirect(
      new URL(onboardingComplete ? '/' : '/onboarding', request.url)
    )
  }

  if (isOnboardingPath && onboardingComplete) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!onboardingComplete && !isOnboardingPath && !isPublic) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
