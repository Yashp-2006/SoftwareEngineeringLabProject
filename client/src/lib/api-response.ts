import { NextResponse } from 'next/server';
import { z } from 'zod';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export function errorResponse(error: unknown, fallbackMessage = 'Internal server error'): NextResponse {
  if (error instanceof z.ZodError || (error as any)?.name === 'ZodError') {
    const err = error as z.ZodError;
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation Error', details: err.issues || (err as any).errors } },
      { status: 400 }
    );
  }

  const msg = (error as Error)?.message || fallbackMessage;

  if (msg.startsWith('BAD_REQUEST:')) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: msg.replace('BAD_REQUEST: ', '') } }, { status: 400 });
  }
  if (msg.startsWith('NOT_FOUND:')) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: msg.replace('NOT_FOUND: ', '') } }, { status: 404 });
  }
  if (msg.startsWith('UNAUTHORIZED:')) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: msg.replace('UNAUTHORIZED: ', '') } }, { status: 403 });
  }
  if (msg.startsWith('UNPROCESSABLE_ENTITY:')) {
    return NextResponse.json({ success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: msg.replace('UNPROCESSABLE_ENTITY: ', '') } }, { status: 422 });
  }

  return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: msg } }, { status: 500 });
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message } }, { status: 403 });
}
