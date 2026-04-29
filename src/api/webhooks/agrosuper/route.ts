import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Validar webhook secret
    const providedSecret = req.headers.get('x-webhook-secret');
    if (providedSecret !== process.env.AGROSUPER_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await req.json();

    // 1. Validar que location existe o crear
    const { data: location, error: locError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('external_id', payload.location_id)
      .single();

    let locationId = location?.id;

    if (locError || !location) {
      const { data: newLoc, error: createErr } = await supabase
        .from('locations')
        .insert({
          external_id: payload.location_id,
          name: payload.location_name,
          address: payload.address,
          region: 'Chile', // Default
          local_type: 'retail',
        })
        .select('id')
        .single();

      if (createErr) {
        return NextResponse.json(
          { error: 'Cannot create location', details: createErr.message },
          { status: 400 }
        );
      }

      locationId = newLoc!.id;
    }

    // 2. Grabar auditoría
    const { data: audit, error: auditErr } = await supabase
      .from('agrosuper_audits')
      .insert({
        location_id: locationId,
        implementer_name: payload.implementer_name,
        submitted_at: payload.submitted_at,
        form_number: payload.form_number,
        company: payload.company,
        phone: payload.phone,
        pdf_url: payload.pdf_url,
        raw_payload: payload,
        status: 'received',
      })
      .select('id')
      .single();

    if (auditErr || !audit) {
      return NextResponse.json(
        { error: 'Cannot create audit', details: auditErr?.message },
        { status: 400 }
      );
    }

    // 3. Grabar respuestas por material
    const answers = payload.answers || {};
    const materialAnswers: any[] = [];

    // LA CRIANZA
    if (answers.la_crianza) {
      const lc = answers.la_crianza;
      if (lc.bandeja_jamon_lc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: 'LA_CRIANZA',
          space: 'INTERIOR',
          material: 'BANDEJA_JAMON_LC',
          implemented: lc.bandeja_jamon_lc.implementado,
          vende: lc.vende,
          tiene_stock: lc.tiene_stock,
        });
      }
      if (lc.logo_vitrina_lc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: 'LA_CRIANZA',
          space: 'INTERIOR',
          material: 'LOGO_VITRINA_LC',
          implemented: lc.logo_vitrina_lc.implementado,
          vende: lc.vende,
          tiene_stock: lc.tiene_stock,
        });
      }
      if (lc.colgante_recomendacion_lc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: 'LA_CRIANZA',
          space: 'INTERIOR',
          material: 'COLGANTE_RECOMENDACION_LC',
          implemented: lc.colgante_recomendacion_lc.implementado,
          vende: lc.vende,
          tiene_stock: lc.tiene_stock,
        });
      }
    }

    // SUPER CERDO
    if (answers.super_cerdo) {
      const sc = answers.super_cerdo;
      if (sc.marca_precio_sc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: 'SUPER_CERDO',
          space: 'INTERIOR',
          material: 'MARCA_PRECIO_SC',
          implemented: sc.marca_precio_sc.implementado,
          vende: sc.vende,
          tiene_stock: sc.tiene_stock,
        });
      }
      if (sc.huincha_precio_sc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: 'SUPER_CERDO',
          space: 'INTERIOR',
          material: 'HUINCHA_PRECIO_SC',
          implemented: sc.huincha_precio_sc.implementado,
          vende: sc.vende,
          tiene_stock: sc.tiene_stock,
        });
      }
    }

    // PAN (espacio de implementación, no marca)
    if (answers.pan) {
      const pan = answers.pan;
      if (pan.cartel_panaderia) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'PANADERIA',
          material: 'CARTEL_PANADERIA',
          implemented: pan.cartel_panaderia.implementado,
          vende: pan.vende,
          tiene_stock: null,
        });
      }
      if (pan.portabolsas) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'PANADERIA',
          material: 'PORTABOLSAS',
          implemented: pan.portabolsas.implementado,
          vende: pan.vende,
          tiene_stock: null,
        });
      }
      if (pan.bolsas_papel) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'PANADERIA',
          material: 'BOLSAS_PAPEL',
          implemented: pan.bolsas_papel.implementado,
          vende: pan.vende,
          tiene_stock: null,
        });
      }
      if (pan.tenazas_2) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'PANADERIA',
          material: 'TENAZAS_2',
          implemented: pan.tenazas_2.implementado,
          vende: pan.vende,
          tiene_stock: null,
        });
      }
    }

    // FACHADA EXTERNA
    if (answers.fachada_externa) {
      const fachada = answers.fachada_externa;
      if (fachada.paloma) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'FACHADA_EXTERNA',
          material: 'PALOMA',
          implemented: fachada.paloma.implementado,
          vende: null,
          tiene_stock: null,
        });
      }
      if (fachada.cenefa_lc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'FACHADA_EXTERNA',
          material: 'CENEFA_LC',
          implemented: fachada.cenefa_lc.implementado,
          vende: null,
          tiene_stock: null,
        });
      }
      if (fachada.bandera_muro_lc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'FACHADA_EXTERNA',
          material: 'BANDERA_MURO_LC',
          implemented: fachada.bandera_muro_lc.implementado,
          vende: null,
          tiene_stock: null,
        });
      }
      if (fachada.bandera_rutera_lc) {
        materialAnswers.push({
          audit_id: audit.id,
          brand: null,
          space: 'FACHADA_EXTERNA',
          material: 'BANDERA_RUTERA_LC',
          implemented: fachada.bandera_rutera_lc.implementado,
          vende: null,
          tiene_stock: null,
        });
      }
    }

    // Insertar respuestas
    if (materialAnswers.length > 0) {
      const { error: answersErr } = await supabase
        .from('agrosuper_materials')
        .insert(materialAnswers);

      if (answersErr) {
        console.error('Error inserting material answers:', answersErr);
      }
    }

    // 4. Calcular métricas de implementación
    const metrics = await calculateImplementationMetrics(audit.id, locationId);

    // Grabar métricas
    const { error: metricsErr } = await supabase
      .from('agrosuper_audits')
      .update({
        status: 'calculated',
        implementation_rate: metrics.overall,
        metrics_by_brand: {
          la_crianza: metrics.la_crianza,
          super_cerdo: metrics.super_cerdo,
        },
        metrics_by_space: {
          panaderia: metrics.panaderia,
          fachada_externa: metrics.fachada_externa,
        },
      })
      .eq('id', audit.id);

    if (metricsErr) {
      console.error('Error updating metrics:', metricsErr);
    }

    console.info('[agrosuper-webhook] audit created', {
      audit_id: audit.id,
      location_id: locationId,
      materials_count: materialAnswers.length,
      metrics,
    });

    return NextResponse.json({
      success: true,
      audit_id: audit.id,
      location_id: locationId,
      materials_count: materialAnswers.length,
      metrics,
    });
  } catch (error) {
    console.error('Agrosuper webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

async function calculateImplementationMetrics(
  auditId: string,
  locationId: string
): Promise<{
  overall: number;
  la_crianza: number;
  super_cerdo: number;
  panaderia: number;
  fachada_externa: number;
}> {
  const { data: materials } = await supabase
    .from('agrosuper_materials')
    .select('*')
    .eq('audit_id', auditId);

  if (!materials || materials.length === 0) {
    return {
      overall: 0,
      la_crianza: 0,
      super_cerdo: 0,
      panaderia: 0,
      fachada_externa: 0,
    };
  }

  const byCrianza = materials.filter(m => m.brand === 'LA_CRIANZA' && m.implemented).length /
    Math.max(1, materials.filter(m => m.brand === 'LA_CRIANZA').length) * 100;

  const byCerdo = materials.filter(m => m.brand === 'SUPER_CERDO' && m.implemented).length /
    Math.max(1, materials.filter(m => m.brand === 'SUPER_CERDO').length) * 100;

  const byPanaderia = materials.filter(m => m.space === 'PANADERIA' && m.implemented).length /
    Math.max(1, materials.filter(m => m.space === 'PANADERIA').length) * 100;

  const byFachada = materials.filter(m => m.space === 'FACHADA_EXTERNA' && m.implemented).length /
    Math.max(1, materials.filter(m => m.space === 'FACHADA_EXTERNA').length) * 100;

  const overall = materials.filter(m => m.implemented).length / materials.length * 100;

  return {
    overall: Math.round(overall),
    la_crianza: Math.round(byCrianza),
    super_cerdo: Math.round(byCerdo),
    panaderia: Math.round(byPanaderia),
    fachada_externa: Math.round(byFachada),
  };
}
