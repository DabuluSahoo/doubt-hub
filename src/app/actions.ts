'use server'

export async function verifyAdminPassword(password: string) {
  // Use a server-side environment variable for safety.
  // This is set in .env.local and Vercel dashboard.
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.warn('ADMIN_PASSWORD is not set in environment variables');
    return false;
  }
  
  return password === adminPassword;
}
