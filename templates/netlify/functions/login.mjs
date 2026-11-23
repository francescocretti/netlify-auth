import { loginHandler } from '@francescocretti/netlify-auth/netlify'
import { auth } from './_auth-config.mjs'

export default loginHandler(auth)
