import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Lock, AlertCircle, CheckCircle } from 'lucide-react'

export default function Access() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  const onSubmit = (data) => {
    setMessageType('success')
    setMessage(`Welcome! SSO login initiated for ${data.email}`)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Lock className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Developer Studio</h1>
          <p className="text-muted mt-2">Secure enterprise access to your API catalog</p>
        </div>

        <div className="card-base p-8">
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              messageType === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
            }`}>
              {messageType === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email' }
                })}
                type="email"
                placeholder="you@company.com"
                className="input-base w-full"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                {...register('password', { required: 'Password is required' })}
                type="password"
                placeholder="••••••••"
                className="input-base w-full"
              />
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center">
              <input
                {...register('remember')}
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-input"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-muted">Remember this device</label>
            </div>

            <button type="submit" className="btn-primary w-full py-2.5 font-semibold">
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-center text-sm text-muted mb-3">Or continue with</p>
            <div className="space-y-2">
              <button className="btn-outline w-full py-2">Azure AD</button>
              <button className="btn-outline w-full py-2">Okta</button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted">
          <p>Enterprise-grade security with single sign-on</p>
          <p>Every action is audit-logged and traceable</p>
        </div>
      </div>
    </div>
  )
}
