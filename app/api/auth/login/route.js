import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import User from '@/models/User';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getAuthCookieOptions,
  signAccessToken,
  signRefreshToken,
} from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    console.log('Login attempt:', { email, passwordLength: password?.length });

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find user
    const user = await User.findOne({ email });
    console.log('User found:', user ? 'yes' : 'no');
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Auth server is misconfigured' },
        { status: 500 }
      );
    }

    // Create response with token
    const response = NextResponse.json(
      { 
        success: true,
        user: { 
          id: user._id, 
          email: user.email 
        }
      },
      { status: 200 }
    );

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, getAuthCookieOptions(60 * 15));
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, getAuthCookieOptions(60 * 60 * 24 * 30));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
