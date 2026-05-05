import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { ToastProvider, UserProvider } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'DoubtHub — Group Study Doubt Manager',
  description: 'Upload, organize, and solve study doubts collaboratively with your group.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <ToastProvider>
            <Navbar />
            <main>{children}</main>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
