import { Nunito, Nunito_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/app/theme-provider';
import { getAppConfig } from '@/lib/utils';
import '@/styles/globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['600', '700', '800'],
});

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '600', '700'],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const { pageTitle, pageDescription } = appConfig;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`light ${nunito.variable} ${nunitoSans.variable}`}
    >
      <head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
