import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || "strix-super-secret-key-change-in-prod";
const encodedKey = new TextEncoder().encode(secretKey);

const protectedApiPrefix = '/api'
const publicApiPrefixes = ['/api/auth', '/api/docs', '/api-docs']

// Helper to check if API path should be protected
function isProtectedApi(pathname: string) {
  if (!pathname.startsWith(protectedApiPrefix)) return false
  if (pathname.startsWith('/api/logs')) return true
  return !publicApiPrefixes.some(prefix => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public pages
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.next()
  }

  // Next.js static assets and internal requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // like .css, .js files
  ) {
    return NextResponse.next()
  }

  // Check auth cookie
  const sessionToken = request.cookies.get('strix_session')?.value
  const schedulerKey = request.headers.get('x-scheduler-secret')
  let isAuthenticated = false
  let userRole = 'USER'

  if (schedulerKey === "internal_scheduler_secret") {
    isAuthenticated = true
    userRole = 'ADMIN' // Allow scheduler to act as ADMIN
  } else if (sessionToken) {
    try {
      const verified = await jwtVerify(sessionToken, encodedKey, {
        algorithms: ["HS256"],
      })
      isAuthenticated = true
      userRole = verified.payload.role as string
    } catch (e) {
      // Invalid token
    }
  }

  // API Route Protection
  if (isProtectedApi(pathname)) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // RBAC for APIs
    if (pathname.startsWith('/api/logs') && userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    return NextResponse.next()
  }

  // UI Route Protection (Anything else not public)
  if (!isAuthenticated && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // RBAC for UI
  if (isAuthenticated && (pathname.startsWith('/logs') || pathname.startsWith('/api-docs'))) {
    if (userRole !== 'ADMIN') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
