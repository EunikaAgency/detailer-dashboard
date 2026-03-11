import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    return NextResponse.json({
      user: {
        id: user._id?.toString?.() || user.id,
        name: user.name || "",
        email: user.email,
        username: user.username || "",
        repId: user.repId || "",
        role: user.role || "",
        accessType: user.accessType || "",
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}
