import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from 'next/script';
import ProgressBarProvider from "@/components/ProgressBarProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstallApp from "@/components/InstallApp";
import ScrollToTop from "@/components/ScrollToTop";
import VersionUpdateBanner from "@/components/VersionUpdateBanner";
import { getDataBuildInfo } from "@/lib/performance-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-5GWFPEPEW5';
const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://pyw31337.github.io/culture"),
  title: "Culture Flow - 전국 통합 문화 검색",
  description: "전국 모든 문화 정보를 한눈에 확인하세요.",
  openGraph: {
    title: "Culture Flow",
    siteName: "Culture Flow",
    url: "https://pyw31337.github.io/culture/",
    description: "전국 모든 문화 정보를 한눈에 확인하세요.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 600,
        alt: "Culture Flow Preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Culture Flow",
    description: "전국 모든 문화 정보를 한눈에 확인하세요.",
    images: ["/images/og-image.jpg"],
  },
  icons: {
    icon: '/culture/favicon.png',
    apple: '/culture/icon.png',
  },
  manifest: '/culture/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Culture Flow',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildInfo = getDataBuildInfo();

  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var localTheme = localStorage.getItem('theme');
                  // Default is Light (:root). We only add .dark if explicitly set.
                  if (localTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {gaMeasurementId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="lazyOnload">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());

                gtag('config', '${gaMeasurementId}');
              `}
            </Script>
          </>
        )}
        <ProgressBarProvider>
          <ErrorBoundary>
            {children}
            <InstallApp />
            <VersionUpdateBanner
              currentVersion={buildInfo?.version ?? null}
              currentGeneratedAt={buildInfo?.generatedAt ?? null}
            />
            <ScrollToTop />
          </ErrorBoundary>
        </ProgressBarProvider>
        {kakaoJsKey && (
          <Script
            id="kakao-map-script"
            src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&autoload=false&libraries=services,clusterer`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
