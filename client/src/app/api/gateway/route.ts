// gateway v2 – auth via REST API (no jose ESM)
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large deployments
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';
import { z } from 'zod';
import { GatewayService } from '@/modules/core/services/gateway.server';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session')?.value;
    const { role } = await verifySession(sessionToken);

    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'saveSetupDraft':
        result = await GatewayService.saveSetupDraft(payload);
        break;
      case 'deployTournament':
        result = await GatewayService.deployTournament(payload);
        break;
      case 'assignStaff':
        result = await GatewayService.assignStaff(payload);
        break;
      case 'updateSchedule':
        result = await GatewayService.updateSchedule(payload);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error('API Gateway Error:', error);
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation Error', details: error.issues || error.errors }, { status: 400 });
    }
    const errMsg = error?.message || String(error);
    const errDetail = process.env.NODE_ENV === 'development' ? { stack: error?.stack } : undefined;

    if (errMsg.startsWith('CONFLICT:')) {
      return NextResponse.json({ success: false, error: errMsg.replace('CONFLICT: ', '') }, { status: 409 });
    }

    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: errMsg, details: errDetail } }, { status: 500 });
  }
}
