import { createAuth } from '@francescocretti/netlify-auth'

// Keep project-specific settings in one place and import this same instance
// from login, logout, session, and every protected function.
export const auth = createAuth({
  realm: 'Your App',
})
