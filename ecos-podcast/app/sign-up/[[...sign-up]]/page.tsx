import { SignUp } from '@clerk/nextjs'
import { brand } from '@/lib/config/brand'

export const metadata = { title: `Crear cuenta · ${brand.name}` }

export default function SignUpPage() {
  return (
    <section className="spotlight-bg min-h-[100vh] pt-28 pb-16 flex items-center">
      <div className="container-page flex flex-col items-center">
        <h1 className="mb-8 font-serif text-4xl italic text-cream-50">Creá tu cuenta</h1>
        <SignUp signInUrl="/sign-in" />
      </div>
    </section>
  )
}
