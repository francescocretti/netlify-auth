import { sessionHandler } from '@francescocretti/netlify-auth/netlify'
import { auth } from './_auth-config.mjs'

export default sessionHandler(auth)
