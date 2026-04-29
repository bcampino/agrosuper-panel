# Agrosuper Panel - Deployment Checklist

## ✅ COMPLETADO

### 1. Dashboard UI
- [x] Página principal con métricas
- [x] Lista de auditorías
- [x] Detalle de auditoría
- [x] Gráficos (Recharts)
- [x] Componente Button con asChild support (usa Slot de @radix-ui/react-slot)
- [x] Componente utilidad cn() en src/lib/utils.ts

### 2. Datos Mock
- [x] src/lib/mock-data.ts (5 auditorías con materiales)
- [x] src/lib/agrosuper-metrics.ts (funciones de cálculo)
- [x] src/types/agrosuper.ts (interfaces)

### 3. Supabase
- [x] Proyecto creado (ID: gsqmdlirbsthphtakryn)
- [x] Tablas SQL ejecutadas:
  - locations
  - agrosuper_audits
  - agrosuper_materials
- [x] .env.local configurado con credenciales

### 4. n8n Webhook
- [x] Workflow "Agrosuper // Formulario DataScope" (ID: NfVw2dOuSV26664b) activado
- [x] URL webhook: https://nicolasclementg.app.n8n.cloud/webhook/agrosuper
- [x] Test webhook enviado desde PowerShell → n8n recibió correctamente

### 5. GitHub
- [x] Repositorio limpio (bcampino/agrosuper-panel)
- [x] .gitignore configurado para excluir node_modules/ y .next/
- [x] Código pusheado a main

### 6. Variables de Entorno
Todos los valores están en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://gsqmdlirbsthphtakryn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[tu-service-role-key]
AGROSUPER_WEBHOOK_SECRET=agrosuper-secret-key-2026
```

---

## ⏳ PARA MAÑANA - VERCEL DEPLOYMENT

### Paso 1: Crear Nuevo Proyecto en Vercel
1. Ve a https://vercel.com/new
2. Autoriza GitHub (click "Add GitHub Account")
3. Busca y selecciona: **bcampino/agrosuper-panel**
4. Click **Import**

### Paso 2: Configurar Environment Variables en Vercel
En la pantalla de configuración:
1. **NEXT_PUBLIC_SUPABASE_URL** = `https://gsqmdlirbsthphtakryn.supabase.co`
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY** = [copia de .env.local]
3. **SUPABASE_SERVICE_ROLE_KEY** = [copia de .env.local]
4. **AGROSUPER_WEBHOOK_SECRET** = `agrosuper-secret-key-2026`

### Paso 3: Deploy
- Click **Deploy**
- Espera a que termine (2-3 minutos)
- Vercel te dará una URL como: `https://agrosuper-panel-xxx.vercel.app`

### Paso 4: Actualizar n8n con la URL de Vercel
1. Ve a n8n Settings → Variables
2. Actualiza **PANEL_WEBHOOK_URL** con la URL de Vercel (sin trailing slash)
3. Guarda

### Paso 5: Probar Webhook End-to-End
1. Envía test desde PowerShell:
```powershell
$body = @{
    location_id = "test-123"
    location_name = "Local Test Vercel"
    implementer_name = "Erik"
    submitted_at = "2026-04-27T10:00:00Z"
    form_number = 1
    company = "Test Co"
    phone = "+56989992076"
    answers = @{
        la_crianza = @{
            vende = $true
            tiene_stock = $true
            bandeja_jamon_lc = @{ implementado = $true }
        }
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://agrosuper-panel-xxx.vercel.app/api/webhooks/agrosuper" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "X-Webhook-Secret"="agrosuper-secret-key-2026"} `
  -Body $body
```

2. Verifica en Supabase que el dato llegó a agrosuper_audits
3. Abre https://agrosuper-panel-xxx.vercel.app/agrosuper para ver el dashboard

---

## 🔗 URLs Importantes
- **Panel Local**: http://localhost:3003/agrosuper
- **Supabase**: https://supabase.com/dashboard/project/gsqmdlirbsthphtakryn
- **n8n**: https://nicolasclementg.app.n8n.cloud
- **Datascope Integraciones**: https://app.mydatascope.com/integrations
- **GitHub**: https://github.com/bcampino/agrosuper-panel

---

## 📝 Notas
- El dashboard actualmente muestra datos MOCK
- Una vez que Datascope envíe auditorías reales → n8n → Vercel, aparecerán en el dashboard
- Regenera las keys de Supabase si las compartiste (ya no están en el repo)
