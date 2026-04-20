export function getAppBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export function getAuthCallbackUrl(nextPath = '/dashboard') {
  const url = new URL('/auth/callback', getAppBaseUrl())
  url.searchParams.set('next', nextPath)
  return url.toString()
}

export function getResetPasswordUrl() {
  return new URL('/auth/reset-password', getAppBaseUrl()).toString()
}