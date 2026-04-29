import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Recuperar Contraseña</CardTitle>
        <CardDescription>
          Contacta al administrador Treid para restablecer tu contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/login">
          <Button variant="outline">Volver al Login</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
