'use server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function verifyAdminPassword(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  return password === adminPassword;
}

export async function registerUser(username: string, password: string) {
  try {
    // 1. Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return { error: 'Username already taken' };
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. Insert user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ username, password_hash: hash })
      .select()
      .single();

    if (error) throw error;

    return { user: { id: newUser.id, username: newUser.username } };
  } catch (e: any) {
    return { error: e.message || 'Registration failed' };
  }
}

export async function loginUser(username: string, password: string) {
  try {
    // 1. Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return { error: 'Invalid username or password' };
    }

    // 2. Check password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return { error: 'Invalid username or password' };
    }

    return { user: { id: user.id, username: user.username } };
  } catch (e: any) {
    return { error: e.message || 'Login failed' };
  }
}
