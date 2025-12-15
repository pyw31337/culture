import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from 'next/script';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("http://pyw31337.dothome.co.kr"),
  title: "Culture Flow 서울 · 경기 · 인천 통합 공연 검색",
  description: "서울, 경기, 인천 지역의 모든 공연 정보를 한눈에 확인하세요.",
  openGraph: {
    title: "Culture Flow",
    siteName: "Culture Flow",
    url: "http://pyw31337.dothome.co.kr/culture/",
    description: "서울, 경기, 인천 지역의 모든 공연 정보를 한눈에 확인하세요.",
    images: [
      {
        url: "/culture/images/og-image.jpg",
        width: 1200,
        height: 600,
        alt: "Culture Flow Preview",
      },
    ],
    type: "website",
  },
  icons: {
    icon: '/culture/favicon.png',
    apple: '/culture/icon.png',
  },
  manifest: '/culture/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Script
          id="kakao-map-script"
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=0236cfffa7cfef34abacd91a6d7c73c0&autoload=false&libraries=services"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
