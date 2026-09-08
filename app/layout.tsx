import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import Shell from '@/components/shell';
import './globals.css';
export const metadata: Metadata = { title: 'Calify', description: 'Local photo progress and camera calibration' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppRouterCacheProvider><Shell>{children}</Shell></AppRouterCacheProvider></body></html>;
}
