# 📖 BIBLIA AGROSUPER — Panel de Auditoría POP

## 🏢 Contexto: ¿Quién es Agrosuper?

**Agrosuper** es una empresa de alimentos con productos en retail (supermercados, tiendas de barrio, etc.). Estos puntos de venta son su canal de distribución crítico.

El problema: **¿Está mi material POP donde debería estar?**

---

## 🎯 ¿Qué medimos?

### **Implementación de Material POP (Point of Purchase)**

Agrosuper audita **2 marcas propias + 2 espacios de implementación**:

#### **Marcas (interior del local)**
1. **LA CRIANZA** — Jamones/Embutidos Premium
   - Bandeja de Jamón LC
   - Logo Vitrina LC
   - Colgante de Recomendación LC

2. **SUPER CERDO** — Carnes/Procesados
   - Marca Precio SC
   - Huincha Precio SC

#### **Espacios de Implementación** (no marcas, son ubicaciones)
1. **PANADERÍA** — Área de pan/pastelería del local
   - Cartel de Panadería
   - Portabolsas
   - Bolsas de papel
   - Tenazas (2 unidades)

2. **FACHADA EXTERNA** — Exterior del local
   - Paloma (adesivo)
   - Cenefa LC
   - Bandera Muro LC
   - Bandera Rutera LC (con/sin mástil)

**Métrica clave**: Para cada local retail, se registra por material:
- ¿Está implementado? (Sí/No)
- ¿Vende productos? (marca: Sí/No)
- ¿Tiene stock? (marca: Sí/No)

---

## 📊 Pilares de Medición

**1 forma de auditoría**: Implementación POP en terreno (auditor en local)

### **Pilar: IMPLEMENTACIÓN POP**

**Estructura del formulario Datascope**:

#### **1. LA CRIANZA (Jamones/Embutidos Premium)**
| Material | Rango esperado | Campo formulario |
|----------|---|---|
| Bandeja de Jamón LC | 1-2 | `implementaste_bandeja_jamon_lc` |
| Logo Vitrina LC | 2-3 | `implementaste_logo_vitrina_lc` |
| Colgante de Recomendación LC | 1-2 | `implementaste_colgante_recomendacion_lc` |

*También valida*: ¿Vende? ¿Tiene stock?

#### **2. SUPER CERDO (Carnes/Procesados)**
| Material | Rango esperado | Campo formulario |
|----------|---|---|
| Marca Precio SC | 2-3 | `implementaste_marca_precio_sc` |
| Huincha Precio SC | 2-3 | `implementaste_huincha_precio_sc` |

*También valida*: ¿Vende? ¿Tiene stock?

#### **3. PAN (Panadería)**
| Material | Cantidad | Campo formulario |
|----------|---|---|
| Cartel de Panadería | 1 | `implementaste_cartel_panaderia` |
| Portabolsas | 1 | `instalaste_portabolsas` |
| Bolsas de papel | 1 paquete | `implementaste_bolsas_papel` |
| Tenazas | 2 | `entregaste_2_tenazas` |

*También valida*: ¿Vende Pan?

#### **4. FACHADA EXTERNA (Exterior del local)**
| Material | Cantidad | Campo formulario |
|----------|---|---|
| Paloma (Adesivo/Sticker) | 1 | `implementaste_paloma` |
| Cenefa LC | 2 | `implementaste_cenefa_lc` |
| Bandera Muro LC | 1 | `implementaste_bandera_muro_lc` |
| Bandera Rutera LC | 2 (con/sin mástil) | `implementaste_bandera_rutera_lc` |

#### **Métricas calculadas**
| Métrica | Descripción | Fórmula |
|---------|-------------|---------|
| **% Implementado** | Locales con al menos 1 material implementado | (Locales con 1+ items / Total) × 100 |
| **% Por Marca** | Implementación por cada marca (LC, SC, Pan, Fachada) | (Locales con marca X / Total) × 100 |
| **% Por Material** | Tasa de cada item individual | (Locales con item X / Total) × 100 |

---

## 🔗 Origen de Datos: DATASCOPE

**Datascope** es la plataforma de auditoría móvil que Agrosuper usa para recolectar datos.

### Flujo:
1. **Auditor en terreno** → abre app Datascope
2. **Responde formulario** (¿hay cartel? ¿bastidor? ¿condición?)
3. **Carga fotos** como evidencia
4. **Envía respuestas** → webhook a nuestro servidor

### Flujo: Datascope → n8n → Panel Agrosuper

**Arquitectura**:
```
Datascope (auditor llena formulario)
    ↓
n8n Webhook (recibe, valida, transforma)
    ↓
n8n Code Node (normaliza a estructura Agrosuper)
    ↓
n8n HTTP POST (envía a panel)
    ↓
Panel: POST /api/webhooks/agrosuper
    ↓
Base de datos:
  - agrosuper_audits (registro principal)
  - agrosuper_materials (respuesta por material)
    ↓
Cálculo de métricas (% implementación por marca/espacio)
```

**Configuración n8n**:

**Workflow**: `Agrosuper // Formulario DataScope` (ID: `NfVw2dOuSV26664b`)

**Nodos**:
1. **Webhook DataScope** — Recibe POST en path `/agrosuper`
2. **Transform Agrosuper** — Código JavaScript que mapea campos Datascope → estructura Agrosuper
3. **POST Panel Agrosuper** — Envía a `$env.PANEL_WEBHOOK_URL + /api/webhooks/agrosuper`

**Variables de entorno en n8n**:
```
PANEL_WEBHOOK_URL = https://tu-panel.com
AGROSUPER_WEBHOOK_SECRET = tu-secret-key
```

**Configuración en .env.local del panel**:
```
NEXT_PUBLIC_SUPABASE_URL = ...
SUPABASE_SERVICE_ROLE_KEY = ...
AGROSUPER_WEBHOOK_SECRET = mismo-valor-que-n8n
```

**Webhook n8n → Panel**:

```json
{
  "location_id": "3200243629",
  "location_name": "Miranda Inversiones SPA",
  "address": "Promoncaes 1384",
  "implementer_name": "Erik contreras",
  "local_status": "Abierto",
  "submitted_at": "2026-04-15T16:48:00Z",
  "form_number": 55,
  "company": "Treid SpA",
  "phone": "+56989992076",
  
  "answers": {
    "implementador": "Erik contreras",
    "foto_local": "https://...",
    
    "la_crianza": {
      "vende": true,
      "tiene_stock": true,
      "bandeja_jamon_lc": { "implementado": true, "foto": "https://..." },
      "logo_vitrina_lc": { "implementado": true, "foto": "https://..." },
      "colgante_recomendacion_lc": { "implementado": true, "foto": "https://..." }
    },
    
    "super_cerdo": {
      "vende": true,
      "tiene_stock": true,
      "marca_precio_sc": { "implementado": true, "foto": "https://..." },
      "huincha_precio_sc": { "implementado": true, "foto": "https://..." }
    },
    
    "pan": {
      "vende": true,
      "cartel_panaderia": { "implementado": false },
      "portabolsas": { "implementado": true, "foto": "https://..." },
      "bolsas_papel": { "implementado": true, "foto": "https://..." },
      "tenazas_2": { "implementado": true, "foto": "https://..." }
    },
    
    "fachada_externa": {
      "paloma": { "implementado": true, "foto": "https://..." },
      "cenefa_lc": { "implementado": true, "foto": "https://..." },
      "bandera_muro_lc": { "implementado": true, "foto": "https://..." },
      "bandera_rutera_lc": { "implementado": false }
    }
  }
}
```

---

## 🗂️ Estructura Base de Datos

### Tablas Agrosuper:

**`locations`** — Puntos de venta (Jumbo, Carrefour, tiendas independientes, etc.)
```
id (UUID), external_id (código Datascope), name, address, 
region, local_type, active, created_at, updated_at
```

**`agrosuper_audits`** — Auditorías Agrosuper ejecutadas
```
id, location_id, implementer_name, submitted_at, form_number,
company, phone, pdf_url, status (received/calculated),
implementation_rate (%), 
metrics_by_brand (JSON: {la_crianza: %, super_cerdo: %}),
metrics_by_space (JSON: {panaderia: %, fachada_externa: %}),
raw_payload (JSON completo), created_at, updated_at
```

**`agrosuper_materials`** — Respuesta por cada material (granular)
```
id, audit_id, brand (LA_CRIANZA/SUPER_CERDO/null),
space (INTERIOR/PANADERIA/FACHADA_EXTERNA),
material (BANDEJA_JAMON_LC, MARCA_PRECIO_SC, etc.),
implemented (boolean), vende (boolean, solo marcas),
tiene_stock (boolean, solo marcas), created_at
```

### Estructura de datos:

**JSON: `metrics_by_brand`**
```json
{
  "la_crianza": 100,      // % implementación
  "super_cerdo": 75
}
```

**JSON: `metrics_by_space`**
```json
{
  "panaderia": 50,         // % implementación
  "fachada_externa": 100
}
```

---

## 🧮 Cálculo de Métricas

### **Algoritmo**: Cuando llega auditoría desde n8n:

1. **Recibir y validar** webhook en `/api/webhooks/agrosuper`
2. **Crear/encontrar local** en `locations` por `external_id` (código Datascope)
3. **Grabar auditoría** principal en `agrosuper_audits`
4. **Grabar materiales** granular en `agrosuper_materials`:
   - Cada fila = 1 material (Bandeja Jamón, Marca Precio, etc.)
   - Columnas: audit_id, brand, space, material, implemented, vende, tiene_stock
5. **Calcular métricas**:
   ```
   LA_CRIANZA % = (materiales LC implementados / total materiales LC) × 100
   SUPER_CERDO % = (materiales SC implementados / total materiales SC) × 100
   PANADERIA % = (materiales panadería implementados / total panadería) × 100
   FACHADA % = (materiales fachada implementados / total fachada) × 100
   OVERALL % = (total implementados / total materiales) × 100
   ```
6. **Guardar métricas** en `agrosuper_audits.metrics_by_brand` y `metrics_by_space`

### **Validaciones**:
- Location existe o se crea
- Al menos 1 material respondido
- Fechas coherentes (submitted_at no puede ser futura)

---

## 📁 Estructura del Proyecto

```
src/
├── api/
│   ├── webhooks/datascope/       ← Recibe datos de Datascope
│   │   └── route.ts
│   ├── audits/
│   │   ├── calculate/            ← Calcula métricas
│   │   ├── [id]/review/          ← Revisión manual de auditoría
│   │   └── [id]/route.ts
│   ├── pop-items/                ← CRUD de material POP
│   ├── locations/                ← CRUD de puntos de venta
│   └── ...
├── (dashboard)/
│   ├── audits/                   ← Dashboard de auditorías
│   ├── analytics/                ← Gráficos de implementación
│   ├── pop-items/                ← Gestión de material POP
│   └── locations/                ← Gestión de locales
└── components/                   ← UI reutilizables
```

---

## 🔐 Validaciones Esperadas

Cuando procesa una auditoría:

1. **Location existe**: `location_id` debe estar registrado
2. **Auditor válido**: `auditor_id` debe pertenecer a un usuario activo
3. **Al menos 1 respuesta**: No puede haber auditoría vacía
4. **Fechas lógicas**: `submitted_at` no puede ser futura
5. **Fotos opcionales**: Si hay fotos, deben ser URLs válidas
6. **Condición coherente**: Si condición es "dañado", el item debe estar marcado como "sí"

---

## 🚀 Stack Técnico

- **Frontend**: Next.js 16 + React 19 + TailwindCSS
- **Backend**: API Routes de Next.js
- **DB**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Reporte**: XLSX + PDF
- **Gráficos**: Recharts
- **Integración**: Webhook Datascope

---

## 🎓 Notas de Diseño

1. **Auditoría = Transacción**: Cada respuesta de Datascope = 1 auditoría por local
2. **Múltiples formas futuras**: Aunque hoy es 1, el código está listo para agregar más cuestionarios
3. **Revisión humana**: Las auditorías pueden marcarse para revisión (error de auditor, inconsistencia)
4. **Histórico**: Guardamos TODAS las auditorías para tracking de implementación en el tiempo
5. **Descarga**: Podemos exportar auditorías a XLSX/PDF para reportes ejecutivos

---

## ✅ Checklist de Configuración

### **1. Variables de Entorno n8n**
En tu workspace n8n (nicolasclementg.app.n8n.cloud):
- [ ] `PANEL_WEBHOOK_URL` = URL de tu panel (ej: `https://agrosuper.tudominio.com`)
- [ ] `AGROSUPER_WEBHOOK_SECRET` = Token secreto (ej: `super-secret-key-123`)

### **2. Variables de Entorno Panel (.env.local)**
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
AGROSUPER_WEBHOOK_SECRET=super-secret-key-123  # Mismo que n8n
```

### **3. Base de Datos**
Necesitas estas tablas en Supabase:
```sql
-- locations (tabla existente, solo agregar campos si faltan)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS external_id VARCHAR;

-- Nueva tabla para auditorías Agrosuper
CREATE TABLE agrosuper_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id),
  implementer_name TEXT,
  submitted_at TIMESTAMP,
  form_number INT,
  company TEXT,
  phone TEXT,
  pdf_url TEXT,
  status VARCHAR DEFAULT 'received',
  implementation_rate INT,
  metrics_by_brand JSONB,  -- {la_crianza: %, super_cerdo: %}
  metrics_by_space JSONB,  -- {panaderia: %, fachada_externa: %}
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Nueva tabla para respuestas granulares
CREATE TABLE agrosuper_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES agrosuper_audits(id),
  brand VARCHAR,  -- LA_CRIANZA, SUPER_CERDO, null
  space VARCHAR,  -- INTERIOR, PANADERIA, FACHADA_EXTERNA
  material VARCHAR,  -- BANDEJA_JAMON_LC, MARCA_PRECIO_SC, etc.
  implemented BOOLEAN,
  vende BOOLEAN,
  tiene_stock BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **4. Activar Workflow en n8n**
- [ ] Ir a `Agrosuper // Formulario DataScope` 
- [ ] Copiar la URL del webhook: `https://nicolasclementg.app.n8n.cloud/webhook/agrosuper`
- [ ] En Datascope form settings, agregar webhook a esa URL
- [ ] Activar el workflow (toggle en la UI)
- [ ] Enviar test desde Datascope

### **5. Próximas Features**
- [ ] Dashboard: % implementación por local/región/marca
- [ ] Reportes: CSV/PDF con resumen por período
- [ ] Alertas: Si implementación < meta en algún local
- [ ] Histórico: Tracking de mejora en el tiempo
- [ ] Fotos: Adjuntar evidencia fotográfica desde Datascope
